#!/usr/bin/env bash
# CI-owned NON-AUTHORIZING dependency graph proposal. Never build, pack,
# install, sign, grant a capability, or invoke a zome.
set -Eeuo pipefail
umask 077
mkdir -p ci-artifacts
trap 'rc=$?; printf "%s\n" "$BASH_COMMAND" > ci-artifacts/a0-bootstrap-first-failing-command.txt; echo "A0_BOOTSTRAP_FAILED exit=$rc first_command=$BASH_COMMAND" >&2; exit "$rc"' ERR
expected="$A0_EXPECTED_SHA"
actual="$(git rev-parse HEAD)"
test "$actual" = "$expected"
test -z "$(git status --porcelain --untracked-files=no)"
for p in holochain/demo/Cargo.toml holochain/demo/coordinator/Cargo.toml holochain/demo/integrity/Cargo.toml holochain/demo/ham-adapter/Cargo.toml holochain/demo/ham-adapter/src/main.rs holochain/demo/integrity/src/lib.rs holochain/demo/coordinator/src/lib.rs; do
  git ls-files --error-unmatch -- "$p" >/dev/null
  test -s "$p"
done
# A4 already reviewed and committed the WASM/root Cargo.lock. Never regenerate
# or rewrite it. This CI job proposes ONLY the missing native HAM lock.
test -s holochain/demo/Cargo.lock
git ls-files --error-unmatch -- holochain/demo/Cargo.lock >/dev/null
if test -e holochain/demo/ham-adapter/Cargo.lock; then
  echo 'A0_BOOTSTRAP_REFUSED: native lock is already committed; no proposal required' >&2
  exit 3
fi
rustc +1.95.0 -Vv > ci-artifacts/a0-bootstrap-rustc.txt
cargo +1.95.0 -V > ci-artifacts/a0-bootstrap-cargo.txt
printf '%s\n' "$actual" > ci-artifacts/a0-bootstrap-source-commit.txt
# A source-provenance assertion, not dependency or security approval.
node scripts/ci/verify-integration-provenance.mjs > ci-artifacts/a0-bootstrap-source-provenance.txt
# Only Cargo dependency RESOLUTION. No cargo build/check/test, build scripts,
# zome calls, Lair, hc pack, conductor, mainnet, or economic functionality.
# Verify previously committed WASM graph without modifying its lock.
cargo +1.95.0 metadata --locked --no-deps --format-version 1 --manifest-path holochain/demo/Cargo.toml > ci-artifacts/a0-bootstrap-reviewed-wasm-metadata.json
# Native manifest now declares A4-reviewed standalone [workspace]. Resolve
# directly at the exact immutable SHA, but DO NOT treat this as approval.
grep -Eq '^\[workspace\]
cargo +1.95.0 metadata --locked --no-deps --format-version 1 --manifest-path holochain/demo/Cargo.toml > ci-artifacts/a0-bootstrap-wasm-metadata.json
sha256sum holochain/demo/Cargo.lock holochain/demo/ham-adapter/Cargo.lock > ci-artifacts/a0-bootstrap-lockfiles.sha256
git diff --exit-code -- Cargo.lock Cargo.toml holochain/demo
node --input-type=module <<'NODE' > ci-artifacts/a0-bootstrap-provenance.json
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('ci-integration-snapshot.json','utf8'));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const blob=p=>execFileSync('git',['hash-object','--',p],{encoding:'utf8'}).trim();
const inputs=['holochain/demo/Cargo.toml','holochain/demo/coordinator/Cargo.toml',
'holochain/demo/integrity/Cargo.toml','holochain/demo/ham-adapter/Cargo.toml',
'holochain/demo/ham-adapter/src/main.rs','holochain/demo/integrity/src/lib.rs',
'holochain/demo/coordinator/src/lib.rs'];
const locks=['holochain/demo/Cargo.lock','holochain/demo/ham-adapter/Cargo.lock'];
const report={schema:'hsc-a0-dependency-proposal-v1',
sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
sourceOwner:manifest.sources.RAVE,
rust:'1.95.0',holonixRevision:'a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da',
hamRevision:'fbb4b6eb8a79a507e9453b709ed00f15c5618fb4',
status:'REVIEWED_WASM_ROOT_LOCK_PRESERVED__NATIVE_RESOLUTION_PROPOSAL_NOT_COMMITTED',
nativeHamBootstrapMethod:'ACTUAL_A4_STANDALONE_NATIVE_WORKSPACE_NO_SOURCE_COPY',
nativeHamOriginalWorkspaceBoundaryRequiresAgent4Correction:false,
inputs: Object.fromEntries(inputs.map(p=>[p,{gitBlob:blob(p),sha256:digest(p),upstreamGitBlob:manifest.fileProvenance[p]?.sha}])),
locks:Object.fromEntries(locks.map(p=>[p,{sha256:digest(p),byteLength:readFileSync(p).length,tracked:p==='holochain/demo/Cargo.lock'}])),
nonAuthorizing:true,independentDependencyApproval:false,
dnaSourceScopeAuthenticated:false,compiled:false,installed:false,
signedWriteApproved:false,actionHash:null,
creditEligible:false,independentConsensusVerified:false,spendableBaseUnits:'0',
withdrawalAuthorized:false,
next:'Agent 4 inspects and separately commits both lockfiles only after dependency/source review.'};
for (const v of Object.values(report.inputs)) {
 if (v.gitBlob!==v.upstreamGitBlob) throw Error('A0_BOOTSTRAP_OWNER_SOURCE_DRIFT');
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
NODE
echo "REVIEWED_WASM_LOCK_PRESERVED__NATIVE_LOCK_PROPOSED_NOT_REVIEWED"
 holochain/demo/ham-adapter/Cargo.toml
cargo +1.95.0 generate-lockfile --manifest-path holochain/demo/ham-adapter/Cargo.toml
test -s holochain/demo/ham-adapter/Cargo.lock
cargo +1.95.0 metadata --locked --no-deps --format-version 1 --manifest-path holochain/demo/ham-adapter/Cargo.toml > ci-artifacts/a0-bootstrap-native-metadata.json
cargo +1.95.0 metadata --locked --no-deps --format-version 1 --manifest-path holochain/demo/Cargo.toml > ci-artifacts/a0-bootstrap-wasm-metadata.json
sha256sum holochain/demo/Cargo.lock holochain/demo/ham-adapter/Cargo.lock > ci-artifacts/a0-bootstrap-lockfiles.sha256
git diff --exit-code -- Cargo.lock Cargo.toml holochain/demo
node --input-type=module <<'NODE' > ci-artifacts/a0-bootstrap-provenance.json
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('ci-integration-snapshot.json','utf8'));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const blob=p=>execFileSync('git',['hash-object','--',p],{encoding:'utf8'}).trim();
const inputs=['holochain/demo/Cargo.toml','holochain/demo/coordinator/Cargo.toml',
'holochain/demo/integrity/Cargo.toml','holochain/demo/ham-adapter/Cargo.toml',
'holochain/demo/ham-adapter/src/main.rs','holochain/demo/integrity/src/lib.rs',
'holochain/demo/coordinator/src/lib.rs'];
const locks=['holochain/demo/Cargo.lock','holochain/demo/ham-adapter/Cargo.lock'];
const report={schema:'hsc-a0-dependency-proposal-v1',
sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
sourceOwner:manifest.sources.RAVE,
rust:'1.95.0',holonixRevision:'a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da',
hamRevision:'fbb4b6eb8a79a507e9453b709ed00f15c5618fb4',
status:'UNREVIEWED_RESOLUTION_PROPOSAL_NOT_COMMITTED',
nativeHamBootstrapMethod:'BYTE_IDENTICAL_MANIFEST_COPY_OUTSIDE_INHERITED_ROOT_WORKSPACE',
nativeHamOriginalWorkspaceBoundaryRequiresAgent4Correction:true,
inputs: Object.fromEntries(inputs.map(p=>[p,{gitBlob:blob(p),sha256:digest(p),upstreamGitBlob:manifest.fileProvenance[p]?.sha}])),
locks:Object.fromEntries(locks.map(p=>[p,{sha256:digest(p),byteLength:readFileSync(p).length,tracked:false}])),
nonAuthorizing:true,independentDependencyApproval:false,
dnaSourceScopeAuthenticated:false,compiled:false,installed:false,
signedWriteApproved:false,actionHash:null,
creditEligible:false,independentConsensusVerified:false,spendableBaseUnits:'0',
withdrawalAuthorized:false,
next:'Agent 4 inspects and separately commits both lockfiles only after dependency/source review.'};
for (const v of Object.values(report.inputs)) {
 if (v.gitBlob!==v.upstreamGitBlob) throw Error('A0_BOOTSTRAP_OWNER_SOURCE_DRIFT');
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
NODE
echo "PROPOSED_LOCKFILES_GENERATED_NOT_REVIEWED"
