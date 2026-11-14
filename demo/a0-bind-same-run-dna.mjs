#!/usr/bin/env node
/**
 * A1 CI only: derive a disposable audit DNA from the ORIGINAL same-run SOL
 * producer manifest, after genuine Kit/ledger admission. Never approves a call.
 * Modifies dna.yaml only in an ephemeral CI checkout, not the Git blob.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {assertDemoDomainShape} from '../tests/solana/demo-scope.mjs';
import {verifyExecutedSourceArtifact,assessDnaSourceBinding,DENIAL} from './a0-preauthorization-runner.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const HEX40=/^[a-f0-9]{40}$/;
function exactlyOneLine(yaml,key,value,indent='    '){
  // This function is used only for fixed, source-owned literal field names.
  assert.match(key,/^[a-zA-Z_]+$/,'A0_DNA_UNSAFE_PROPERTY_NAME');
  const re=new RegExp('^'+indent+key+':[^\\r\\n]*$','gm');
  const matches=[...yaml.matchAll(re)];
  assert.equal(matches.length,1,'A0_DNA_TEMPLATE_FIELD_CARDINALITY:'+key);
  assert.match(value,/^[a-zA-Z0-9_-]+$/,'A0_SOURCE_PROPERTY_UNSAFE:'+key);
  return yaml.replace(re,indent+key+': '+value);
}
export function renderBoundDna(template,source){
  assertDemoDomainShape(source);
  assert.equal((template.match(/^    demoOnly: true$/gm)||[]).length,1,'A0_NOT_AUDIT_ONLY_DNA');
  assert.equal((template.match(/^name: holochain_solana_audit_demo$/gm)||[]).length,1,'A0_WRONG_DEMO_DNA');
  const props={genesisHash:source.genesisHash,program:source.programId,
    mint:source.mint,holochainScope:source.initializedScopeHex};
  const seedDigest=sha256(Buffer.from('HSC/a0-same-run-audit-dna/v1\0'+
    [source.genesisHash,source.programId,source.mint,source.scopeHex].join('\0')));
  const seed='hsc-a0-'+seedDigest;
  let staged=exactlyOneLine(template,'network_seed',seed,'  ');
  for(const [key,value] of Object.entries(props))
    staged=exactlyOneLine(staged,key,value);
  const binding=assessDnaSourceBinding(staged,{genesisHash:props.genesisHash,
    program:props.program,mint:props.mint,scope:props.holochainScope});
  assert.equal(binding.state,'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM',
    'A0_DNA_BOUND_SOURCE_IDENTITY_MISMATCH');
  assert.ok(!/DEMO-ONLY-REPLACE|0707070707070707070707070707070707070707070707070707070707070707/.test(staged),
    'A0_DNA_PLACEHOLDER_STILL_PRESENT');
  return {staged,seed,binding};
}
function readRecordedDigest(path){
  const content=readFileSync(path+'.sha256','utf8').trim();
  const m=/^([a-f0-9]{64})  (\S+)$/.exec(content);
  assert.ok(m,'A0_ORIGINAL_KIT_MANIFEST_INVALID');
  assert.equal(m[2],basename(path),'A0_ORIGINAL_KIT_MANIFEST_FILENAME');
  return m[1];
}
export function confirmSourceAndWitness(source,observer,observerBytes,observerDigest,checkout){
  assert.ok(HEX40.test(checkout),'A0_INVALID_CONSUMER_SHA');
  assertDemoDomainShape(source);
  assert.equal(source.sourceCommitSha,checkout,'A0_SOL_PRODUCER_DIFFERENT_CHECKOUT');
  assert.deepEqual(observer.originalSolanaDomain,source,'A0_ORIGINAL_SOL_MANIFEST_SUBSTITUTED');
  const verified=verifyExecutedSourceArtifact(observer,checkout,observerBytes,observerDigest);
  assert.equal(verified.genesisHash,source.genesisHash,'A0_KIT_GENESIS_MISMATCH');
  assert.equal(verified.program,source.programId,'A0_KIT_PROGRAM_MISMATCH');
  assert.equal(verified.scope,source.scopeHex,'A0_KIT_SCOPE_MISMATCH');
  assert.equal(observer.observerReviewedWitnessV2?.source?.signature,
    source.transactions.deposit.signature,'A0_ORIGINAL_DEPOSIT_SIGNATURE_MISMATCH');
  assert.equal(observer.observerReviewedWitnessV2?.source?.codeVersion,checkout,
    'A0_REPLAY_CONSUMER_SHA_MISMATCH');
  return verified;
}
function main(){
  const argv=process.argv.slice(2);
  const i=argv.indexOf('--out');
  assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'A0_OUTPUT_DIRECTORY_REQUIRED');
  const out=argv[i+1];
  mkdirSync(out,{recursive:true});
  try{
    const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    assert.equal(process.env.A0_EXPECTED_SHA,checkout,'A0_NOT_EXACT_WORKFLOW_HEAD');
    const sourcePath='target/localnet-evidence/demo-source-domain.json';
    const sourceBytes=readFileSync(sourcePath);
    const source=JSON.parse(sourceBytes);
    const observerPath='ci-artifacts/observer-fresh-domain-reviewed-v2-original-signed-localnet.json';
    const observerBytes=readFileSync(observerPath);
    const observer=JSON.parse(observerBytes);
    const verified=confirmSourceAndWitness(source,observer,observerBytes,
      readRecordedDigest(observerPath),checkout);
    assert.equal(sha256(readFileSync('target/idl/deposit_prototype.json')),
      source.idlSha256,'A0_ORIGINAL_IDL_BYTES_MISMATCH');
    assert.equal(sha256(readFileSync('target/deploy/deposit_prototype.so')),
      source.elfSha256,'A0_ORIGINAL_ELF_BYTES_MISMATCH');
    const archiveManifest=readFileSync('target/localnet-evidence/evidence-manifest.sha256','utf8');
    assert.ok(archiveManifest.split(/\r?\n/).includes(sha256(sourceBytes)+'  ./demo-source-domain.json'),
      'A0_SOURCE_NOT_IN_ORIGINAL_SOL_ARCHIVE_MANIFEST');
    const yamlPath='holochain/demo/dna.yaml';
    const original=readFileSync(yamlPath,'utf8');
    const tracked=execFileSync('git',['show','HEAD:'+yamlPath],{encoding:'utf8'});
    assert.equal(original,tracked,'A0_DNA_TEMPLATE_WAS_MODIFIED_BEFORE_SOURCE_BINDING');
    const {staged,seed,binding}=renderBoundDna(original,source);
    const report={schema:'hsc-a0-same-run-derived-dna-source-v1',
      evidenceGrade:'EXECUTED_SAME_SHA_SOL_KIT_SOURCE_PROPERTIES_NOT_INSTALLED',
      sourceProducerCommitSha:source.sourceCommitSha,
      observerReplayConsumerCommitSha:checkout,
      originalSourceManifestSha256:sha256(sourceBytes),
      originalKitReplayArtifactSha256:sha256(observerBytes),
      originalSignedDepositWireSha256:verified.originalSignedWireSha256,
      signedDepositSignature:source.transactions.deposit.signature,
      sourceGenesisHash:source.genesisHash,sourceProgram:source.programId,
      sourceMint:source.mint,initializedHolochainScope:source.initializedScopeHex,
      originalDnaTemplateSha256:sha256(original),
      derivedDnaSourceSha256:sha256(staged),
      deterministicPublicDemoNetworkSeed:seed,
      bindingState:binding.state,historyComplete:false,observerTransport:'NOT_APPROVED',
      dnaBuilt:false,dnaInstalled:false,externalLairVerified:false,
      approvedZomeWrite:false,actionHash:null,...DENIAL};
    writeFileSync(join(out,'original-dna-template.yaml'),original,{mode:0o600});
    writeFileSync(join(out,'bound-dna-source.yaml'),staged,{mode:0o600});
    writeFileSync(join(out,'source-domain-binding.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
    // Checkout-only materialization; original SHA and bytes were saved above.
    writeFileSync(yamlPath,staged,{mode:0o600});
    console.log('A0_SAME_RUN_SOURCE_BOUND_DNA_PROPERTIES_STAGED_NOT_BUILT',
      checkout,report.derivedDnaSourceSha256);
  }catch(e){
    const denial={schema:'hsc-a0-same-run-source-bind-failure-v1',
      state:'BLOCKED_SOURCE_DOMAIN_BINDING',error:String(e?.message??e),
      dnaBuilt:false,dnaInstalled:false,actionHash:null,...DENIAL};
    writeFileSync(join(out,'source-domain-binding-failure.json'),JSON.stringify(denial,null,2)+'\n',{mode:0o600});
    throw e;
  }
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)main();
