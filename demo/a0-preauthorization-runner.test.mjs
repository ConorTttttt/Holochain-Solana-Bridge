import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,rmSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyExecutedSourceArtifact,assessDnaSourceBinding,DENIAL} from './a0-preauthorization-runner.mjs';

const sha='b7379764f9ba7b20c2e72898df73e181c8ec2380';
const signature='source-signature-demo';
const root={schema:'hsc-a1-same-sha-fresh-signed-source-v2-queued-not-delivered',
 immutableSourceCommitSha:sha,originalSolanaDomain:{sourceCommitSha:sha,
   genesisHash:'g',programId:'p',scopeHex:'a'.repeat(64),nonce:'42017',
   amountBaseUnits:'250000',recipientCoreHex:'b'.repeat(64),
   transactions:{deposit:{signature}}},originalSignedTransactionSha256:'c'.repeat(64),
 originalContainingBlockhash:'block',durableOutboxReopened:'pending',
 transportRefusal:'REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED',noHolochainAck:true,
 destinationReadback:{state:'not_approved_or_written',actionHash:null},
 refundHistoryComplete:false,independentRpcConsensusVerified:false,
 observerReviewedWitnessV2:{kind:'solana-observation-demo-v2',witnessDigest:'d'.repeat(64),
 source:{codeVersion:sha,signature,depositNonce:'42017',recipientCore:'b'.repeat(64),
   holochainScope:'a'.repeat(64),amountBaseUnits:'250000',...DENIAL},
 proof:{historyComplete:false,...DENIAL},...DENIAL},...DENIAL};
function verify(x){const bytes=Buffer.from(JSON.stringify(x));return verifyExecutedSourceArtifact(
 x,sha,bytes,createHash('sha256').update(bytes).digest('hex'));}
const clone=x=>structuredClone(x);
test('synthetic postcondition control exercises digest and exact no-write shape only',()=>{
 assert.equal(verify(root).historyComplete,false);
});
for(const [name,mutate,pattern] of [
 ['source SHA substitution',x=>x.immutableSourceCommitSha='0'.repeat(40),/ORIGINAL_SOURCE_SHA_MISMATCH/],
 ['source wire hash missing',x=>x.originalSignedTransactionSha256='',/ORIGINAL_SIGNED_WIRE_HASH_MISSING/],
 ['fabricated Holochain ack',x=>x.noHolochainAck=false,/UNAPPROVED_ACK_CLAIM/],
 ['changed nonce',x=>x.observerReviewedWitnessV2.source.depositNonce='100',/V2_DEPOSIT_NONCE_MISMATCH/],
 ['wrong recipient',x=>x.observerReviewedWitnessV2.source.recipientCore='f'.repeat(64),/V2_DEPOSIT_RECIPIENT_MISMATCH/],
 ['wrong amount',x=>x.observerReviewedWitnessV2.source.amountBaseUnits='1',/V2_DEPOSIT_AMOUNT_MISMATCH/],
 ['wrong signed scope',x=>x.observerReviewedWitnessV2.source.holochainScope='f'.repeat(64),/V2_SIGNED_SCOPE_MISMATCH/],
 ['history false promotion',x=>x.observerReviewedWitnessV2.proof.historyComplete=true,/V2_HISTORY_FALSE_APPROVAL/],
 ['economic false promotion',x=>x.withdrawalAuthorized=true,/ECONOMIC_DENIAL_DRIFT/],
 ['unapproved delivered transport',x=>x.transportRefusal='ok',/REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED/],
])test('synthetic negative refusal: '+name,()=>{
 const x=clone(root);mutate(x);assert.throws(()=>verify(x),pattern);
});
test('artifact bytes digest altered',()=>{
 const bytes=Buffer.from(JSON.stringify(root));assert.throws(()=>
  verifyExecutedSourceArtifact(root,sha,bytes,'0'.repeat(64)),/ORIGINAL_ARTIFACT_BYTES_DIGEST_MISMATCH/);
});
test('no source CI checkout execution produces blocked non-mutating report',()=>{
 const d=mkdtempSync(join(tmpdir(),'a0-preauth-negative-'));
 try{
  const r=spawnSync(process.execPath,['demo/a0-preauthorization-runner.mjs','--out',join(d,'report.json')],{
   cwd:process.cwd(),env:{...process.env,A0_EXPECTED_SHA:'0'.repeat(40)},encoding:'utf8'});
  assert.equal(r.status,2);
  const report=JSON.parse(readFileSync(join(d,'report.json'),'utf8'));
  assert.equal(report.signedCallExecuted,false);
  assert.equal(report.actionHash,null);
  assert.equal(report.independentSecurityApproved,false);
  assert.equal(report.stages.exact_call_approved.state,'BLOCKED_PENDING_INDEPENDENT_EXACT_TUPLE_APPROVAL');
  assert.equal(report.stages.signed_audit_action_executed.state,'NOT_EXECUTED_APPROVAL_ABSENT');
  assert.deepEqual(Object.fromEntries(Object.keys(DENIAL).map(k=>[k,report[k]])),DENIAL);
 }finally{rmSync(d,{recursive:true,force:true});}
});

test('DNA source domain must match every archived Solana identity without claiming installed runtime',()=>{
 const source={genesisHash:'g',program:'p',mint:'m',scope:'a'.repeat(64)};
 const yaml=Object.entries({genesisHash:'g',program:'p',mint:'m',holochainScope:'a'.repeat(64)})
  .map(([k,v])=>'    '+k+': '+v).join('\n');
 assert.equal(assessDnaSourceBinding(yaml,source).state,'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM');
 const wrong=yaml.replace('    program: p','    program: different');
 const r=assessDnaSourceBinding(wrong,source);
 assert.equal(r.state,'BLOCKED_OBSERVER_DNA_SOURCE_DOMAIN_MISMATCH');
 assert.deepEqual(r.mismatched,['program']);
 assert.ok(assessDnaSourceBinding(yaml+'\n    program: p',source).mismatched.includes('program'));
});
