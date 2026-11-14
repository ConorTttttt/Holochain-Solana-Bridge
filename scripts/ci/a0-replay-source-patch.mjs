#!/usr/bin/env node
// A1 CI-only source provenance bridge: repeat the *exact* A2 producer's
// dynamic PUBLIC program-ID patch inside this throwaway workflow checkout.
// NO repository commit, no branch rewrite, no mutation of owner Git blobs,
// no permission, capability, transfer, Holochain write or economic approval.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const origin='target/localnet-evidence/';
const patch=origin+'anchor-keys-sync.patch';
const pre=origin+'tracked-pre-sync.sha256';
const post=origin+'tracked-post-sync.sha256';
const sourceChangeList=origin+'anchor-keys-sync-tracked-changes.txt';
const files=[patch,pre,post,sourceChangeList,origin+'build-inputs.sha256',
 origin+'cargo-lock.sha256'];
for(const p of files)assert.ok(readFileSync(p).length>0,'ORIGINAL_A2_PATCH_HANDOFF_MISSING:'+p);
const exec=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const gitHead=exec('git',['rev-parse','HEAD']);
assert.match(gitHead,/^[a-f0-9]{40}$/);
assert.equal(gitHead,readFileSync(origin+'source-commit.txt','utf8').trim(),
 'SOL_SOURCE_PATCH_CROSS_SHA_REFUSED');
assert.equal(exec('git',['diff','--name-only']),'','CONSUMER_NOT_CLEAN_BEFORE_PATCH');
const captured=readFileSync(sourceChangeList,'utf8').trim().split(/\r?\n/).filter(Boolean).sort();
const numstat=exec('git',['apply','--numstat','--',patch]);
const patched=numstat.split(/\r?\n/).filter(Boolean).map(line=>line.split('\t').at(-1)).sort();
const allow=['Anchor.toml','programs/deposit_prototype/src/lib.rs'];
assert.deepEqual(patched,allow.sort(),'UNREVIEWED_OR_MISSING_A2_PATCH_PATH');
assert.deepEqual(captured,patched,'PRODUCER_PATCH_MANIFEST_DISAGREES');
assert.ok(readFileSync(patch,'utf8').includes('declare_id') ||
  readFileSync(patch,'utf8').includes('deposit_prototype'),
  'MISSING_ACTUAL_COMPILED_PROGRAM_SOURCE_CHANGE');
exec('sha256sum',['--check',pre]);
exec('git',['apply','--check','--',patch]);
exec('git',['apply','--',patch]);
assert.deepEqual(exec('git',['diff','--name-only']).split('\n').sort(),patched);
exec('sha256sum',['--check',post]);
exec('sha256sum',['--check',origin+'build-inputs.sha256']);
exec('sha256sum',['--check',origin+'cargo-lock.sha256']);
assert.equal(exec('git',['rev-parse','HEAD']),gitHead,'GIT_HEAD_MUTATED');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const report={
 schema:'hsc-a1-original-post-anchor-sync-input-reconstruction-v1',
 originalImmutableGitHead:gitHead,
 reproducedOnlyInDisposableConsumerWorkingTree:true,
 sourceOwner:'SOL_PR55_DYNAMIC_ANCHOR_PUBLIC_ID_PATCH',
 sourceGitBlobsUnchangedInCommittedIntegration:true,
 patchedTrackedPaths:patched,
 producerPatchSha256:sha(patch),preTrackedDigestManifestSha256:sha(pre),
 postTrackedDigestManifestSha256:sha(post),reviewedRootCargoLockSha256:sha('Cargo.lock'),
 actualProgramId:readFileSync(origin+'program-id.txt','utf8').trim(),
 property:'The exact original locally compiled source is reconstructed for signed witness replay. NOT deployment authorization.',
 noHolochainCall:true,noEconomicApproval:true,
 creditEligible:false,independentConsensusVerified:false,
 spendableBaseUnits:'0',withdrawalAuthorized:false,
};
mkdirSync('ci-artifacts',{recursive:true});
writeFileSync('ci-artifacts/a0-exact-original-anchor-source-replay.json',
 JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log('RECONSTRUCTED_ORIGINAL_A2_DYNAMIC_COMPILED_SOURCE_SHA',gitHead,
 'TRACKED_POST_SYNC_SHA256',report.postTrackedDigestManifestSha256,
 'COMMITTED_SPECIALIST_BLOBS_UNCHANGED');
