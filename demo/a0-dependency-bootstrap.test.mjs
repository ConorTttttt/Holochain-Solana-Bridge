import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const wf=readFileSync('.github/workflows/a0-dependency-bootstrap.yml','utf8');
const script=readFileSync('scripts/ci/a0-bootstrap-locks.sh','utf8');
const integration=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
test('bootstrap is independent of reviewed locked DNA build gate',()=>{
 assert.match(wf,/name: A0 non-authorizing Cargo dependency bootstrap/);
 assert.match(wf,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(wf,/rustup toolchain install 1\.95\.0/);
 assert.match(script,/cargo \+1\.95\.0 generate-lockfile --manifest-path holochain\/demo\/Cargo\.toml/);
 assert.match(script,/cargo \+1\.95\.0 generate-lockfile --manifest-path holochain\/demo\/ham-adapter\/Cargo\.toml/);
 assert.match(wf,/holochain\/demo\/Cargo\.lock/);
 assert.match(wf,/holochain\/demo\/ham-adapter\/Cargo\.lock/);
 assert.match(script,/UNREVIEWED_RESOLUTION_PROPOSAL_NOT_COMMITTED/);
 assert.doesNotMatch(script,/\bcargo .*\b(build|test|run)\b/);
 assert.doesNotMatch(wf,/\bhc dna pack\b|record_observation|cap-grant/);
});
test('same SHA integration requires new SOL domain evidence and source reviewed OBS queue',()=>{
 assert.match(integration,/source-domain-identity/);
 assert.match(integration,/verify-demo-domain\.mjs/);
 assert.match(integration,/observer-reviewed-v2-original-signed-localnet\.json\.sha256/);
 assert.match(integration,/a0-verify-reviewed-v2\.mjs/);
 assert.match(integration,/5991d027a686eb419a709a479178b33eb83501e8a2bfbf599a81a286bfcbf770/);
});
