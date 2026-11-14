/** Synthetic digest-schema negatives only; not real Kit or HAM acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalV2,calculateV2CandidateDigest} from '../src/v2-proof-contract.mjs';
const denials={creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false};
const pub='1'.repeat(32),sig='1'.repeat(64),scope='07'.repeat(32);
function fake(){
  const source={...denials,sourceEventType:'deposit',genesisHash:pub,program:pub,
    mint:pub,holochainScope:scope,receiptAddress:pub,depositor:pub,
    recipientCore:'09'.repeat(32),depositNonce:'42017',amountBaseUnits:'250000',
    configAddress:pub,vaultAddress:pub,sourceTokenAccount:pub,signature:sig,
    transactionVersion:'legacy',finalizedSlot:17,blockhash:pub,recentBlockhash:pub,
    instructionPath:'outer:0',cpiPath:'inner:0:0',
    sourceId:pub+':'+pub+':'+pub,occurrenceId:pub+':'+pub+':'+sig+':outer:0'};
  const proof={...denials,evidenceKind:'solana-deposit-evidence-v2',
    evidenceOrigin:'observer_reviewed_outbox',finalityTrust:'finalized_rpc_claim_only',
    signedWireBase64:'AA==',signedWireSha256:'a'.repeat(64),
    transactionMetadataRawJsonUtf8:'{"meta":{"err":null}}',
    containingBlockRawJsonUtf8:'{"blockhash":"mock"}',
    laterFourAccountSnapshotRawJsonUtf8:'{"accounts":[]}',
    durableLedgerEvidence:{testOnly:true},idlSha256:'b'.repeat(64),
    elfSha256:'c'.repeat(64),solanaSourceCommitSha:'source-test-only',
    historyComplete:false,historyIndexed:false,refundDurablyCommitted:false,
    rollbackSecurityHold:'HOSTILE_FILE_ROLLBACK_UNPROTECTED'};
  const destination={dnaHash:'demo-dna',agentKey:'demo-agent',
    cellId:['demo-dna','demo-agent'],appId:'controlled-audit-demo',
    role:'audit',zome:'solana_audit',functionName:'record_observation_v2',
    genesisHash:pub,program:pub,mint:pub,holochainScope:scope,
    signerPolicyEpoch:'test-only'};
  return {...denials,kind:'solana-observation-demo-v2',schemaVersion:2,
    source,proof,destination,verifierVersion:'test-only'};
}
const digest=x=>calculateV2CandidateDigest(x).witnessDigest;
test('v2 canonical JSON deterministic and result is explicitly unauthenticated',()=>{
  assert.equal(canonicalV2({z:1,a:{b:true,c:false}}),
    canonicalV2({a:{c:false,b:true},z:1}));
  const r=calculateV2CandidateDigest(fake());
  assert.match(r.witnessDigest,/^[0-9a-f]{64}$/);
  assert.equal(r.authenticated,false);
  assert.equal(r.approvedForDelivery,false);
});
test('v2 digest immutably binds source, nonce, recipient, metadata and destination',()=>{
  const base=fake(),original=digest(base);
  for(const [obj,key,value] of [
    ['source','depositNonce','42018'],['source','recipientCore','08'.repeat(32)],
    ['source','blockhash','2'.repeat(32)],['source','amountBaseUnits','250001'],
    ['proof','signedWireBase64','AQ=='],
    ['proof','transactionMetadataRawJsonUtf8','{"meta":{"fee":5001}}'],
    ['proof','containingBlockRawJsonUtf8','{"blockhash":"changed"}'],
    ['proof','laterFourAccountSnapshotRawJsonUtf8','{"accounts":[1]}'],
    ['destination','dnaHash','another-dna'],['destination','agentKey','another-agent']
  ]){
    const next=structuredClone(base);next[obj][key]=value;
    if(obj==='destination'&&key==='dnaHash')next.destination.cellId[0]=value;
    if(obj==='destination'&&key==='agentKey')next.destination.cellId[1]=value;
    assert.notEqual(digest(next),original,key);
  }
});
test('v2 refuses fake approval, refund, missing audit bytes, changed occurrence and wrong DNA',()=>{
  for(const mutate of [
    x=>{x.creditEligible=true},x=>{x.proof.historyComplete=true},
    x=>{x.proof.refundDurablyCommitted=true},x=>{x.source.withdrawalAuthorized=true},
    x=>{x.proof.evidenceOrigin='test_only_fixture'},
    x=>{x.source.sourceEventType='refund'},x=>{x.source.depositNonce='042017'},
    x=>{x.source.occurrenceId='changed'},x=>{x.proof.signedWireBase64=''},
    x=>{x.destination.appId='unyt-sandbox'},x=>{x.destination.cellId[1]='bad'},
    x=>{x.witnessDigest='f'.repeat(64)}
  ]){const p=fake();mutate(p);assert.throws(()=>digest(p),/OBS_V2_REFUSED/);}
});
test('canonical rejects fractional, unsafe, negative-zero numbers, undefined and prototype keys',()=>{
  for(const n of [0.75,Number.MAX_SAFE_INTEGER+1,-0])
    assert.throws(()=>canonicalV2({v:n}),/UNSAFE_NUMBER/);
  assert.throws(()=>canonicalV2({v:undefined}),/INVALID_OBJECT/);
  assert.throws(()=>canonicalV2(Object.fromEntries([['__proto__',2]])),/UNSAFE_KEY/);
});
