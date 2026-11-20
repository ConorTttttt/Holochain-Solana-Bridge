#!/usr/bin/env node
// No approval parser or environment-variable override: an independent exact-call
// authorization must be reviewed before a mutating execution path is added.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

const args=process.argv.slice(2);
if(args.length===1 && args[0]==='--require-authorization') {
  console.error('HOLOCHAIN_MUTATION_BLOCKED: independent exact-call authorization absent; installation/genesis, enablement, signing setup, grants and zome writes are prohibited');
  process.exit(3);
}
assert.equal(args.length,2,'usage: --out <authorization-request.json>');
assert.equal(args[0],'--out');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(process.env.A0_EXPECTED_SHA,sourceCommit,'wrong immutable build SHA');
const root='holochain/demo/';
// Verify the actual compiler/packer output, including native HAM, both WASMs,
// bundles and both locks, before describing anything as a build candidate.
execFileSync('sha256sum',['--check','demo-build-artifacts.sha256'],{cwd:root});
const hashText=readFileSync(root+'demo-build-dna-hash.txt','utf8');
const dnaHashes=hashText.match(/uhC0k[A-Za-z0-9_-]{48}/g)??[];
assert.equal(dnaHashes.length,1,'missing or ambiguous actual hc DNA hash');
const bindingBytes=readFileSync('ci-artifacts/a0-bound-dna/source-domain-binding.json');
const binding=JSON.parse(bindingBytes);
assert.equal(binding.sourceProducerCommitSha,sourceCommit,'producer SHA differs');
assert.equal(binding.observerReplayConsumerCommitSha,sourceCommit,'observer SHA differs');
assert.equal(binding.approvedZomeWrite,false);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(readFileSync(root+'dna.yaml')),binding.derivedDnaSourceSha256,'bound DNA source changed');
const files=['ham-adapter/target/release/solana-audit-ham-adapter',
  'target/wasm32-unknown-unknown/release/solana_audit_integrity.wasm',
  'target/wasm32-unknown-unknown/release/solana_audit.wasm',
  'holochain_solana_audit_demo.dna','holochain_solana_audit_demo.happ',
  'Cargo.lock','ham-adapter/Cargo.lock'];
const report={schema:'hsc-a0-pre-mutation-authorization-request-v1',sourceCommit,
  state:'STOPPED_BEFORE_ANY_HOLOCHAIN_MUTATION',authorization:'NOT_SUPPLIED',
  builtDnaHash:dnaHashes[0],sourceBindingSha256:hash(bindingBytes),
  artifacts:Object.fromEntries(files.map(p=>[root+p,{sha256:hash(readFileSync(root+p))}])),
  proposedInstaller:{argv:['bash','scripts/ci/a0-own-dna-install-readonly.sh',
    root+'holochain_solana_audit_demo.happ',root+'holochain_solana_audit_demo.dna',
    'ci-artifacts/own-dna-conductor'],
    scriptSha256:hash(readFileSync('scripts/ci/a0-own-dna-install-readonly.sh')),
    appId:'hsc-audit-demo-readonly',
    mutations:['create disposable keystore/agent','install app and run cell genesis','start/enable disposable app'],
    exactRuntimePathsAndAgent:'UNALLOCATED_REQUIRES_SEPARATE_REVIEW'},
  installed:false,runtimeIdentityVerified:false,externalLairVerified:false,
  signedWriteApproved:false,actionHash:null,readbackVerified:false,restartReplayVerified:false,
  creditEligible:false,independentConsensusVerified:false,spendableBaseUnits:'0',withdrawalAuthorized:false,
  note:'Build evidence only. No request, CI success, checksum or caller flag is independent authorization. This installer does not establish external-Lair HAM identity. Reviewed v2 ABI and a later exact zome call require separate approval.'};
mkdirSync(dirname(args[1]),{recursive:true});
writeFileSync(args[1],JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(report.state);
