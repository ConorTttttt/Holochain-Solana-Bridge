import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { fetchFinalizedTransaction, indexFinalizedRange, rpcRequest } from '../src/indexer.mjs';
import { encode58 } from '../src/decode.mjs';

const pub=n=>encode58(Buffer.alloc(32,n));
const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const genesisHash=pub(10),mint=pub(11),config=pub(12),vault=pub(13),scope='07'.repeat(32);
const disc=x=>[...createHash('sha256').update('account:'+x).digest().subarray(0,8)];
const seeds=(tag,...others)=>[{kind:'const',value:[...Buffer.from(tag)]},...others];
const acct=x=>({kind:'account',path:x}), arg=x=>({kind:'arg',path:x});
const fakeIdl={
  address:program,
  accounts:['BridgeConfig','DepositReceipt'].map(name=>({name,discriminator:disc(name)})),
  types:[
    {name:'BridgeConfig',type:{kind:'struct',fields:[
      {name:'admin',type:'pubkey'},{name:'mint',type:'pubkey'},
      {name:'scope',type:{array:['u8',32]}},{name:'paused',type:'bool'},
      {name:'total_active',type:'u64'},{name:'bump',type:'u8'}]}},
    {name:'DepositReceipt',type:{kind:'struct',fields:[
      {name:'depositor',type:'pubkey'},{name:'mint',type:'pubkey'},
      {name:'vault',type:'pubkey'},{name:'config',type:'pubkey'},
      {name:'recipient_core',type:{array:['u8',32]}},{name:'scope',type:{array:['u8',32]}},
      {name:'nonce',type:'u64'},{name:'amount',type:'u64'},
      {name:'refunded',type:'bool'},{name:'bump',type:'u8'}]}},
  ],
  instructions:[
    {name:'initialize',accounts:[
      {name:'config',pda:{seeds:seeds('config')}},
      {name:'vault',pda:{seeds:seeds('vault',acct('mint'))}},
    ]},
    {name:'deposit',accounts:[
      {name:'config',pda:{seeds:seeds('config')}},
      {name:'vault',pda:{seeds:seeds('vault',acct('mint'))}},
      {name:'receipt',pda:{seeds:seeds('deposit',acct('depositor'),arg('nonce'))}},
    ]},
  ],
};
const idlText=JSON.stringify(fakeIdl);
const expected={program,mint,config,vault,scope,
  idlSha256:createHash('sha256').update(idlText).digest('hex')};
const urls=['https://rpc-a.example','https://rpc-b.example'];
function fixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'obs-rpc-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  return join(directory,'ledger.json');
}
const baseBlock={blockhash:pub(25),previousBlockhash:pub(26),parentSlot:19,transactions:[]};
function signedWire({forged=false,failed=true}={}) {
  // Solana legacy envelope: compact signature count, signature, signed message.
  // Use real Ed25519 signatures so a corrupted message tests CRYPTO, not parsing.
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const signer=Buffer.from(publicKey.export({format:'der',type:'spki'})).subarray(-32);
  const message=Buffer.concat([
    Buffer.from([1,0,0,1]),signer,Buffer.alloc(32,15),Buffer.from([0]),
  ]);
  const signature=edSign(null,message,privateKey);
  if (forged) message[36]^=1; // Change signed recent blockhash after signing.
  const wire=Buffer.concat([Buffer.from([1]),signature,message]);
  return {
    version:'legacy',slot:20,transaction:[wire.toString('base64'),'base64'],
    meta:{err:failed ? {InstructionError:[0,'InvalidInstructionData']} : null},
    expectedSignature:encode58(signature),
  };
}
function rpcMock(options={}) {
  const calls=[];
  return {
    calls,
    fetchFn:async(url,init)=>{
      const req=JSON.parse(init.body);
      calls.push({provider:new URL(url).hostname,method:req.method,params:req.params});
      const isB=url===urls[1];
      let result;
      switch(req.method) {
        case 'getGenesisHash':result=(options.wrongGenesis && isB) ? pub(33):genesisHash; break;
        case 'getFirstAvailableBlock':result=options.pruned && isB ? 21:1;break;
        case 'getSlot':result=100;break;
        case 'getBlocks':result=(options.parentBroken || options.bothProduced) ? [20,21] : options.listConflict && isB ? [20,21]:[20];break;
        case 'getBlock':result=options.prunedBlock && isB ? null :
          {...baseBlock,
            ...(req.params[0]===21 ? {
              blockhash:pub(27),parentSlot:options.parentBroken ? 19:20,
              previousBlockhash:options.parentBroken ? pub(28):baseBlock.blockhash,
            } : {blockhash:options.blockConflict && isB ? pub(44):baseBlock.blockhash}),
            transactions:options.unsupported ? [{version:2,meta:{err:null},transaction:[]}] :
              options.failedTx && req.params[0]===(options.failedAtSlot ?? 20) ? [options.failedTx] : []};break;
        default:throw Error('Unexpected '+req.method);
      }
      return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
    },
  };
}
function input(t,options={}) {
  const rpc=rpcMock(options);
  return {...rpc, options:{
    rpcUrls:urls,expected,genesisHash, trustedDeploymentSlot:20,
    idlText, ledgerPath:fixture(t), toSlot:21,fetchFn:rpc.fetchFn,
  }};
}
test('scans produced finalized blocks and commits skipped slots, restart performs no replay',async t=>{
  const {options,calls}=input(t);
  const first=await indexFinalizedRange(options);
  assert.equal(first.checkpoint,21);
  assert.equal(first.processed,0);
  assert.equal(first.creditEligible,false);
  assert.equal(calls.filter(x=>x.method==='getBlock').length,2);
  const restart=await indexFinalizedRange(options);
  assert.equal(restart.alreadyIndexed,true);
  assert.equal(restart.checkpoint,21);
  assert.equal(calls.filter(x=>x.method==='getBlock').length,2);
  assert.equal(calls.find(x=>x.method==='getBlock').params[1].maxSupportedTransactionVersion,1);
  assert.equal(calls.find(x=>x.method==='getBlock').params[1].commitment,'finalized');
});
for(const [name,variation,pattern] of [
  ['provider blockhash disagreement',{blockConflict:true},/disagree about block/],
  ['provider list disagreement',{listConflict:true},/produced-slot enumeration/],
  ['parent-chain discontinuity',{parentBroken:true},/parent-chain discontinuity/],
  ['pruned archive',{pruned:true},/historical data pruned/],
  ['missing historical block',{prunedBlock:true},/missing\/pruned finalized block/],
  ['unsupported transaction version',{unsupported:true},/unsupported transaction version/],
  ['different provider genesis',{wrongGenesis:true},/provider genesis mismatch/],
]){
  test('fail closed on '+name,async t=>{
    const {options}=input(t,variation);
    await assert.rejects(indexFinalizedRange(options),pattern);
  });
}
test('RPC transport rejects missing result and explicit error',async()=>{
  const stub=async(_url,request)=>({
    ok:true,json:async()=>({
      jsonrpc:'2.0',id:1,
      ...(JSON.parse(request.body).params[0]==='bad' ? {error:{code:-32000,message:'history pruned'}} : {}),
    }),
  });
  await assert.rejects(rpcRequest(urls[0],'getBlock',[20],stub),/missing RPC getBlock result/);
  await assert.rejects(rpcRequest(urls[0],'getBlock',['bad'],stub),/RPC getBlock error -32000/);
});

test('failed transactions require valid Ed25519 signatures before checkpoint advancement',async t=>{
  const {options}=input(t);
  const poisoned=rpcMock({bothProduced:true,failedTx:signedWire({forged:true}),failedAtSlot:21});
  await assert.rejects(indexFinalizedRange({...options,fetchFn:poisoned.fetchFn}),
    /invalid Ed25519 transaction signature/);
  // Slot 20 was checked; slot 21 was not, so neither cursor nor replay journal
  // may claim slot 21. The lock must be released for safe resumption.
  const persisted=JSON.parse(readFileSync(options.ledgerPath,'utf8'));
  assert.equal(persisted.checkpoint,20);
  assert.deepEqual(Object.keys(persisted.blocks),['20']);
  assert.equal(existsSync(options.ledgerPath+'.lock'),false);
  const clean=rpcMock({bothProduced:true,failedTx:signedWire(),failedAtSlot:21});
  const resumed=await indexFinalizedRange({...options,fetchFn:clean.fetchFn});
  assert.equal(resumed.checkpoint,21);
  assert.equal(resumed.processed,0,'failed transactions must never issue deposit evidence');
  assert.equal(resumed.creditEligible,false);
});

test('getTransaction inclusion refuses unrelated forged signatures in containing block',async()=>{
  const target=signedWire({failed:false});
  const unrelated=signedWire({forged:true});
  const containing={...baseBlock,transactions:[
    {version:target.version,transaction:target.transaction,meta:target.meta},
    {version:unrelated.version,transaction:unrelated.transaction,meta:unrelated.meta},
  ]};
  const fetchFn=async(_url,request)=>{
    const {method}=JSON.parse(request.body);
    const result=method==='getGenesisHash' ? genesisHash :
      method==='getTransaction' ? target :
      method==='getBlock' ? containing : undefined;
    return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
  };
  await assert.rejects(fetchFinalizedTransaction({
    rpcUrl:urls[0],signature:target.expectedSignature,genesisHash,fetchFn,
  }),/invalid Ed25519 transaction signature/);
});
