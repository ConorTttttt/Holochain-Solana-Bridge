import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const wf=readFileSync('.github/workflows/a0-own-dna-runtime.yml','utf8');
const script=readFileSync('scripts/ci/a0-own-dna-install-readonly.sh','utf8');
test('own audit installation waits for successful real locked build and checks exact artifacts',()=>{
 const start=wf.indexOf('\n  own-dna-install-readonly:\n');
 assert.ok(start>0);
 const job=wf.slice(start);
 assert.match(job,/needs: \[own-dna-build\]/);
 assert.match(job,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(job,/node demo\/a0-runtime-gate\.mjs .* --require-build/);
 assert.match(job,/sha256sum --check demo-build-artifacts\.sha256/);
 assert.match(job,/a0-own-dna-build-\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(job,/holochain\/holonix\/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da/);
});
test('real disposable own-DNA admin-only install cannot report signed Lair or zome write',()=>{
 assert.match(script,/hc sandbox --piped generate/);
 assert.match(script,/--app-id hsc-audit-demo-readonly/);
 assert.match(script,/hc client call --port "\$PORT" list-apps/);
 assert.match(script,/hc client call --port "\$PORT" list-cells/);
 assert.match(script,/hamExternalLairPreflight:"BLOCKED_NO_EXTERNAL_LAIR_CONFIG"/);
 assert.match(script,/signedObservationActionHash:null/);
 assert.match(script,/capabilityGrantExecuted:false/);
 assert.doesNotMatch(script,/\bhc client call[^\n]*(call-zome|call-zome-function|record_observation)/);
 assert.doesNotMatch(script,/\bcargo \+1\.95\.0 run --.* -- deliver/);
});
