// Validate immutable upstream-owned blobs and pinned lock graphs in this checkout.
// Does not attest runtime provenance or replace signed validator evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync('ci-integration-snapshot.json','utf8'));
const hex40=/^[a-f0-9]{40}$/;
const hex64=/^[a-f0-9]{64}$/;
for (const lane of ['SOL','OBS','RAVE','SEC']) {
  assert.match(manifest.sources?.[lane]?.sha ?? '',hex40,'unpinned source '+lane);
}
assert.match(manifest.base?.sha ?? '',hex40,'unpinned source CI');
assert.equal(manifest.candidate?.status,'UNVERIFIED_NO_GREEN_CLAIM','candidate must not self-attest green');
assert.deepEqual(manifest.nonEconomicPolicy,{
  creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false
},'economic authorization must remain disabled');
let count=0;
for (const [path, record] of Object.entries(manifest.fileProvenance ?? {})) {
  assert.match(path,/^[a-zA-Z0-9._/-]+$/,'unsafe provenance path');
  assert.match(record.sha ?? '',hex40,'invalid blob hash for '+path);
  assert.ok(['SOL','OBS','RAVE','SEC'].includes(record.lane),'invalid lane for '+path);
  const hash=execFileSync('git',['hash-object','--',path],{encoding:'utf8'}).trim();
  assert.equal(hash,record.sha,record.lane+' upstream owned blob mismatch: '+path);
  count++;
}
assert.ok(count>=13,'missing upstream file provenance');
for (const [path,record] of Object.entries(manifest.integrationOnlyProvenance ?? {})) {
  if(!record.blobSha)continue;
  assert.match(record.blobSha,hex40,'invalid integration-only provenance '+path);
  const hash=execFileSync('git',['hash-object','--',path],{encoding:'utf8'}).trim();
  assert.equal(hash,record.blobSha,'integration-only corrected test changed: '+path);
}
for (const path of ['Cargo.lock','observer/package-lock.json',
  'tests/solana/package-lock.json','tests/holochain/rave-engine/Cargo.lock']) {
  const expected=manifest.reviewedLockSHA256?.[path];
  assert.match(expected ?? '',hex64,'unreviewed lock '+path);
  const actual=createHash('sha256').update(readFileSync(path)).digest('hex');
  assert.equal(actual,expected,'locked dependency graph drift: '+path);
}
console.log('PASS: '+count+' source-owned blobs, corrected CI-only fixtures, four reviewed dependency locks, non-economic safety flags');
