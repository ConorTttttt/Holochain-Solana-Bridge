/** A2 PR #47 source-sidecars are UNTRUSTED. Synthetic importer tests only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DENIALS} from '../src/demo-outbox.mjs';
import {verifyProducerHistoryInput} from '../src/producer-history-input.mjs';

const genesisHash='1'.repeat(32),opts={
  commitment:'finalized',encoding:'base64',transactionDetails:'full',
  rewards:false,maxSupportedTransactionVersion:1,
};
function sample(t){
  const dir=mkdtempSync(join(tmpdir(),'obs-pr47-import-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  mkdirSync(join(dir,'rpc'));
  const files=[];let seq=0;
  const providers=['a','b'].map(id=>{
    const block={blockhash:'1'.repeat(32),previousBlockhash:'1'.repeat(32),
      parentSlot:16,transactions:[]};
    const range={method:'getBlocks',commitment:'finalized',
      fromSlot:17,toSlot:17,result:[17]};
    const provider={providerId:id,rpcUrl:'http://'+id+'.invalid',
      commitment:'finalized',genesisHash,firstAvailableBlock:1,finalizedTip:20,
      getBlocks:[range],getBlock:[{method:'getBlock',slot:17,
        options:opts,result:block}],historicalAltAccounts:[]};
    const record=(tag,method,params,result)=>{
      const name='rpc/'+id+'-'+tag+'.rpc.json';
      const request={jsonrpc:'2.0',id:++seq,method,params};
      const value={requestedAt:'test-only',providerId:id,method,params,request,
        response:{jsonrpc:'2.0',id:seq,result},responseAt:'test-only',
        transportError:null};
      writeFileSync(join(dir,name),JSON.stringify(value));
      files.push(name);
    };
    record('genesis','getGenesisHash',[],genesisHash);
    record('first-available','getFirstAvailableBlock',[],1);
    record('finalized-tip','getSlot',[{commitment:'finalized'}],20);
    record('getBlocks-17-17','getBlocks',[17,17,{commitment:'finalized'}],[17]);
    record('getBlock-17','getBlock',[17,opts],block);
    return provider;
  });
  const handoff={kind:'solana-produced-slot-archive-handoff-v1',
    fullHistoryGate:'BLOCKED',absentSlotsClassifiedAsEmpty:false,
    ...DENIALS,archive:{kind:'observer-original-two-provider-history-v1',
      fromSlot:17,toSlot:17,genesisHash,providers},
    sourceFiles:files,gaps:[{classification:'HISTORICAL_REFUND_STATE_PROOF_NOT_ESTABLISHED'}]};
  const save=()=>writeFileSync(join(dir,'produced-slot-handoff.json'),JSON.stringify(handoff));
  save();
  const verify=()=>verifyProducerHistoryInput({directory:dir,expectedGenesisHash:genesisHash,
    expectedFromSlot:17,expectedToSlot:17});
  return {dir,files,handoff,save,verify};
}
test('01 original PR47 raw sidecars compared; history still explicitly incomplete',async t=>{
  const x=sample(t);const result=await x.verify();
  assert.equal(result.archiveOriginalResponsesCompared,true);
  assert.equal(result.historyComplete,false);
  assert.equal(result.historyIndexed,false);
  assert.equal(result.refundDurablyCommitted,false);
  assert.equal(result.absentSlotsClassifiedAsEmpty,false);
  assert.equal(result.independentConsensusVerified,false);
  assert.equal(result.status,'BLOCKED_SOURCE_GAPS');
  assert.deepEqual(result.sourceGaps,['HISTORICAL_REFUND_STATE_PROOF_NOT_ESTABLISHED']);
});
test('02 producer cannot turn its own BLOCKED gate into PASS',async t=>{
  const x=sample(t);x.handoff.fullHistoryGate='PASS';x.save();
  await assert.rejects(x.verify(),/PRODUCER_GATE_LAUNDERING/);
});
test('03 original getBlock content mismatch is refused',async t=>{
  const x=sample(t),file=join(x.dir,'rpc/a-getBlock-17.rpc.json');
  const source=JSON.parse(readFileSync(file,'utf8'));
  source.response.result.blockhash='forged';
  writeFileSync(file,JSON.stringify(source));
  await assert.rejects(x.verify(),/RAW_FULL_BLOCK_CONFLICT/);
});
test('04 missing raw sidecar cannot be replaced by a producer summary',async t=>{
  const x=sample(t);x.handoff.sourceFiles=x.files.filter(x=>!x.includes('a-getBlocks-17-17'));x.save();
  await assert.rejects(x.verify(),/MISSING_ORIGINAL_SIDECAR_getBlocks/);
});
test('05 raw request method or commitment mutation is refused',async t=>{
  const x=sample(t),file=join(x.dir,'rpc/b-getBlock-17.rpc.json');
  const source=JSON.parse(readFileSync(file,'utf8'));
  source.request.params[1].commitment='processed';
  writeFileSync(file,JSON.stringify(source));
  await assert.rejects(x.verify(),/INVALID_ORIGINAL_SIDECAR_getBlock/);
});
test('06 wrong independently pinned genesis refuses the producer',async t=>{
  const x=sample(t);
  await assert.rejects(verifyProducerHistoryInput({
    directory:x.dir,expectedGenesisHash:'wrong',expectedFromSlot:17,expectedToSlot:17}),
    /SOURCE_BOUNDS_CHANGED/);
});
test('07 original RPC error is not promoted into full-history proof',async t=>{
  const x=sample(t),file=join(x.dir,'rpc/a-finalized-tip.rpc.json');
  const source=JSON.parse(readFileSync(file,'utf8'));
  source.response.error={code:-32000,message:'unavailable'};
  writeFileSync(file,JSON.stringify(source));
  await assert.rejects(x.verify(),/INVALID_ORIGINAL_SIDECAR_getSlot/);
});
