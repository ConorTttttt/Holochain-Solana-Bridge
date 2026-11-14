/**
 * SEC independent fault injections for OBS finalized indexer.
 * Must execute in combined SEC+OBS checkout with real @solana/kit.
 * Deliberate skip on SEC-only branch is NOT a release gate pass.
 * Signed synthetic wire fixtures do not prove Solana consensus.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('SEC-OBS: failed/unrelated signed transactions cannot hide forgery or advance durable checkpoint', async t => {
  let indexFinalizedRange, encode58;
  try {
    ({ indexFinalizedRange } = await import('../../observer/src/indexer.mjs'));
    ({ encode58 } = await import('../../observer/src/decode.mjs'));
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND' &&
      /observer\/src\/indexer\.mjs|@solana\/kit/.test(e.message)) {
      t.skip('requires OBS PR #36 + pinned SDK in integration checkout; NOT a release pass');
      return;
    }
    throw e;
  }
  const pub = n => encode58(Buffer.alloc(32, n));
  const program = 'FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
  const genesisHash = pub(10), mint = pub(11), config = pub(12), vault = pub(13);
  const discriminator = name => [...createHash('sha256').update('account:' + name).digest().subarray(0, 8)];
  const seed = tag => ({ kind:'const', value:[...Buffer.from(tag)] });
  const path = name => ({ kind:'account', path:name });
  const arg = name => ({ kind:'arg', path:name });
  // Matches OBS's non-economic generated-IDL-shape fixture. No compiled ELF claim.
  const fakeIdl = {
    address:program,
    accounts:['BridgeConfig','DepositReceipt'].map(name => ({ name, discriminator:discriminator(name) })),
    types:[
      { name:'BridgeConfig', type:{ kind:'struct', fields:[
        {name:'admin',type:'pubkey'}, {name:'mint',type:'pubkey'},
        {name:'scope',type:{array:['u8',32]}}, {name:'paused',type:'bool'},
        {name:'total_active',type:'u64'}, {name:'bump',type:'u8'}] } },
      { name:'DepositReceipt', type:{ kind:'struct', fields:[
        ...['depositor','mint','vault','config','recipient_core','scope'].map(name =>
          ({ name,type:['recipient_core','scope'].includes(name) ? {array:['u8',32]} : 'pubkey' })),
        {name:'nonce',type:'u64'}, {name:'amount',type:'u64'},
        {name:'refunded',type:'bool'}, {name:'bump',type:'u8'}] } },
    ],
    instructions:[
      {name:'initialize',accounts:[
        {name:'config',pda:{seeds:[seed('config')]}},
        {name:'vault',pda:{seeds:[seed('vault'),path('mint')]}}]},
      {name:'deposit',accounts:[
        {name:'config',pda:{seeds:[seed('config')]}},
        {name:'vault',pda:{seeds:[seed('vault'),path('mint')]}},
        {name:'receipt',pda:{seeds:[seed('deposit'),path('depositor'),arg('nonce')]}}]},
    ],
  };
  const idlText = JSON.stringify(fakeIdl);
  const expected = { program, mint, config, vault, scope:'07'.repeat(32),
    idlSha256:createHash('sha256').update(idlText).digest('hex') };
  const urls = ['https://sec-rpc-a.example','https://sec-rpc-b.example'];
  const block20 = pub(25), block21 = pub(27), pre20 = pub(26);
  const wire = ({forge=false}={}) => {
    const {publicKey,privateKey} = generateKeyPairSync('ed25519');
    const signer = Buffer.from(publicKey.export({format:'der',type:'spki'})).subarray(-32);
    const message = Buffer.concat([Buffer.from([1,0,0,1]),signer,Buffer.alloc(32,15),Buffer.from([0])]);
    const signature = edSign(null,message,privateKey);
    if (forge) message[36] ^= 1; // Signature remains 64 bytes; cryptographic invalidity only.
    return { version:'legacy', transaction:[Buffer.concat([
      Buffer.from([1]),signature,message]).toString('base64'),'base64'],
      meta:{err:{InstructionError:[0,'InvalidInstructionData']}} };
  };
  const good20 = wire(), unrelated21 = wire(), good21 = wire(), forged21 = wire({forge:true});
  function rpc({forged=false,divergent=false,badList=false}={}) {
    return async (url,request) => {
      const {method,params}=JSON.parse(request.body);
      const isB = url===urls[1];
      let result;
      switch (method) {
        case 'getGenesisHash': result=genesisHash; break;
        case 'getFirstAvailableBlock': result=1; break;
        case 'getSlot': result=100; break;
        case 'getBlocks': {
          const [first,last]=params;
          result = badList ? [20,22] : [20,21].filter(n => n>=first && n<=last);
          break;
        }
        case 'getBlock': {
          const slot=params[0], hash=slot===20 ? block20 :
            divergent && isB ? pub(88) : block21;
          result = { blockhash:hash,
            previousBlockhash:slot===20 ? pre20 : block20,
            parentSlot:slot===20 ? 19 : 20,
            transactions:slot===20 ? [good20] :
              [unrelated21,forged ? forged21 : good21] };
          break;
        }
        default: throw new Error('unexpected RPC request '+method);
      }
      return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
    };
  }
  const workspace=mkdtempSync(join(tmpdir(),'sec-obs-checkpoint-'));
  t.after(()=>rmSync(workspace,{recursive:true,force:true}));
  const options = file => ({rpcUrls:urls, expected, genesisHash,
    trustedDeploymentSlot:20, idlText, toSlot:21, ledgerPath:join(workspace,file)});
  const persisted = filename => JSON.parse(readFileSync(filename,'utf8'));

  await t.test('invalid signature in failed unrelated transaction blocks slot 21, not slot 20', async () => {
    const opt=options('malformed-signature.json');
    await assert.rejects(indexFinalizedRange({...opt,fetchFn:rpc({forged:true})}),
      /invalid Ed25519 transaction signature/);
    const state=persisted(opt.ledgerPath);
    assert.equal(state.checkpoint,20);
    assert.deepEqual(Object.keys(state.blocks),['20']);
    assert.equal(existsSync(opt.ledgerPath+'.lock'),false);
    const recovered=await indexFinalizedRange({...opt,fetchFn:rpc()});
    assert.equal(recovered.checkpoint,21);
    assert.equal(recovered.processed,0);
    assert.equal(recovered.creditEligible,false);
    assert.deepEqual(Object.keys(persisted(opt.ledgerPath).blocks),['20','21']);
  });

  await t.test('contradictory finalized block hashes cannot move checkpoint', async () => {
    const opt=options('provider-fork.json');
    await assert.rejects(indexFinalizedRange({...opt,fetchFn:rpc({divergent:true})}),
      /providers disagree about block/);
    assert.equal(persisted(opt.ledgerPath).checkpoint,20);
    assert.deepEqual(Object.keys(persisted(opt.ledgerPath).blocks),['20']);
  });

  await t.test('out-of-range getBlocks listing fails before signature assertion, with no checkpoint', async () => {
    const opt=options('bad-fixture.json');
    await assert.rejects(indexFinalizedRange({...opt,fetchFn:rpc({badList:true,forged:true})}),
      /invalid\/incomplete ordered slot listing/);
    assert.equal(existsSync(opt.ledgerPath),false);
    assert.equal(existsSync(opt.ledgerPath+'.lock'),false);
  });
});
