/**
 * CI-only ORIGINAL Solana #55 disposable demo-domain -> genuine OBS #52 v2.
 * No synthesized transaction, no authenticated independent RPC quorum, no
 * Holochain transport, ActionHash, refund-history coverage or credit.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fetchFinalizedTransaction} from '../../observer/src/indexer.mjs';
import {verifyDepositCandidates,attachReceiptObservation} from '../../observer/src/transaction.mjs';
import {verifySnapshot} from '../../observer/src/verify.mjs';
import {DepositLedger} from '../../observer/src/ledger.mjs';
import {DemoOutbox} from '../../observer/src/demo-outbox.mjs';
import {verifyReviewedWitnessV2} from '../../observer/src/demo-witness-v2.mjs';
import {assertDemoDomainShape} from '../../tests/solana/demo-scope.mjs';

const root='target/localnet-evidence/';
const load=n=>{
 assert.match(n,/^[a-zA-Z0-9-]+(?:\\.rpc)?\\.json$/,'UNSAFE_ARCHIVE_POINTER');
 return JSON.parse(readFileSync(root+n,'utf8'));
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const shaCheckout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const d=load('demo-source-domain.json');
assertDemoDomainShape(d);
assert.equal(d.sourceCommitSha,shaCheckout,'DEMO_DOMAIN_NOT_SAME_SHA');
assert.equal(readFileSync(root+'source-commit.txt','utf8').trim(),shaCheckout,'SOL_PRODUCER_NOT_SAME_SHA');
const idlText=readFileSync('target/idl/deposit_prototype.json','utf8');
assert.equal(sha(idlText),d.idlSha256,'GENERATED_IDL_HASH_DRIFT');
assert.equal(sha(readFileSync('target/deploy/deposit_prototype.so')),d.elfSha256,
  'COMPILED_SBPF_HASH_DRIFT');
const archive=load(d.witnessBundle);
assert.equal(archive.mode,'demo-domain');
assert.equal(archive.sourceCommitSha,shaCheckout);
assert.equal(archive.complete,true);
const deposit=d.transactions.deposit;
const original=archive.finalized.find(x=>x.signature===deposit.signature);
assert.ok(original,'ORIGINAL_FINALIZED_DEPOSIT_MISSING');
assert.equal(original.getTransactionBase64RawFile,deposit.getTransactionBase64RawFile);
assert.equal(original.getBlockBase64RawFile,deposit.getBlockBase64RawFile);
const txEnvelope=load(deposit.getTransactionBase64RawFile);
const blockEnvelope=load(deposit.getBlockBase64RawFile);
const tx=txEnvelope.result,block=blockEnvelope.result;
assert.ok(tx?.transaction?.[0]&&block?.transactions,'ORIGINAL_SIGNED_RPC_MISSING');
assert.equal(tx.slot,deposit.slot);
assert.equal(block.blockhash,original.blockhash);
const raw=Buffer.from(tx.transaction[0],'base64');
assert.ok(raw.length>64&&raw.toString('base64')===tx.transaction[0],'INVALID_SIGNED_WIRE');
assert.ok(archive.transactions.some(x=>x.signature===deposit.signature&&
  x.signedWireBase64===tx.transaction[0]),'SIGNED_ORIGINAL_SUBMISSION_MISMATCH');
const snap=load(d.snapshots.active);
assert.deepEqual(snap.accounts.map(x=>x.address),[d.receipt,d.config,d.vault,d.mint]);
assert.equal(snap.sourceCommitSha,shaCheckout);
assert.equal(snap.signatures.deposit,deposit.signature);
assert.ok(snap.slot>=deposit.slot,'ACTIVE_SNAPSHOT_PREDATES_DEPOSIT');
const originalAccountsRpc=load(snap.getMultipleAccountsRawFile);
assert.deepEqual(originalAccountsRpc.result.value.map(x=>x.data?.[0]),
  snap.accounts.map(x=>x.dataBase64),'ARCHIVED_ACCOUNT_RPC_MISMATCH');
const expected={program:d.programId,mint:d.mint,config:d.config,vault:d.vault,scope:d.scopeHex};
const snapshotExpected={...expected,receipt:d.receipt};
const originalSnapshot=await verifySnapshot({
  snapshot:{slot:snap.slot,accounts:snap.accounts.map(x=>({
    owner:x.owner,raw:Buffer.from(x.dataBase64,'base64'),
  }))},expected:snapshotExpected,genesisHash:d.genesisHash,
  source:'same-sha-original-demo-domain-snapshot',
});
assert.equal(originalSnapshot.refunded,false,'SOURCE_DEPOSIT_ALREADY_REFUNDED');
// Re-expose only ORIGINAL captured JSON-RPC results to the production
// @solana/kit verifier. Two URLs are two replay names, not independent RPCs.
const archivedRpc=async(url,opts)=>{
 const request=JSON.parse(opts.body);
 assert.equal(request.jsonrpc,'2.0');
 const method=request.method;
 let result;
 if(method==='getGenesisHash')result=d.genesisHash;
 else if(method==='getTransaction'){
   assert.equal(request.params[0],deposit.signature);
   assert.equal(request.params[1].encoding,'base64');
   result=tx;
 }else if(method==='getBlock'){
   assert.equal(request.params[0],deposit.slot);
   assert.equal(request.params[1].encoding,'base64');
   result=block;
 }else if(method==='getMultipleAccounts'){
   assert.deepEqual(request.params[0],[d.receipt,d.config,d.vault,d.mint]);
   assert.equal(request.params[1].commitment,'finalized');
   result=originalAccountsRpc.result;
 }else throw Error('UNEXPECTED_ARCHIVED_RPC:'+method);
 assert.ok(url==='http://127.0.0.1:8899'||url==='http://127.0.0.1:9900');
 return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:structuredClone(result)})};
};
const verified=await fetchFinalizedTransaction({
 rpcUrl:'http://127.0.0.1:8899',signature:deposit.signature,
 genesisHash:d.genesisHash,fetchFn:archivedRpc,
});
assert.equal(verified.creditEligible,false);
const idl=JSON.parse(idlText);
const candidates=await verifyDepositCandidates({
 rpcTransaction:verified.rpcTransaction,signature:deposit.signature,
 expected,genesisHash:d.genesisHash,idl,finalizedClaim:true,
 blockhash:verified.blockhash,source:'observer_reviewed_demo_original_rpc',
});
const candidate=candidates.find(x=>x.receiptAddress===d.receipt);
assert.ok(candidate,'ORIGINAL_SIGNED_DEPOSIT_NOT_ATTRIBUTED');
assert.equal(candidate.amountBaseUnits,d.amountBaseUnits);
assert.equal(candidate.depositNonce,d.nonce);
assert.equal(candidate.recipientCore,d.recipientCoreHex);
const evidence=attachReceiptObservation(candidate,originalSnapshot);
assert.equal(evidence.refundedAtObservation,false);
const temp=mkdtempSync(join(tmpdir(),'hsc-a1-own-demo-domain-v2-'));
const ledgerPath=join(temp,'ledger.json');
const outboxPath=join(temp,'outbox.json');
const target={dnaHash:'OWN_DNA_NOT_COMPILED_OR_INSTALLED',
 agentKey:'OWN_DNA_SIGNER_NOT_CONFIGURED',
 appId:'hsc-a1-audit-outbox-pending',role:'audit',zome:'solana_audit'};
const sourcePins={genesisHash:d.genesisHash,program:d.programId,
 mint:d.mint,holochainScope:d.scopeHex,idlSha256:d.idlSha256,
 sourceCommitSha:shaCheckout};
const queueArgs={rpcUrls:['http://127.0.0.1:8899','http://127.0.0.1:9900'],
 signature:deposit.signature,receiptAddress:d.receipt,
 expected,idlText,codeVersion:shaCheckout,fetchFn:archivedRpc};
const old=process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
let finalWitness;
let denial;
try{
 const ledger=new DepositLedger(ledgerPath,{genesisHash:d.genesisHash,
  program:d.programId,trustedDeploymentSlot:d.transactions.initialize.slot});
 try{
  const commit=ledger.commit({checkpoint:deposit.slot,
   block:{slot:deposit.slot,blockhash:verified.blockhash},evidence:[evidence]});
  assert.equal(commit.processed,1);
  const outbox=new DemoOutbox(outboxPath,{expected:sourcePins,destination:target});
  process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY='1';
  try{
   assert.equal(await outbox.queueVerified({ledger,...queueArgs}),'pending');
   assert.equal(await outbox.queueVerified({ledger,...queueArgs}),'pending');
   const row=outbox.state.rows[evidence.id];
   assert.equal(row.observation.proof.evidenceOrigin,'observer_reviewed_outbox');
   finalWitness=row.reviewedWitnessV2;
   assert.ok(verifyReviewedWitnessV2(finalWitness));
   assert.equal(finalWitness.source.depositNonce,d.nonce);
   assert.equal(finalWitness.source.recipientCore,d.recipientCoreHex);
   assert.equal(finalWitness.source.holochainScope,d.scopeHex);
   assert.equal(finalWitness.source.signature,deposit.signature);
   assert.equal(finalWitness.source.blockhash,verified.blockhash);
   assert.equal(finalWitness.proof.historyComplete,false);
   assert.equal(outbox.status.rollbackSecurityHold,'HOSTILE_FILE_ROLLBACK_UNPROTECTED');
   const sourceId=evidence.id;
   await assert.rejects(outbox.queueVerified({ledger,...queueArgs,
    expected:{...expected,scope:'f'.repeat(64)}}),/PINNED_DEPLOYMENT_MISMATCH/);
   await assert.rejects(outbox.queueVerified({ledger,...queueArgs,
    idlText:idlText+' '}),/PINNED_IDL_BYTES_REQUIRED/);
   await assert.rejects(outbox.deliver(sourceId,{
    preflight:async()=>target,read:async()=>null,
    write:async()=>{throw Error('MUST_NOT_TOUCH_HOLOCHAIN_ZOME')},
   }),/REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED/);
   await assert.rejects(outbox.reconcile(sourceId,{
    preflight:async()=>target,read:async()=>null,
   }),/REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED/);
   denial='REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED';
   assert.equal(outbox.status.rows[sourceId].state,'pending');
  }finally{outbox.close();}
 }finally{ledger.close();}
 const reopened=new DemoOutbox(outboxPath,{expected:sourcePins,destination:target});
 try{assert.equal(reopened.status.rows[evidence.id].state,'pending');}
 finally{reopened.close();}
}finally{
 if(old===undefined)delete process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
 else process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY=old;
 rmSync(temp,{recursive:true,force:true});
}
assert.ok(finalWitness);
for(const obj of [finalWitness,finalWitness.source,finalWitness.proof]){
 assert.equal(obj.creditEligible,false);assert.equal(obj.independentConsensusVerified,false);
 assert.equal(obj.spendableBaseUnits,'0');assert.equal(obj.withdrawalAuthorized,false);
}
const actualRefundSnapshot=load(d.snapshots.refunded);
assert.ok(actualRefundSnapshot.slot>=d.transactions.refund.slot);
assert.equal(actualRefundSnapshot.signatures.refund,d.transactions.refund.signature);
assert.equal(actualRefundSnapshot.creditEligible,false);
mkdirSync('ci-artifacts',{recursive:true});
const file='ci-artifacts/observer-fresh-domain-reviewed-v2-original-signed-localnet.json';
const bytes=Buffer.from(JSON.stringify({
 schema:'hsc-a1-same-sha-fresh-signed-source-v2-queued-not-delivered',
 immutableSourceCommitSha:shaCheckout,
 originalSolanaDomain:d,
 originalSignedTransactionSha256:sha(raw),
 originalContainingBlockhash:block.blockhash,
 observerReviewedWitnessV2:finalWitness,
 durableOutboxReopened:'pending',
 noHolochainAck:true,transportRefusal:denial,
 independentRpcConsensusVerified:false,
 refundOriginalSignedWitnessArchived:true,
 refundHistoryComplete:false,
 destinationReadback:{state:'not_approved_or_written',actionHash:null},
 creditEligible:false,independentConsensusVerified:false,
 spendableBaseUnits:'0',withdrawalAuthorized:false,
},null,2)+'\n');
writeFileSync(file,bytes,{mode:0o600});
writeFileSync(file+'.sha256',sha(bytes)+'  '+file.split('/').pop()+'\n',{mode:0o600});
console.log('FRESH_DEMO_DOMAIN_ORIGINAL_KIT_V2_QUEUED_NOT_DELIVERED',
 shaCheckout,d.scopeHex,deposit.signature,finalWitness.witnessDigest,
 'HISTORY_INCOMPLETE',denial);
