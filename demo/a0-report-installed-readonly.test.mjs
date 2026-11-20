import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DENIAL} from './a0-preauthorization-runner.mjs';
import {attestInstalled} from './a0-report-installed-readonly.mjs';
const sha='2bc6887b1c373311f2fbddea530bd533067dad84';
const yaml=Buffer.from('derived source YAML only -- synthetic');
const digest=createHash('sha256').update(yaml).digest('hex');
const preauth={sourceCommit:sha,...DENIAL,stages:{
 source_verified:{state:'EXECUTED_SAME_SHA_ORIGINAL_SIGNED_SOURCE_KIT'},
 observer_evidence_admitted:{state:'EXECUTED_KIT_V2_DURABLE_PENDING_NO_ACK'}}};
const source={sourceProducerCommitSha:sha,observerReplayConsumerCommitSha:sha,
 derivedDnaSourceSha256:digest,bindingState:'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM',
 originalSignedDepositWireSha256:'e'.repeat(64),...DENIAL};
const installed={schema:'hsc-a0-owned-dna-disposable-readonly-v1',
 installation:'OWN_AUDIT_DNA_ACTUAL_DISPOSABLE_CONDUCTOR_INSTALLED',
 adminReadOnlyListAppsAndCells:true,appId:'hsc-audit-demo-readonly',role:'audit',
 cellId:{dnaHash:'uhC0kTestDna',agentPubKey:'uhCAkTestAgent'},
 signer:'uhCAkTestAgent',hamExternalLairPreflight:'BLOCKED_NO_EXTERNAL_LAIR_CONFIG',
 signedZomeCallExecuted:false,capabilityGrantExecuted:false,
 signedObservationActionHash:null,...DENIAL};
const bundles=['a'.repeat(64)+'  holochain_solana_audit_demo.dna',
 'b'.repeat(64)+'  holochain_solana_audit_demo.happ'];
const run=(a=preauth,b=source,c=installed)=>attestInstalled(a,b,c,yaml,bundles,sha);
test('synthetic signed-write gates stay closed even after valid install-shaped input',()=>{
 const out=run();
 assert.equal(out.stages.holochain_runtime_installed.state,'EXECUTED_ACTUAL_071_OWN_DNA_INSTALL_ADMIN_READONLY');
 assert.equal(out.stages.exact_call_approved.state,'BLOCKED_PENDING_INDEPENDENT_EXACT_TUPLE_APPROVAL');
 assert.equal(out.stages.signed_audit_action_executed.state,'NOT_EXECUTED_APPROVAL_ABSENT');
 assert.equal(out.actionHash,null);
 assert.deepEqual(Object.fromEntries(Object.keys(DENIAL).map(k=>[k,out[k]])),DENIAL);
});
test('wrong source, wrong installed cell/signer and false authorization refuse',()=>{
 assert.throws(()=>run(preauth,{...source,sourceProducerCommitSha:'0'.repeat(40)}),/SOURCE_PRODUCER_SHA_DRIFT/);
 assert.throws(()=>run(preauth,source,{...installed,signer:'uhCAkWrongAgent'}),/SIGNER_CELL_AGENT_DRIFT/);
 assert.throws(()=>run(preauth,source,{...installed,capabilityGrantExecuted:true}),/true !== false|Expected values to be strictly equal/);
 assert.throws(()=>run(preauth,{...source,creditEligible:true}),/SOURCE_DENIAL_DRIFT/);
});
