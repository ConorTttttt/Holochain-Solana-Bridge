/** Synthetic boundary tests ONLY. These do not replace real @solana/kit replay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DepositLedger} from '../src/ledger.mjs';
import {DemoOutbox,ROLLBACK_HOLD,canonicalJSON,domainDigest,DENIALS} from '../src/demo-outbox.mjs';
process.env.DEMO_ALLOW_TEST_ONLY_FIXTURE='1'; // test process only; never production origin
const genesisHash='1'.repeat(32),program='1'.repeat(32),mint='1'.repeat(32);
const holochainScope='07'.repeat(32),receiptAddress='1'.repeat(32),depositor='1'.repeat(32);
const signature='1'.repeat(64);
const expected={genesisHash,program,mint,holochainScope};
const destination={dnaHash:'uhCkk-demo-dna',agentKey:'uhCAk-demo-agent',appId:'observer-controlled-audit-demo',role:'audit',zome:'solana_audit'};
const hash=x=>createHash('sha256').update(x).digest('hex');
function make(t){
  const dir=mkdtempSync(join(tmpdir(),'obs-demo-outbox-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const ledger=new DepositLedger(join(dir,'ledger.json'),{genesisHash,program,trustedDeploymentSlot:5});
  const path=join(dir,'outbox.json');
  const outbox=new DemoOutbox(path,{expected,destination});
  t.after(()=>{try{outbox.close()}catch{};try{ledger.close()}catch{}});
  const wire=Buffer.from('SYNTHETIC_ONLY_NOT_A_SOLANA_TRANSACTION');
  const tx={slot:17,version:'legacy',meta:{err:null,rewards:null,fee:5000},transaction:[wire.toString('base64'),'base64']};
  const common={id:`${genesisHash}:${program}:${receiptAddress}`,program,mint,receiptAddress,
    holochainScope,depositor,recipientCore:'ab'.repeat(32),depositNonce:'42017',amountBaseUnits:'250000'};
  const snap={kind:'solana-receipt-observation-v1',...common,genesisHash,finalizedSlot:18,
    refunded:false,transactionVerified:false,...DENIALS};
  const evidence={kind:'solana-deposit-evidence-v1',...common,
    occurrenceId:`${genesisHash}:${program}:${signature}:outer:0`,signature,
    transactionVersion:'legacy',instructionPath:'outer:0',transactionHash:hash(wire),
    finalizedSlot:17,observationSlot:18,receiptSnapshot:snap,refundedAtObservation:false,
    transactionVerified:true,verifiedByRpcClaim:true,...DENIALS};
  ledger.commit({checkpoint:17,evidence:[evidence]});
  const queue=(e=evidence,trans=tx)=>outbox.queueSyntheticFixture({ledger,evidence:e,rpcTransaction:trans,codeVersion:'obs-review-2931c5fc'});
  return {dir,path,ledger,outbox,evidence,tx,queue};
}
function remote(){
  const records=new Map();let writes=0,reads=0;
  return {records,get writes(){return writes},get reads(){return reads},
    async preflight(){return structuredClone(destination)},
    async read(id){reads++;return structuredClone(records.get(id)||null)},
    async write(item){writes++;const data={actionHash:'uhCkk-SYNTHETIC_ACTION_HASH',observation:structuredClone(item),...DENIALS};
      records.set(item.source.id,data);return {actionHash:data.actionHash};},
  };
}
test('01 canonical JSON is deterministic across key insertion order',()=>{
  assert.equal(canonicalJSON({z:1,a:{q:'x',b:false}}),canonicalJSON({a:{b:false,q:'x'},z:1}));
  assert.equal(domainDigest('domain',{x:1}),domainDigest('domain',{x:1}));
  assert.notEqual(domainDigest('other',{x:1}),domainDigest('domain',{x:1}));
});
test('02 queue requires exact live durable source ledger; no caller JSON-only promotion',t=>{
  const {outbox,evidence,tx,queue}=make(t);
  assert.throws(()=>outbox.queueSyntheticFixture({ledger:JSON.parse('{}'),evidence,rpcTransaction:tx,codeVersion:'X'}),/LIVE_SOURCE_LEDGER_REQUIRED/);
  assert.equal(queue(),'pending');
  assert.equal(outbox.status.rollbackSecurityHold,ROLLBACK_HOLD);
  const row=Object.values(outbox.state.rows)[0];
  assert.equal(row.observation.proof.evidenceOrigin,'test_only_fixture');
  assert.equal(row.observation.proof.historyComplete,false);
  assert.deepEqual(Object.fromEntries(Object.entries(DENIALS).map(([k])=>[k,row.observation[k]])),DENIALS);
});
test('03 duplicate original evidence is idempotent; conflicting source ID/fingerprint is refused',t=>{
  const {queue,evidence}=make(t);
  assert.equal(queue(),'pending');assert.equal(queue(),'pending');
  assert.throws(()=>queue({...evidence,amountBaseUnits:'250001'}),/SNAPSHOT_FIELD_amountBaseUnits|DURABLE_SOURCE_CONFLICT/);
});
test('04 genuine refund cannot be put into deposit-only outbox ABI',t=>{
  const {queue,evidence}=make(t);
  assert.throws(()=>queue({...evidence,kind:'solana-refund-evidence-v1'}),/NOT_VERIFIED_ACTIVE_DEPOSIT/);
  assert.throws(()=>queue({...evidence,refundedAtObservation:true}),/NOT_VERIFIED_ACTIVE_DEPOSIT/);
});
test('05 mutated original signed-wire bytes fail before enqueue',t=>{
  const {queue,tx}=make(t);
  assert.throws(()=>queue(undefined,{...tx,transaction:[Buffer.from('different wire').toString('base64'),'base64']}),/SIGNED_WIRE_HASH/);
});
test('06 changed RPC execution metadata changes witness fingerprint',t=>{
  const {queue,tx}=make(t);
  queue();assert.throws(()=>queue(undefined,{...tx,meta:{...tx.meta,fee:6000}}),/SOURCE_FINGERPRINT_CONFLICT/);
});
test('07 signed write persists uncertain first; readback action hash ACK',async t=>{
  const {outbox,evidence,queue,path}=make(t);queue();const client=remote();
  const write=client.write.bind(client);
  client.write=async(...args)=>{assert.equal(JSON.parse(readFileSync(path,'utf8')).rows[evidence.id].state,'uncertain');return write(...args)};
  assert.equal(await outbox.deliver(evidence.id,client),'acked');
  assert.equal(client.writes,1);assert.equal(outbox.status.rows[evidence.id].state,'acked');
  assert.equal(outbox.status.rows[evidence.id].actionHash,'uhCkk-SYNTHETIC_ACTION_HASH');
});
test('08 crash after uncertain is recoverable without blind second signed write',async t=>{
  const {outbox,queue,evidence,path}=make(t);queue();const client=remote();
  assert.equal(await outbox.deliver(evidence.id,client,{crashAt:'after_uncertain'}),'uncertain');
  assert.equal(JSON.parse(readFileSync(path,'utf8')).rows[evidence.id].state,'uncertain');
  assert.equal(await outbox.deliver(evidence.id,client),'hold');assert.equal(client.writes,0);
});
test('09 crash after remote signed write reconciles typed readback, no duplicate',async t=>{
  const {outbox,queue,evidence}=make(t);queue();const client=remote();
  assert.equal(await outbox.deliver(evidence.id,client,{crashAt:'after_signed_write'}),'uncertain');
  assert.equal(client.writes,1);
  assert.equal(await outbox.reconcile(evidence.id,client),'acked');assert.equal(client.writes,1);
});
test('10 reopen after ACK remains terminal; no duplicate write',async t=>{
  const {path,outbox,evidence,queue}=make(t);queue();const client=remote();
  await outbox.deliver(evidence.id,client);outbox.close();
  const resumed=new DemoOutbox(path,{expected,destination});
  assert.equal(await resumed.deliver(evidence.id,client),'acked');assert.equal(client.writes,1);resumed.close();
});
test('11 wrong DNA/agent fails closed before write',async t=>{
  const {outbox,evidence,queue}=make(t);queue();const client=remote();
  client.preflight=async()=>({...destination,dnaHash:'wrong-dna'});
  assert.equal(await outbox.deliver(evidence.id,client),'pending');assert.equal(client.writes,0);
});
test('12 missing Holochain availability leaves a replay-safe pending item',async t=>{
  const {outbox,evidence,queue}=make(t);queue();const client=remote();
  client.preflight=async()=>{throw Error('offline')};
  assert.equal(await outbox.deliver(evidence.id,client),'pending');assert.equal(client.writes,0);
});
test('13 conflicting target record / changed occurrence cannot ACK',async t=>{
  const {outbox,evidence,queue}=make(t);queue();const client=remote();
  client.records.set(evidence.id,{actionHash:'signed-wrong',observation:{...outbox.state.rows[evidence.id].observation,
    source:{...outbox.state.rows[evidence.id].observation.source,occurrenceId:'wrong'}},...DENIALS});
  assert.equal(await outbox.deliver(evidence.id,client),'pending');assert.equal(client.writes,0);
});
test('14 mutated durable outbox fingerprint rejected on restart',t=>{
  const {path,outbox,queue}=make(t);queue();outbox.close();
  const x=JSON.parse(readFileSync(path,'utf8'));x.rows[Object.keys(x.rows)[0]].observation.source.amountBaseUnits='123';
  writeFileSync(path,JSON.stringify(x));
  assert.throws(()=>new DemoOutbox(path,{expected,destination}),/WITNESS_CHANGED|WORK_FINGERPRINT/);
});
test('15 intact old-file rollback remains a known hostile-host weakness and security HOLD',async t=>{
  const {path,outbox,evidence,queue}=make(t);queue();const old=readFileSync(path,'utf8');
  const client=remote();await outbox.deliver(evidence.id,client);outbox.close();
  writeFileSync(path,old);
  const reverted=new DemoOutbox(path,{expected,destination});
  assert.equal(reverted.status.rows[evidence.id].state,'pending');
  assert.equal(reverted.status.rollbackSecurityHold,ROLLBACK_HOLD);
  assert.equal(reverted.status.creditEligible,false);reverted.close();
});
test('16 journal destination scope changes refuse before replay',t=>{
  const {path,outbox,queue}=make(t);queue();outbox.close();
  assert.throws(()=>new DemoOutbox(path,{expected,destination:{...destination,agentKey:'other'}}),/JOURNAL_SCOPE/);
});
test('17 remote readback with wrong denial flags never ACKs',async t=>{
  const {outbox,evidence,queue}=make(t);queue();const client=remote();
  client.records.set(evidence.id,{actionHash:'signed',observation:outbox.state.rows[evidence.id].observation,
    ...DENIALS,creditEligible:true});
  assert.equal(await outbox.deliver(evidence.id,client),'pending');
  assert.equal(client.writes,0);
});
test('18 signed write response mismatched readback ActionHash stays uncertain',async t=>{
  const {outbox,evidence,queue}=make(t);queue();const client=remote();
  const orig=client.write.bind(client);client.write=async (...args)=>{await orig(...args);return {actionHash:'not-the-readback-action'}};
  assert.equal(await outbox.deliver(evidence.id,client),'uncertain');
  assert.equal(await outbox.reconcile(evidence.id,client),'acked');assert.equal(client.writes,1);
});
test('19 arbitrary JSON cannot claim reviewed provenance via production queue API',async t=>{
  const {outbox,ledger,evidence,tx}=make(t);
  await assert.rejects(outbox.queueVerified({ledger,evidence,rpcTransaction:tx,
    codeVersion:'caller-says-reviewed'}),/TWO_RPC_URLS_REQUIRED/);
  assert.deepEqual(outbox.status.rows,{});
});
test('20 synthetic fixtures require explicit test-only opt-in and cannot become reviewed',t=>{
  const {outbox,ledger,evidence,tx}=make(t);
  const value=process.env.DEMO_ALLOW_TEST_ONLY_FIXTURE;
  delete process.env.DEMO_ALLOW_TEST_ONLY_FIXTURE;
  try{
    assert.throws(()=>outbox.queueSyntheticFixture({ledger,evidence,rpcTransaction:tx,codeVersion:'fixture'}),
      /SYNTHETIC_DISABLED/);
    assert.deepEqual(outbox.status.rows,{});
  }finally{process.env.DEMO_ALLOW_TEST_ONLY_FIXTURE=value}
});
test('21 exact A4 v1 record is root/source/proof, not A1 witness/destination',t=>{
  const {outbox,queue}=make(t);queue();
  const item=Object.values(outbox.state.rows)[0].observation;
  assert.deepEqual(Object.keys(item).sort(),[
    'kind','schemaVersion','source','proof',...Object.keys(DENIALS)].sort());
  assert.equal(item.source.instructionIndex,0);
  assert.equal(item.source.sourceEventType,'deposit');
  assert.equal(item.proof.historyComplete,false);
  assert.equal('witness' in item,false);assert.equal('destination' in item,false);
  assert.equal(outbox.status.rollbackSecurityHold,ROLLBACK_HOLD);
});

function queueSecondSource({outbox,ledger,tx,evidence}) {
  const secondReceipt='1'.repeat(31)+'2';
  const id=`${genesisHash}:${program}:${secondReceipt}`;
  const second={...evidence,id,receiptAddress:secondReceipt,
    instructionPath:'outer:1',
    occurrenceId:`${genesisHash}:${program}:${signature}:outer:1`,
    receiptSnapshot:{...evidence.receiptSnapshot,id,receiptAddress:secondReceipt}};
  ledger.commit({checkpoint:18,evidence:[second]});
  assert.equal(outbox.queueSyntheticFixture({ledger,evidence:second,rpcTransaction:tx,
    codeVersion:'obs-review-2931c5fc'}),'pending');
  return second;
}
test('22 overlapping async signed deliveries of same source are refused',async t=>{
  const {outbox,evidence,queue}=make(t);queue();
  const client=remote();let release,entered;
  const enteredPromise=new Promise(resolve=>{entered=resolve});
  const original=client.write.bind(client);
  client.write=async(...args)=>{
    entered();await new Promise(resolve=>{release=resolve});
    return original(...args);
  };
  const first=outbox.deliver(evidence.id,client);
  await enteredPromise;
  await assert.rejects(outbox.deliver(evidence.id,client),/CONCURRENT_DELIVERY/);
  release();
  assert.equal(await first,'acked');assert.equal(client.writes,1);
});
test('23 two independent receipt sources deliver out of order without conflation',async t=>{
  const {outbox,ledger,tx,evidence,queue}=make(t);queue();
  const second=queueSecondSource({outbox,ledger,tx,evidence});
  const client=remote();const original=client.write.bind(client);
  client.write=async(item,...args)=>{
    await original(item,...args);
    const actionHash='uhCkk-UNIQUE-MOCK-'+item.source.instructionIndex;
    client.records.get(item.source.id).actionHash=actionHash;
    return {actionHash};
  };
  assert.equal(await outbox.deliver(second.id,client),'acked');
  assert.equal(await outbox.deliver(evidence.id,client),'acked');
  assert.equal(client.writes,2);
  assert.equal(outbox.status.rows[second.id].actionHash,'uhCkk-UNIQUE-MOCK-1');
  assert.equal(outbox.status.rows[evidence.id].actionHash,'uhCkk-UNIQUE-MOCK-0');
});
test('24 reused remote ActionHash across separate sources refuses second ACK',async t=>{
  const {outbox,ledger,tx,evidence,queue}=make(t);queue();
  const second=queueSecondSource({outbox,ledger,tx,evidence});
  const client=remote();
  assert.equal(await outbox.deliver(evidence.id,client),'acked');
  assert.equal(await outbox.deliver(second.id,client),'uncertain');
  assert.equal(await outbox.reconcile(second.id,client),'hold');
  assert.equal(outbox.status.rows[evidence.id].state,'acked');
  assert.equal(outbox.status.rows[second.id].state,'hold');
});
test('25 wrong destination AGENT refuses before signed write',async t=>{
  const {outbox,evidence,queue}=make(t);queue();
  const client=remote();
  client.preflight=async()=>({...destination,agentKey:'different-agent'});
  assert.equal(await outbox.deliver(evidence.id,client),'pending');
  assert.equal(client.writes,0);
});
test('26 Holochain outage during uncertain reconciliation becomes durable hold',async t=>{
  const {outbox,evidence,queue}=make(t);queue();
  const client=remote();
  assert.equal(await outbox.deliver(evidence.id,client,{crashAt:'after_uncertain'}),'uncertain');
  client.preflight=async()=>{throw Error('conductor offline')};
  assert.equal(await outbox.reconcile(evidence.id,client),'hold');
  assert.equal(client.writes,0);
});
test('27 same receipt with different instruction occurrence refuses source rewrite',t=>{
  const {queue,evidence}=make(t);queue();
  assert.throws(()=>queue({...evidence,instructionPath:'outer:1',
    occurrenceId:`${genesisHash}:${program}:${signature}:outer:1`}),/DURABLE_SOURCE_CONFLICT/);
});
