import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/ci/a0-replay-source-patch.mjs','utf8');
const wf=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
test('A1 source bridge uses exact A2 patch and cross-checks both full tracked trees',()=>{
 assert.match(wf,/a0-replay-source-patch\.mjs/);
 for(const p of ['tracked-pre-sync.sha256','tracked-post-sync.sha256',
  'anchor-keys-sync.patch','anchor-keys-sync-tracked-changes.txt',
  'build-inputs.sha256','cargo-lock.sha256']){
  assert.ok(wf.includes('target/localnet-evidence/'+p),'missing public artifact '+p);
 }
 assert.match(script,/SOL_SOURCE_PATCH_CROSS_SHA_REFUSED/);
 assert.match(script,/CONSUMER_NOT_CLEAN_BEFORE_PATCH/);
 assert.match(script,/UNREVIEWED_OR_MISSING_A2_PATCH_PATH/);
 assert.match(script,/PRODUCER_PATCH_MANIFEST_DISAGREES/);
 assert.match(script,/exec\('sha256sum',\['--check',pre\]\)/);
 assert.match(script,/exec\('sha256sum',\['--check',post\]\)/);
 assert.match(script,/exec\('git',\['apply','--check','--',patch\]\)/);
 assert.match(script,/sourceGitBlobsUnchangedInCommittedIntegration:true/);
 assert.doesNotMatch(script,/exec\('git',\['(commit|push|checkout)'/);
});
