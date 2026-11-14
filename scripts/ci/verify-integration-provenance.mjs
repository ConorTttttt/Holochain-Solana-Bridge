// CI-only: distinguish the immutable source-owner Git blobs from the A2
// producer's exact, archived, public Anchor key-sync patch. Never authorize
// a source from a caller-supplied label or a local checksum alone.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args=process.argv.slice(2);
const post=args.length===1&&args[0]==='--post-original-anchor-sync';
assert.deepEqual(args,post?['--post-original-anchor-sync']:[],'UNKNOWN_PROVENANCE_MODE');
const manifest=JSON.parse(readFileSync('ci-integration-snapshot.json','utf8'));
const hex40=/^[a-f0-9]{40}$/;
const hex64=/^[a-f0-9]{64}$/;
const sha256=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const check=(...args)=>execFileSync('sha256sum',args,{encoding:'utf8'}).trim();
const patched=['Anchor.toml','programs/deposit_prototype/src/lib.rs'].sort();
const origin='target/localnet-evidence/';
const head=git('rev-parse','HEAD');
assert.match(head,hex40,'INVALID_INTEGRATION_HEAD');
for(const lane of ['SOL','OBS','RAVE','SEC'])
  assert.match(manifest.sources?.[lane]?.sha ?? '',hex40,'unpinned source '+lane);
assert.match(manifest.base?.sha ?? '',hex40,'unpinned source CI');
assert.equal(manifest.candidate?.status,'UNVERIFIED_NO_GREEN_CLAIM',
  'candidate must not self-attest green');
assert.deepEqual(manifest.nonEconomicPolicy,{
  creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false
},'economic authorization must remain disabled');

let count=0;
for(const [path,record] of Object.entries(manifest.fileProvenance??{})){
  assert.match(path,/^[a-zA-Z0-9._/-]+$/,'unsafe provenance path');
  assert.match(record.sha??'',hex40,'invalid blob hash for '+path);
  assert.ok(['SOL','OBS','RAVE','SEC'].includes(record.lane),'invalid lane for '+path);
  // Git HEAD is immutable during the job, even if the disposable checkout's
  // Anchor config and program declaration are patched for the actual build.
  const committed=git('rev-parse','HEAD:'+path);
  assert.equal(committed,record.sha,
    record.lane+' committed upstream owned blob mismatch: '+path);
  const working=git('hash-object','--',path);
  if(!post||!patched.includes(path))
    assert.equal(working,record.sha,
      record.lane+' upstream owned blob mismatch: '+path);
  count++;
}
assert.ok(count>=13,'missing upstream file provenance');
for(const [path,record] of Object.entries(manifest.integrationOnlyProvenance??{})){
  if(!record.blobSha)continue;
  assert.match(record.blobSha,hex40,'invalid integration-only provenance '+path);
  assert.equal(git('rev-parse','HEAD:'+path),record.blobSha,
    'integration-only committed test changed: '+path);
  assert.equal(git('hash-object','--',path),record.blobSha,
    'integration-only corrected test changed: '+path);
}
for(const path of ['Cargo.lock','observer/package-lock.json',
  'tests/solana/package-lock.json','tests/holochain/rave-engine/Cargo.lock']){
  const expected=manifest.reviewedLockSHA256?.[path];
  assert.match(expected??'',hex64,'unreviewed lock '+path);
  assert.equal(sha256(readFileSync(path)),expected,'locked dependency graph drift: '+path);
}

if(post){
  assert.equal(readFileSync(origin+'source-commit.txt','utf8').trim(),head,
    'A2_SOURCE_PATCH_WRONG_EXECUTION_SHA');
  const changed=git('diff','--name-only','--').split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed,patched,'UNRELATED_TRACKED_SOURCE_MUTATION');
  const patch=origin+'anchor-keys-sync.patch';
  const originalPatch=readFileSync(patch);
  assert.ok(originalPatch.length>0,'MISSING_SOURCE_OWNED_PATCH_BYTES');
  const patchFiles=git('apply','--numstat','--',patch)
    .split(/\r?\n/).filter(Boolean).map(s=>s.split('\t').at(-1)).sort();
  assert.deepEqual(patchFiles,patched,'SOURCE_PATCH_PATHS_CHANGED');
  // This checks the patch against actual current bytes, not just a
  // self-reported checksum. The prior step used git apply --check then apply.
  git('apply','--reverse','--check','--',patch);
  for(const file of [
    'evidence-manifest.sha256','tracked-pre-sync.sha256',
    'tracked-post-sync.sha256','build-inputs.sha256','cargo-lock.sha256'])
    assert.ok(readFileSync(origin+file).length>0,'MISSING_ORIGINAL_A2_TREE_MANIFEST:'+file);
  // Producer checksums were archived by the same-run real validator, and
  // their archive is checked in full before the patch is applied.
  execFileSync('sha256sum',['--check','evidence-manifest.sha256'],
    {cwd:origin,stdio:['ignore','pipe','pipe']});
  const postTree=check('--check',origin+'tracked-post-sync.sha256');
  check('--check',origin+'build-inputs.sha256');
  check('--check',origin+'cargo-lock.sha256');
  assert.ok(postTree.length>0,'POST_PATCH_TREE_NOT_VERIFIED');
  const report=JSON.parse(readFileSync('ci-artifacts/a0-exact-original-anchor-source-replay.json','utf8'));
  assert.equal(report.originalImmutableGitHead,head,'A2_PATCH_REPORT_HEAD_CHANGED');
  assert.equal(report.producerPatchSha256,sha256(originalPatch),'A2_PATCH_BYTES_DRIFT');
  assert.deepEqual(report.patchedTrackedPaths,patched,'A2_PATCH_REPORT_PATHS_CHANGED');
  assert.equal(report.preTrackedDigestManifestSha256,
    sha256(readFileSync(origin+'tracked-pre-sync.sha256')),'A2_PRE_MANIFEST_DRIFT');
  assert.equal(report.postTrackedDigestManifestSha256,
    sha256(readFileSync(origin+'tracked-post-sync.sha256')),'A2_POST_MANIFEST_DRIFT');
  assert.equal(report.sourceGitBlobsUnchangedInCommittedIntegration,true,
    'A2_COMMITTED_SOURCE_DRIFT_CLAIM');
  const result={schema:'hsc-a1-committed-source-and-original-generated-tree-v1',
    integrationCommit:head,sourceOwnerCommitSha:manifest.sources.SOL.sha,
    checkedCommittedOwnedBlobs:count,
    originalCommittedAnchorBlob:manifest.fileProvenance['Anchor.toml'].sha,
    originalCommittedProgramBlob:manifest.fileProvenance[patched[1]].sha,
    generatedTrackedPaths:patched,originalProducerPatchSha256:sha256(originalPatch),
    originalPreTreeManifestSha256:sha256(readFileSync(origin+'tracked-pre-sync.sha256')),
    originalPostTreeManifestSha256:sha256(readFileSync(origin+'tracked-post-sync.sha256')),
    originalBuildInputsManifestSha256:sha256(readFileSync(origin+'build-inputs.sha256')),
    originalArchiveManifestSha256:sha256(readFileSync(origin+'evidence-manifest.sha256')),
    emittedAfterOriginalPatchReplay:true,externalAuthorization:false,
    dnaInstalled:false,actionHash:null,
    creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false};
  mkdirSync('ci-artifacts',{recursive:true});
  const data=Buffer.from(JSON.stringify(result,null,2)+'\n');
  writeFileSync('ci-artifacts/a0-postpatch-provenance.json',data,{mode:0o600});
  writeFileSync('ci-artifacts/a0-postpatch-provenance.json.sha256',
    sha256(data)+'  a0-postpatch-provenance.json\n',{mode:0o600});
}
console.log('PASS: '+count+' committed source-owned Git blobs, integration-only fixtures, four reviewed dependency locks; '+
  (post?'original producer-generated post-sync tracked tree':'original pre-patch worktree')+
  '; no source authorization or economic approval');
