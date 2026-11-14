/**
 * P0 original-artifact, pinned-Kit queueVerified acceptance. This uses genuine
 * immutable local-validator JSON-RPC replies, REPLAYED OFFLINE, not a live RPC,
 * independently verified consensus, or a Holochain write. No synthetic deposit.
 *
 * CI must set OBS_ORIGINAL_ARCHIVE_DIR to the original artifact's
 * localnet-evidence/ directory and OBS_REQUIRE_ORIGINAL_OUTBOX=1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DepositLedger} from '../src/ledger.mjs';
import {DemoOutbox,DENIALS,ROLLBACK_HOLD} from '../src/demo-outbox.mjs';
import {fetchFinalizedTransaction} from '../src/indexer.mjs';
import {verifyDepositCandidates,attachReceiptObservation} from '../src/transaction.mjs';
import {observeRpc,reconcileObservations} from '../src/verify.mjs';

const dir=process.env.OBS_ORIGINAL_ARCHIVE_DIR;
const required=process.env.OBS_REQUIRE_ORIGINAL_OUTBOX==='1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const ORIG_MANIFEST='83ccf38aeee9e11b2f193f3894f1869cd1b1c1edc506130422489b2bbcc5f63d';
const rpcs=['https://source-a.invalid','https://source-b.invalid'];
const json=(name)=>JSON.parse(readFileSync(join(dir,name),'utf8'));
function original(){
  assert.ok(dir,'OBS_ORIGINAL_ARCHIVE_DIR missing: original-artifact test not executed');
  const mf=readFileSync(join(dir,'evidence-manifest.sha256'));
  assert.equal(sha(mf),ORIG_MANIFEST,'must pin complete original file manifest');
  let count=0;
  for(const line of mf.toString('utf8').trim().split(/\r?\n/)){
    const matched=/^([a-f0-9]{64})  \.\/(.+)$/.exec(line);
    assert.ok(matched&&!matched[2].includes('..'),'malformed evidence manifest');
    assert.equal(sha(readFileSync(join(dir,matched[2]))),matched[1],
      'original source changed: '+matched[2]); count++;
  }
  assert.equal(count,246);
  const active=json('active-receipt.json');
  const signature=active.signatures.deposit;
  const tx=json('lifecycle-getTransaction-base64-'+signature+'.rpc.json').result;
  const block=json('lifecycle-getBlock-base64-17.rpc.json').result;
  const snapshot=json(active.getMultipleAccountsRawFile).result;
  const idlBytes=readFileSync(join(dir,'../idl/deposit_prototype.json'));
  const elfBytes=readFileSync(join(dir,'../deploy/deposit_prototype.so'));
  assert.equal(sha(idlBytes),active.idlSha256);
  assert.equal(sha(elfBytes),active.elfSha256);
  assert.equal(tx.slot,17);
  assert.equal(sha(Buffer.from(tx.transaction[0],'base64')),
    '3dd6b979a6a08f8fe8680de041787234b91d4ff09232b8e8e57fdc3ce439dd98');
  const receiptAddress=active.accounts[0].address;
  const expected={program:active.programId,mint:active.accounts[3].address,
    config:active.accounts[1].address,vault:active.accounts[2].address,
    scope:'07'.repeat(32),idlSha256:active.idlSha256};
  return {active,signature,tx,block,snapshot,idl:JSON.parse(idlBytes),
    expected,receiptAddress};
}
function archivedRpc(data,mutate=()=>{}){
  const copy=structuredClone({tx:data.tx,block:data.block,snapshot:data.snapshot});
  mutate(copy);
  const methods=[];
  const fetchFn=async (_url,{body})=>{
    const req=JSON.parse(body);methods.push(req.method);
    assert.equal(req.jsonrpc,'2.0');
    let result;
    switch(req.method){
      case 'getGenesisHash':result=data.active.genesisHash;break;
      case 'getTransaction':result=copy.tx;break;
      case 'getBlock':result=copy.block;break;
      case 'getMultipleAccounts':
        assert.deepEqual(req.params[0],data.active.accounts.map(x=>x.address));
        result=copy.snapshot;break;
      default:throw Error('unexpected archive RPC method '+req.method);
    }
    return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
  };
  return {fetchFn,methods};
}
async function setup(t){
  const data=original();
  const root=mkdtempSync(join(tmpdir(),'obs-original-outbox-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const {fetchFn}=archivedRpc(data);
  const fetched=await fetchFinalizedTransaction({rpcUrl:rpcs[0],
    signature:data.signature,genesisHash:data.active.genesisHash,fetchFn});
  const candidates=await verifyDepositCandidates({
    rpcTransaction:fetched.rpcTransaction,signature:data.signature,
    expected:data.expected,genesisHash:data.active.genesisHash,idl:data.idl,
    finalizedClaim:fetched.finalizedClaim,blockhash:fetched.blockhash,
    source:'observer_reviewed_demo_original_rpc',
  });
  const matches=candidates.filter(x=>x.receiptAddress===data.receiptAddress);
  assert.equal(matches.length,1,'must have exact genuine deposit instruction occurrence');
  const snapshots=await Promise.all(rpcs.map(rpcUrl=>observeRpc({
    rpcUrl,expected:{...data.expected,receipt:data.receiptAddress},
    genesisHash:data.active.genesisHash,fetchFn,
  })));
  const evidence=attachReceiptObservation(matches[0],reconcileObservations(...snapshots));
  const ledger=new DepositLedger(join(root,'ledger.json'),{
    genesisHash:data.active.genesisHash,program:data.expected.program,trustedDeploymentSlot:5});
  t.after(()=>ledger.close());
  ledger.commit({checkpoint:data.tx.slot,evidence:[evidence]});
  const destination={dnaHash:'CONTROLLED_TEST_ONLY_DNA_NOT_INSTALLED',
    agentKey:'CONTROLLED_TEST_ONLY_AGENT',appId:'observer-audit-demo',
    role:'audit',zome:'solana_audit'};
  const outbox=new DemoOutbox(join(root,'outbox.json'),{
    expected:{genesisHash:data.active.genesisHash,program:data.expected.program,
      mint:data.expected.mint,holochainScope:data.expected.scope},
    destination});
  t.after(()=>outbox.close());
  const queue=(fetchFn)=>outbox.queueVerified({
    ledger,rpcUrls:rpcs,signature:data.signature,receiptAddress:data.receiptAddress,
    expected:data.expected,idl:data.idl,codeVersion:'original-validator-source-'+data.active.sourceCommitSha,
    fetchFn,
  });
  return {data,ledger,outbox,evidence,queue};
}
// Generic npm test without the external artifact is not acceptance. The
// dedicated npm run test:original-outbox sets OBS_REQUIRE_ORIGINAL_OUTBOX=1.
test('genuine original Kit-backed outbox admission is mandatory when requested',
  {skip:!dir&&!required}, async t=>{
    const {data,outbox,queue,evidence}=await setup(t);
    const rpc=archivedRpc(data);
    assert.equal(await queue(rpc.fetchFn),'pending');
    assert.equal(await queue(rpc.fetchFn),'pending','same source/occurrence idempotent');
    assert.ok(rpc.methods.includes('getTransaction'));
    assert.ok(rpc.methods.includes('getBlock'));
    assert.ok(rpc.methods.includes('getMultipleAccounts'));
    const row=outbox.state.rows[evidence.id];
    assert.equal(row.observation.proof.evidenceOrigin,'observer_reviewed_outbox');
    assert.equal(row.observation.source.occurrenceId,evidence.occurrenceId);
    assert.equal(row.observation.source.witnessDigest.length,64);
    assert.equal(outbox.status.rollbackSecurityHold,ROLLBACK_HOLD);
    for(const [k,v] of Object.entries(DENIALS))assert.equal(row.observation[k],v);
  });
test('genuine replay refuses modified wire, containing metadata, receipt or source ledger',
  {skip:!dir&&!required},async t=>{
    const {data,outbox,queue,ledger,evidence}=await setup(t);
    const mutations=[
      ['signed-wire',x=>{const b=Buffer.from(x.tx.transaction[0],'base64');
        b[b.length-1]^=1;x.tx.transaction[0]=b.toString('base64');}],
      ['block-fee',x=>{const b=x.block.transactions.find(z=>
        z.transaction[0]===data.tx.transaction[0]);b.meta.fee+=1;}],
      ['recipient-receipt',x=>{const b=Buffer.from(x.snapshot.value[0].data[0],'base64');
        b[136]^=1;x.snapshot.value[0].data[0]=b.toString('base64');}],
      ['missing-account',x=>{x.snapshot.value[3]=null;}],
    ];
    for(const [name,mutate] of mutations){
      await assert.rejects(queue(archivedRpc(data,mutate).fetchFn),
        undefined,'must refuse original archive mutation: '+name);
      assert.deepEqual(outbox.status.rows,{},'failed replay did not enqueue '+name);
    }
    delete ledger.state.processed[evidence.id];
    await assert.rejects(queue(archivedRpc(data).fetchFn),/MISSING_DURABLE_SOURCE/,
      'verified RPC claim without original durable source is insufficient');
    assert.deepEqual(outbox.status.rows,{});
  });
