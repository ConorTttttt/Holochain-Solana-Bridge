/**
 * SEC independent OBS transaction/provenance probes.
 * These are signed synthetic wire transactions and adversarial RPC responses,
 * NOT real Solana consensus proofs. Requires OBS PR #36 and @solana/kit@8.6.0
 * in the integrated checkout. A standalone SEC checkout must report SKIPPED,
 * and a release CI gate MUST require zero skips on the combined checkout.
 * Never modify OBS source or grant economic authority.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';

test('SEC-TX independent signed-wire and RPC trust-boundary probes', async t => {
  let transaction, indexer, decode, pda;
  try {
    transaction = await import('../../observer/src/transaction.mjs');
    indexer = await import('../../observer/src/indexer.mjs');
    decode = await import('../../observer/src/decode.mjs');
    pda = await import('../../observer/src/pda.mjs');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' &&
        /observer\/src\/transaction\.mjs|observer\/src\/indexer\.mjs|@solana\/kit/.test(error.message)) {
      t.skip('OBS PR #36 and installed pinned @solana/kit required; NOT a passing release gate');
      return;
    }
    throw error;
  }
  const { decodeFinalizedWire, verifyWireSignatures, verifyDepositCandidates } = transaction;
  const { fetchFinalizedTransaction } = indexer;
  const { encode58, addressBytes } = decode;
  const pub = byte => encode58(Buffer.alloc(32,byte));
  const blockhash=pub(30), genesisHash=pub(31), program=pub(32), mint=pub(33);
  const keyPair = () => {
    const pair=generateKeyPairSync('ed25519');
    return { privateKey:pair.privateKey,
      address:encode58(pair.publicKey.export({format:'der',type:'spki'}).subarray(-32)) };
  };
  const signers=[keyPair(),keyPair()];
  const meta = count => ({err:null,preBalances:Array(count).fill(1),
    postBalances:Array(count).fill(1),preTokenBalances:[],postTokenBalances:[],
    innerInstructions:[]});
  const legacyMessage=(keys,version='legacy',lookups=Buffer.from([0]))=>{
    const header=Buffer.from([keys.length,0,0]);
    const body=Buffer.concat([header,Buffer.from([keys.length]),
      ...keys.map(x=>addressBytes(x)),addressBytes(blockhash),Buffer.from([0])]);
    return version===0 ? Buffer.concat([Buffer.from([0x80]),body,lookups]) : body;
  };
  const signed=(keys=signers.slice(0,1),version='legacy',lookups=Buffer.from([0]))=>{
    const message=legacyMessage(keys.map(x=>x.address),version,lookups);
    const signatures=keys.map(x=>edSign(null,message,x.privateKey));
    const bytes=Buffer.concat([Buffer.from([keys.length]),...signatures,message]);
    return {version,slot:500,transaction:[bytes.toString('base64'),'base64'],
      meta:meta(keys.length),signature:encode58(signatures[0])};
  };
  const mutateWire=(rpc,index,mask=1)=>{
    const bytes=Buffer.from(rpc.transaction[0],'base64');
    bytes[index]^=mask;
    return {...rpc,transaction:[bytes.toString('base64'),'base64']};
  };
  const withoutSignature=rpc=>Object.fromEntries(Object.entries(rpc)
    .filter(([k])=>k!=='signature'));
  const discriminator=name=>[...createHash('sha256').update('account:'+name).digest().subarray(0,8)];
  const seed=value=>({kind:'const',value:[...Buffer.from(value)]});
  const pdaField=(name,seeds)=>({name,pda:{seeds}});
  const field=(name,type)=>({name,type});
  function generatedShape() {
    return {address:program,
      accounts:['BridgeConfig','DepositReceipt'].map(name=>({name,discriminator:discriminator(name)})),
      types:[
        {name:'BridgeConfig',type:{kind:'struct',fields:[
          field('admin','pubkey'),field('mint','pubkey'),field('scope',{array:['u8',32]}),
          field('paused','bool'),field('total_active','u64'),field('bump','u8')]}},
        {name:'DepositReceipt',type:{kind:'struct',fields:[
          field('depositor','pubkey'),field('mint','pubkey'),field('vault','pubkey'),
          field('config','pubkey'),field('recipient_core',{array:['u8',32]}),
          field('scope',{array:['u8',32]}),field('nonce','u64'),field('amount','u64'),
          field('refunded','bool'),field('bump','u8')]}}
      ],
      instructions:[
        {name:'initialize',accounts:[
          pdaField('config',[seed('config')]),
          pdaField('vault',[seed('vault'),{kind:'account',path:'mint'}])]},
        {name:'deposit',
          discriminator:[...createHash('sha256').update('global:deposit').digest().subarray(0,8)],
          accounts:[{name:'depositor'},pdaField('config',[seed('config')]),{name:'mint'},
            {name:'source'},pdaField('vault',[seed('vault'),{kind:'account',path:'mint'}]),
            pdaField('receipt',[seed('deposit'),{kind:'account',path:'depositor'},
              {kind:'arg',path:'nonce'}]),{name:'token_program'},{name:'system_program'}],
          args:[field('nonce','u64'),field('recipient_core',{array:['u8',32]}),
            field('amount','u64')]}
      ]};
  }
  const expectedAddresses=await pda.deriveBridgeAddresses({
    program,mint,depositor:pub(0),nonce:0n,
  });
  const verifyArgs = rpc=>({
    rpcTransaction:withoutSignature(rpc),signature:rpc.signature,
    expected:{program,mint,scope:'09'.repeat(32),config:expectedAddresses.config,
      vault:expectedAddresses.vault},
    genesisHash,idl:generatedShape(),finalizedClaim:true,blockhash,
  });

  await t.test('valid fee-payer signature and second required signer verify cryptographically',async()=>{
    const tx=signed(signers);
    const decoded=decodeFinalizedWire(tx,tx.signature);
    assert.equal(decoded.signedTransaction.signatures instanceof Map,false);
    assert.deepEqual(Object.keys(decoded.signedTransaction.signatures),
      signers.map(x=>x.address));
    assert.equal(await verifyWireSignatures(decoded),true);
  });

  await t.test('fee-payer signature alone cannot hide a forged second signer',async()=>{
    const tx=signed(signers);
    const changed=mutateWire(tx,65);
    const decoded=decodeFinalizedWire(changed,tx.signature);
    await assert.rejects(verifyWireSignatures(decoded),/invalid Ed25519/);
  });

  await t.test('forged 64-byte first signature and message tampering are denied',async()=>{
    const tx=signed();
    const alteredSig=mutateWire(tx,1);
    const supplied=encode58(Buffer.from(alteredSig.transaction[0],'base64').subarray(1,65));
    const decoded=decodeFinalizedWire(alteredSig,supplied);
    await assert.rejects(verifyWireSignatures(decoded),/invalid Ed25519/);
    const changedMessage=mutateWire(tx,Buffer.from(tx.transaction[0],'base64').length-1);
    await assert.rejects(verifyWireSignatures(
      decodeFinalizedWire(changedMessage,tx.signature)),/invalid Ed25519/);
  });

  await t.test('unsigned/short signature and mismatched identity cannot decode',()=>{
    const tx=signed();
    assert.throws(()=>decodeFinalizedWire(tx,pub(99)),/signature/);
    const bytes=Buffer.from(tx.transaction[0],'base64');
    const noSignatures={...tx,transaction:[
      Buffer.concat([Buffer.from([0]),bytes.subarray(65)]).toString('base64'),'base64']};
    assert.throws(()=>decodeFinalizedWire(noSignatures,tx.signature));
  });

  await t.test('valid signed unrelated instructions must yield zero deposit candidates',async()=>{
    const tx=signed();
    const found=await verifyDepositCandidates(verifyArgs(tx));
    assert.deepEqual(found,[]);
  });

  await t.test('failed transaction and unsupported transaction version are denied',async()=>{
    const tx=signed();
    await assert.rejects(verifyDepositCandidates(verifyArgs(
      {...tx,meta:{...tx.meta,err:{InstructionError:[0,'Custom']}}})),/failed/);
    assert.throws(()=>decodeFinalizedWire({...tx,version:2},tx.signature),/unsupported/);
    assert.throws(()=>decodeFinalizedWire({...tx,version:0},tx.signature),/contradicts/);
  });

  await t.test('incomplete v0 ALT resolution is denied; supplied addresses are RPC claims',()=>{
    const lookup=Buffer.concat([Buffer.from([1]),addressBytes(pub(40)),
      Buffer.from([1,3,1,4])]);
    const tx=signed(signers.slice(0,1),0,lookup);
    const populated={...tx,meta:{...meta(3),
      loadedAddresses:{writable:[pub(41)],readonly:[pub(42)]}}};
    const decoded=decodeFinalizedWire(populated,tx.signature);
    assert.equal(decoded.compiledMessage.version,0);
    assert.throws(()=>decodeFinalizedWire({...populated,meta:{
      ...populated.meta,loadedAddresses:{writable:[],readonly:[]}}},tx.signature),
      /resolution unavailable/);
    const substituted={...populated,meta:{...populated.meta,
      loadedAddresses:{writable:[pub(43)],readonly:[pub(44)]}}};
    assert.equal(decodeFinalizedWire(substituted,tx.signature).compiledMessage.version,0);
    // WARNING: same signed wire with substituted RPC ALT addresses is not historical table proof.
  });

  await t.test('fabricated mutually consistent finalized RPC responses are NOT consensus',async()=>{
    const tx=signed();
    const block={blockhash,previousBlockhash:pub(45),parentSlot:499,
      transactions:[{version:tx.version,transaction:tx.transaction,meta:tx.meta}]};
    const mock=async(_url,request)=>{
      const {method}=JSON.parse(request.body);
      const result=method==='getGenesisHash' ? genesisHash :
        method==='getTransaction' ? withoutSignature(tx) :
        method==='getBlock' ? block : undefined;
      return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
    };
    const params={rpcUrl:'https://attacker.example',signature:tx.signature,genesisHash};
    const response=await fetchFinalizedTransaction({...params,fetchFn:mock});
    assert.equal(response.finalizedClaim,true);
    assert.equal(response.creditEligible,false);
    assert.equal(response.source,'attacker.example');
    // A forged provider can invent the block AND transaction; no authenticated finality proof.
    const contradict=async(url,request)=>{
      const method=JSON.parse(request.body).method;
      if(method!=='getBlock')return mock(url,request);
      return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:{
        ...block,transactions:[{...block.transactions[0],
          meta:{...tx.meta,fee:999}}]}})};
    };
    await assert.rejects(fetchFinalizedTransaction({...params,fetchFn:contradict}),
      /contradicts containing finalized getBlock/);
  });

  await t.test('vault metadata is not signed; signature validation cannot authenticate RPC token deltas',async()=>{
    const tx=signed();
    const fraudulent={...tx,meta:{...tx.meta,
      preTokenBalances:[{accountIndex:0,uiTokenAmount:{amount:'0'}}],
      postTokenBalances:[{accountIndex:0,uiTokenAmount:{amount:'18446744073709551615'}}]}};
    assert.equal(await verifyWireSignatures(
      decodeFinalizedWire(fraudulent,tx.signature)),true);
    // A real deposit candidate MUST also match deposit CPI, receipt and exact source/vault deltas.
    assert.deepEqual(await verifyDepositCandidates(verifyArgs(fraudulent)),[]);
  });
});
