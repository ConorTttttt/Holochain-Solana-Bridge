#!/usr/bin/env node
// A1 source-bound seven-stage report enrichment. Only actual admin installation
// and hash/read-only evidence can promote stage 3; no approval or zome call.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,basename} from 'node:path';
import {DENIAL} from './a0-preauthorization-runner.mjs';
const sha256=x=>createHash('sha256').update(x).digest('hex');
const hex64=/^[a-f0-9]{64}$/;
function recorded(path){
 const bytes=readFileSync(path),digest=sha256(bytes);
 const m=/^([a-f0-9]{64})  (\S+)\s*$/.exec(readFileSync(path+'.sha256','utf8'));
 assert.ok(m&&m[1]===digest&&m[2]===basename(path),'A0_ORIGINAL_REPORT_CHECKSUM_FAILED:'+path);
 return JSON.parse(bytes);
}
export function attestInstalled(preauth,sourceBound,installed,sourceYaml,bundleHashes,checkout){
 assert.equal(preauth.sourceCommit,checkout,'A0_PREAUTH_NOT_SAME_SHA');
 assert.equal(preauth.stages.source_verified.state,'EXECUTED_SAME_SHA_ORIGINAL_SIGNED_SOURCE_KIT');
 assert.equal(preauth.stages.observer_evidence_admitted.state,'EXECUTED_KIT_V2_DURABLE_PENDING_NO_ACK');
 assert.equal(sourceBound.sourceProducerCommitSha,checkout,'A0_SOURCE_PRODUCER_SHA_DRIFT');
 assert.equal(sourceBound.observerReplayConsumerCommitSha,checkout,'A0_OBSERVER_CONSUMER_SHA_DRIFT');
 assert.equal(sourceBound.derivedDnaSourceSha256,sha256(sourceYaml),'A0_DNA_SOURCE_BYTES_DRIFT');
 assert.equal(sourceBound.bindingState,'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM');
 assert.ok(hex64.test(sourceBound.originalSignedDepositWireSha256),'A0_ORIGINAL_SIGNED_WIRE_LOST');
 assert.equal(installed.schema,'hsc-a0-owned-dna-disposable-readonly-v1');
 assert.equal(installed.installation,'OWN_AUDIT_DNA_ACTUAL_DISPOSABLE_CONDUCTOR_INSTALLED');
 assert.equal(installed.adminReadOnlyListAppsAndCells,true);
 assert.equal(installed.appId,'hsc-audit-demo-readonly');
 assert.equal(installed.role,'audit');
 assert.ok(/^uhC0k[A-Za-z0-9_-]+$/.test(installed.cellId?.dnaHash),'A0_NO_REAL_DNA_HASH');
 assert.ok(/^uhCAk[A-Za-z0-9_-]+$/.test(installed.cellId?.agentPubKey),'A0_NO_REAL_AGENT_KEY');
 assert.equal(installed.signer,installed.cellId.agentPubKey,'A0_SIGNER_CELL_AGENT_DRIFT');
 assert.equal(installed.hamExternalLairPreflight,'BLOCKED_NO_EXTERNAL_LAIR_CONFIG');
 assert.equal(installed.signedZomeCallExecuted,false);
 assert.equal(installed.capabilityGrantExecuted,false);
 assert.equal(installed.signedObservationActionHash,null);
 for(const [k,v] of Object.entries(DENIAL)){
  assert.equal(preauth[k],v,'A0_PREAUTH_DENIAL_DRIFT:'+k);
  assert.equal(sourceBound[k],v,'A0_SOURCE_DENIAL_DRIFT:'+k);
  assert.equal(installed[k],v,'A0_INSTALL_DENIAL_DRIFT:'+k);
 }
 assert.ok(bundleHashes.some(x=>x.endsWith('  holochain_solana_audit_demo.dna')),
   'A0_MISSING_ACTUAL_DNA_BUNDLE_DIGEST');
 assert.ok(bundleHashes.some(x=>x.endsWith('  holochain_solana_audit_demo.happ')),
   'A0_MISSING_ACTUAL_HAPP_BUNDLE_DIGEST');
 const report=structuredClone(preauth);
 report.schema='hsc-a1-seven-stage-source-bound-actual-install-v1';
 report.derivedSourceBinding=sourceBound;
 report.stages.holochain_runtime_installed={state:'EXECUTED_ACTUAL_071_OWN_DNA_INSTALL_ADMIN_READONLY',
   dnaHash:installed.cellId.dnaHash,fullCellId:installed.cellId,
   appId:installed.appId,signer:installed.signer,
   bundledWasmAndHappDigests:bundleHashes,
   externalLairHamPreflight:'BLOCKED_NOT_EXECUTED',
   reviewedV2SignedWriteTransport:'BLOCKED_NOT_APPROVED'};
 report.stages.exact_call_approved={state:'BLOCKED_PENDING_INDEPENDENT_EXACT_TUPLE_APPROVAL'};
 for(const s of ['signed_audit_action_executed','typed_readback_verified','restart_replay_verified'])
   report.stages[s]={state:'NOT_EXECUTED_APPROVAL_ABSENT'};
 report.result='ACTUAL_SOURCE_BOUND_OWN_DNA_INSTALLED_READONLY__SIGNED_WRITE_BLOCKED';
 report.signedCallExecuted=false;report.actionHash=null;report.independentSecurityApproved=false;
 return report;
}
function main(){
 const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(process.env.A0_EXPECTED_SHA,checkout);
 const before=recorded('ci-artifacts/a0-preauthorization-seven-stage.json');
 const source=JSON.parse(readFileSync('ci-artifacts/a0-bound-dna/source-domain-binding.json','utf8'));
 const installed=JSON.parse(readFileSync('ci-artifacts/own-dna-conductor/own-dna-install-readonly.json','utf8'));
 const bundleHashes=readFileSync('holochain/demo/demo-build-artifacts.sha256','utf8').trim().split(/\r?\n/);
 const report=attestInstalled(before,source,installed,readFileSync('holochain/demo/dna.yaml'),bundleHashes,checkout);
 const out='ci-artifacts/a0-seven-stage-actual-install-readonly.json';
 mkdirSync(dirname(out),{recursive:true});
 const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
 writeFileSync(out,bytes,{mode:0o600});
 writeFileSync(out+'.sha256',sha256(bytes)+'  '+basename(out)+'\n',{mode:0o600});
 console.log('A0_REAL_OWN_DNA_READONLY_INSTALLED_NO_SIGNED_WRITE',checkout,report.stages.holochain_runtime_installed.dnaHash);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)main();
