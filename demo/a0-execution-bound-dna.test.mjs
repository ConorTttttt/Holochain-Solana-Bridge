import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBoundDna} from './a0-execution-bound-dna.mjs';
import {DENIAL} from './a0-preauthorization-runner.mjs';

const sha='2bc6887b1c373311f2fbddea530bd533067dad84';
const genesis='BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv';
const program='387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1';
const mint='3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig';
const scope='a'.repeat(64);
const template='# AUDIT-ONLY DEMO DNA\nmanifest_version: "0"\n'+
  'name: holochain_solana_audit_demo\nintegrity:\n  network_seed: oldseed\n'+
  '  properties:\n    demoOnly: true\n    genesisHash: '+genesis+'\n'+
  '    program: '+program+'\n    mint: '+mint+'\n    holochainScope: "oldscope"\n';
const domain={sourceCommitSha:sha,genesisHash:genesis,programId:program,mint,
  scopeHex:scope,initializedScopeHex:scope,nonce:'42017',amountBaseUnits:'250000',
  recipientCoreHex:'b'.repeat(64),historyComplete:false,
  transactions:{initialize:{signature:'original-init'},
    deposit:{signature:'original-deposit'},refund:{signature:'original-refund'}},...DENIAL};
const witness={kind:'solana-observation-demo-v2',witnessDigest:'c'.repeat(64),
  source:{codeVersion:sha,signature:'original-deposit',holochainScope:scope,
    depositNonce:'42017',recipientCore:'b'.repeat(64),amountBaseUnits:'250000',
    ...DENIAL},proof:{historyComplete:false,...DENIAL},...DENIAL};
const input=()=>({template,domain:structuredClone(domain),witness:structuredClone(witness),
  producerSha:sha,consumerSha:sha,manifestSha256:'d'.repeat(64),
  replaySha256:'e'.repeat(64)});
test('synthetic projection binds fresh source without pretending to install or sign',()=>{
  const {yaml,report}=sourceBoundDna(input());
  assert.match(yaml,new RegExp('genesisHash: '+genesis));
  assert.match(yaml,new RegExp("holochainScope: '"+scope+"'"));
  assert.deepEqual(report.originalA4MismatchKeys,['holochainScope']);
  assert.equal(report.producerSourceCommitSha,sha);
  assert.equal(report.consumerCodeCommitSha,sha);
  assert.equal(report.installed,false);
  assert.equal(report.independentApproval,false);
  assert.equal(report.actionHash,null);
  assert.equal(report.withdrawalAuthorized,false);
  assert.equal(report.creditEligible,false);
});
for(const [name,change,pattern] of [
  ['producer substitution',x=>x.domain.sourceCommitSha='0'.repeat(40),/ORIGINAL_PRODUCER_SHA_MISMATCH/],
  ['replay code SHA substitution',x=>x.consumerSha='1'.repeat(40),/FRESH_PRODUCER_CONSUMER_SHA_MISMATCH/],
  ['scope mutation',x=>x.witness.source.holochainScope='0'.repeat(64),/SIGNED_SCOPE_MISMATCH/],
  ['amount mutation',x=>x.witness.source.amountBaseUnits='1',/SIGNED_AMOUNT_MISMATCH/],
  ['recipient mutation',x=>x.witness.source.recipientCore='e'.repeat(64),/SIGNED_RECIPIENT_MISMATCH/],
  ['nonce mutation',x=>x.witness.source.depositNonce='400',/SIGNED_NONCE_MISMATCH/],
  ['changed deposit signature',x=>x.witness.source.signature='other',/ORIGINAL_DEPOSIT_SIGNATURE_MISMATCH/],
  ['unverified original history promotion',x=>x.domain.historyComplete=true,/ORIGINAL_HISTORY_FALSE_PROMOTION/],
  ['false reviewed history',x=>x.witness.proof.historyComplete=true,/REVIEWED_HISTORY_FALSE_PROMOTION/],
  ['economic promotion',x=>x.witness.proof.withdrawalAuthorized=true,/ECONOMIC_DENIAL_DRIFT/],
  ['duplicate scope entry',x=>x.template+='    holochainScope: duplicate\n',/DUPLICATE_DNA_PROPERTY/],
  ['non-demo DNA',x=>x.template=x.template.replace('demoOnly: true','demoOnly: false'),/NOT_AUDIT_ONLY_DNA/],
])test('synthetic refusal: '+name,()=>{
  const x=input();change(x);assert.throws(()=>sourceBoundDna(x),pattern);
});
