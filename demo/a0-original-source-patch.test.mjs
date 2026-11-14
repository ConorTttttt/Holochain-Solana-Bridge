import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/ci/a0-replay-source-patch.mjs','utf8');
const wf=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
const provenance=readFileSync('scripts/ci/verify-integration-provenance.mjs','utf8');
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

test('post-patch source provenance verifies Git blobs, original producer patch and full actual generated tree',()=>{
 assert.match(wf,/verify-integration-provenance\.mjs --post-original-anchor-sync/);
 assert.ok(wf.indexOf('a0-replay-source-patch.mjs')<wf.indexOf('verify-integration-provenance.mjs --post-original-anchor-sync'));
 for(const expected of ['HEAD:'+"'",'UNRELATED_TRACKED_SOURCE_MUTATION',
  "'--reverse','--check'",'tracked-post-sync.sha256','build-inputs.sha256',
  'evidence-manifest.sha256','a0-postpatch-provenance.json','A2_PATCH_BYTES_DRIFT'])
  assert.ok(provenance.includes(expected),expected+' must be enforced');
 assert.match(provenance,/creditEligible:false,independentConsensusVerified:false/);
 assert.match(provenance,/spendableBaseUnits:'0',withdrawalAuthorized:false/);
});
