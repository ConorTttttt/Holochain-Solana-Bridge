import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {digest,parseCanonical} from './authorization.mjs';
test('recorded request binds exact reviewed executor code and original build, while host/approval remain absent',()=>{
 const r=parseCanonical(readFileSync('demo/installation/evidence/installation-request.prepared.json'));
 assert.equal(r.requestState,'CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED');assert.equal(r.hostFingerprint,null);
 assert.equal(r.futureAgentPubKey,null);assert.equal(r.futureCellId,null);assert.equal(r.allowSignedZomeCalls,false);
 assert.equal(r.allowCapabilityGrants,false);assert.equal(r.v2TransportApproved,false);
 for(const file of ['scripts/installation/execute-approved.mjs','demo/installation/authorization.mjs']){
  const matches=Object.entries(r.protectedFiles).filter(([p])=>p.endsWith('/'+file));assert.equal(matches.length,1);
  assert.equal(matches[0][1],digest(readFileSync(file)),'CODE_CHANGED_REGENERATE_AND_REVIEW_REQUEST');
 }
 assert.equal(r.baselineSourceCommit,'03b567a992bcd31930b49d08f594a4ef7ff58680');
 assert.ok(!r.argv.includes('--in-process-lair'));assert.equal(r.appId,'hsc-audit-demo-readonly');
 const s=JSON.parse(readFileSync('demo/installation/evidence/seven-stage-status.json'));
 assert.equal(s.actionHash,null);assert.equal(s.installedCellId,null);assert.equal(s.demoReady,false);
});
