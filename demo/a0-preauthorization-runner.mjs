#!/usr/bin/env node
/**
 * A1 CI lane: deterministic, same-checkout first-demo PREAUTHORIZATION runner.
 * Re-executes the real SOL archive -> production OBS Kit v2 replay. It NEVER
 * creates a capability grant, connects to Holochain, or calls a mutating zome.
 * An independently reviewed tuple and separately audited, approved signed
 * write implementation are prerequisites for any future stage 4-7 runner.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,basename} from 'node:path';

export const DENIAL=Object.freeze({creditEligible:false,
  independentConsensusVerified:false,spendableBaseUnits:'0',
  withdrawalAuthorized:false});
const sha256=x=>createHash('sha256').update(x).digest('hex');
const hex40=/^[a-f0-9]{40}$/;
const hex64=/^[a-f0-9]{64}$/;
const STAGES=['source_verified','observer_evidence_admitted',
  'holochain_runtime_installed','exact_call_approved',
  'signed_audit_action_executed','typed_readback_verified',
  'restart_replay_verified'];
function checkDenials(object,where){
  for(const [k,v] of Object.entries(DENIAL))
    assert.equal(object?.[k],v,'ECONOMIC_DENIAL_DRIFT:'+where+':'+k);
}
// Structural postcondition for the actual production source-domain replay.
// Only the executed source verifier, not this JSON check, validates signed
// transaction cryptography, IDL/ELF, finalized RPC, accounts and Kit/ledger.
export function verifyExecutedSourceArtifact(item,checkout,bytes,checksum){
  assert.ok(hex40.test(checkout),'INVALID_CHECKOUT_SHA');
  assert.ok(hex64.test(checksum),'MISSING_OR_INVALID_ORIGINAL_ARTIFACT_CHECKSUM');
  assert.equal(sha256(bytes),checksum,'ORIGINAL_ARTIFACT_BYTES_DIGEST_MISMATCH');
  assert.equal(item.schema,'hsc-a1-same-sha-fresh-signed-source-v2-queued-not-delivered');
  assert.equal(item.immutableSourceCommitSha,checkout,'ORIGINAL_SOURCE_SHA_MISMATCH');
  assert.equal(item.originalSolanaDomain?.sourceCommitSha,checkout,'ORIGINAL_SOL_DOMAIN_SHA_MISMATCH');
  assert.ok(hex64.test(item.originalSignedTransactionSha256),'ORIGINAL_SIGNED_WIRE_HASH_MISSING');
  assert.equal(item.originalContainingBlockhash?.length>0,true,'ORIGINAL_CONTAINING_BLOCK_MISSING');
  assert.equal(item.durableOutboxReopened,'pending','DURABLE_OUTBOX_NOT_REOPENED_PENDING');
  assert.equal(item.transportRefusal,'REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED');
  assert.equal(item.noHolochainAck,true,'UNAPPROVED_ACK_CLAIM');
  assert.deepEqual(item.destinationReadback,{state:'not_approved_or_written',actionHash:null});
  assert.equal(item.refundHistoryComplete,false,'HISTORY_FALSE_APPROVAL');
  assert.equal(item.independentRpcConsensusVerified,false,'RPC_CONSENSUS_FALSE_APPROVAL');
  const w=item.observerReviewedWitnessV2;
  assert.equal(w?.kind,'solana-observation-demo-v2','ORIGINAL_WITNESS_V2_MISSING');
  assert.ok(hex64.test(w.witnessDigest),'ORIGINAL_V2_WITNESS_DIGEST_MISSING');
  assert.equal(w.source?.codeVersion,checkout,'V2_WITNESS_CODE_VERSION_MISMATCH');
  assert.equal(w.source?.signature,item.originalSolanaDomain?.transactions?.deposit?.signature,
    'V2_WITNESS_SOURCE_TX_MISMATCH');
  assert.equal(w.source?.depositNonce,item.originalSolanaDomain?.nonce,'V2_DEPOSIT_NONCE_MISMATCH');
  assert.equal(w.source?.recipientCore,item.originalSolanaDomain?.recipientCoreHex,
    'V2_DEPOSIT_RECIPIENT_MISMATCH');
  assert.equal(w.source?.holochainScope,item.originalSolanaDomain?.scopeHex,
    'V2_SIGNED_SCOPE_MISMATCH');
  assert.equal(w.source?.amountBaseUnits,item.originalSolanaDomain?.amountBaseUnits,
    'V2_DEPOSIT_AMOUNT_MISMATCH');
  assert.equal(w.proof?.historyComplete,false,'V2_HISTORY_FALSE_APPROVAL');
  for(const [o,label] of [[item,'root'],[w,'witness'],[w.source,'source'],[w.proof,'proof']])
    checkDenials(o,label);
  return {artifactSha256:checksum,originalSignedWireSha256:item.originalSignedTransactionSha256,
    witnessDigest:w.witnessDigest,sourceSignature:w.source.signature,
    program:item.originalSolanaDomain.programId,genesisHash:item.originalSolanaDomain.genesisHash,
    scope:item.originalSolanaDomain.scopeHex,historyComplete:false};
}
// Source properties are public binding data, not proof of an installed DNA.
// Do not allow CI to point a genuine OBS witness at another local validator.
export function assessDnaSourceBinding(yaml,source){
  const expected={genesisHash:source.genesisHash,program:source.program,
    mint:source.mint,holochainScope:source.scope};
  const observed={};
  const props=['genesisHash','program','mint','holochainScope'];
  const entries=new Map();
  for(const line of yaml.split(/\r?\n/)){
    const match=/^    (genesisHash|program|mint|holochainScope):\s*['"]?([a-zA-Z0-9]+)['"]?\s*$/.exec(line);
    if(match){
      if(entries.has(match[1]))entries.set(match[1],null); // refuse duplicates
      else entries.set(match[1],match[2]);
    }
  }
  for(const key of props)observed[key]=entries.get(key)??null;
  const mismatched=props.filter(k=>observed[k]!==expected[k]);
  return {state:mismatched.length?'BLOCKED_OBSERVER_DNA_SOURCE_DOMAIN_MISMATCH':
      'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM',
    expected,observed,mismatched};
}
const blockedStage='BLOCKED_PENDING_INDEPENDENT_EXACT_TUPLE_APPROVAL';
function baseReport(checkout){
  return {schema:'hsc-a1-preauthorization-seven-stage-v1',
    sourceCommit:checkout??null,
    evidenceGrade:'EXECUTED_SAME_SHA_ARCHIVED_SOLANA_KIT_REPLAY_IF_PASS__NO_HOLOCHAIN_WRITE',
    demoType:'OWN_DISPOSABLE_HOLOCHAIN_AUDIT_ONLY',
    stages:Object.fromEntries(STAGES.map(x=>[x,{state:'NOT_EXECUTED'}])),
    approval:{state:blockedStage,requiredTuple:[
      'immutableSolanaAndObserverSourceSHA','ownDnaIntegrityWasmSha256',
      'ownDnaCoordinatorWasmSha256','nativeHamSha256','dnaBundleSha256',
      'happBundleSha256','actualDnaHash','installedAppId','fullCellId',
      'externalLairSigner','zome','function','canonicalPayloadBytesAndDigest',
      'independentApproverAndAuthenticatedDecision'],
      supplied:false,accepted:false},
    observerTransport:'REFUSED_UNAPPROVED_V2',
    signedCallExecuted:false,actionHash:null,historyComplete:false,
    independentSecurityApproved:false,
    decisions:{A0:'BLOCKED_NOT_ACCEPTED',B1:'BLOCKED_HISTORY_INCOMPLETE',
      B2:'BLOCKED_PUBLISHED_UNYT_UNAPPROVED',C:'NO_GO_ECONOMIC'},
    ...DENIAL,
  };
}
function gitHead(){
  const x=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});
  if(x.status!==0)throw Error('GIT_CHECKOUT_UNAVAILABLE');
  return x.stdout.trim();
}
function artifactFromReplay(){
  const file='ci-artifacts/observer-fresh-domain-reviewed-v2-original-signed-localnet.json';
  const bytes=readFileSync(file);
  const manifest=readFileSync(file+'.sha256','utf8').trim();
  const m=/^([a-f0-9]{64})\s{2}(\S+)$/.exec(manifest);
  assert.ok(m,'INVALID_ORIGINAL_ARTIFACT_SHA256_MANIFEST');
  assert.equal(m[2],basename(file),'ORIGINAL_ARTIFACT_MANIFEST_FILENAME_MISMATCH');
  return {bytes,checksum:m[1],item:JSON.parse(bytes)};
}
function run(){
  const args=process.argv.slice(2);
  const outAt=args.indexOf('--out');
  if(outAt>=0 && (!args[outAt+1] || args[outAt+1].startsWith('--')))
    throw Error('A0_PREAUTH_REFUSED: --out requires path');
  const out=outAt>=0?args[outAt+1]:'ci-artifacts/a0-preauthorization-seven-stage.json';
  const report=baseReport(null);
  let exit=0;
  try{
    const sha=gitHead(); report.sourceCommit=sha;
    assert.ok(hex40.test(sha),'CHECKOUT_SHA_INVALID');
    assert.equal(process.env.A0_EXPECTED_SHA,sha,'CHECKOUT_NOT_CI_EVENT_SHA');
    const script='scripts/ci/a0-demo-domain-kit-v2.mjs';
    const owned=spawnSync('git',['ls-files','--error-unmatch','--',script],{encoding:'utf8'});
    assert.equal(owned.status,0,'CI_REPLAY_SCRIPT_NOT_TRACKED');
    const child=spawnSync(process.execPath,['--test',script],{encoding:'utf8',maxBuffer:16*1024*1024});
    report.execution={program:'node',script,exitCode:child.status,
      exitSignal:child.signal??null,
      stdoutSha256:sha256(child.stdout??''),stderrSha256:sha256(child.stderr??''),
      stdoutTail:(child.stdout??'').slice(-2000),stderrTail:(child.stderr??'').slice(-1000)};
    assert.equal(child.status,0,'ACTUAL_SAME_SHA_SOL_OBS_KIT_REPLAY_FAILED');
    assert.match(child.stdout,/FRESH_DEMO_DOMAIN_ORIGINAL_KIT_V2_QUEUED_NOT_DELIVERED/,
      'REAL_KIT_REPLAY_SUCCESS_MARKER_MISSING');
    const {bytes,checksum,item}=artifactFromReplay();
    const verified=verifyExecutedSourceArtifact(item,sha,bytes,checksum);
    report.execution.evidence=verified;
    // Preserve A4's authentic archived template mismatch. This checked-in
    // template is NOT retroactively relabelled as the new disposable source.
    const sourceDomain={...verified,mint:item.originalSolanaDomain.mint};
    report.checkedInA4TemplateSourceBinding=assessDnaSourceBinding(
      readFileSync('holochain/demo/dna.yaml','utf8'),sourceDomain);
    // Separately inspect the true same-execution DNA BUILD INPUT. Passing this
    // byte/hash/source check proves NO compiled DNA or installed runtime.
    const projected='ci-artifacts/a0-execution-bound-dna.yaml';
    const projectedBytes=readFileSync(projected);
    const projectedLine=readFileSync(projected+'.sha256','utf8').trim();
    const projectedMatch=/^([a-f0-9]{64})\s{2}(\S+)$/.exec(projectedLine);
    assert.ok(projectedMatch && projectedMatch[2]===basename(projected),
      'SOURCE_BOUND_DNA_MANIFEST_INVALID');
    assert.equal(sha256(projectedBytes),projectedMatch[1],
      'SOURCE_BOUND_DNA_BYTES_DIGEST_MISMATCH');
    const projectionPath=projected.replace(/\.yaml$/,'.report.json');
    const projectionBytes=readFileSync(projectionPath);
    const projectionLine=readFileSync(projectionPath+'.sha256','utf8').trim();
    const projectionMatch=/^([a-f0-9]{64})\s{2}(\S+)$/.exec(projectionLine);
    assert.ok(projectionMatch && projectionMatch[2]===basename(projectionPath),
      'SOURCE_BOUND_DNA_REPORT_MANIFEST_INVALID');
    assert.equal(sha256(projectionBytes),projectionMatch[1],
      'SOURCE_BOUND_DNA_REPORT_BYTES_DIGEST_MISMATCH');
    const projection=JSON.parse(projectionBytes);
    assert.equal(projection.schema,'hsc-a1-execution-bound-dna-v1');
    assert.equal(projection.producerSourceCommitSha,sha,'SOURCE_BOUND_PRODUCER_SHA');
    assert.equal(projection.consumerCodeCommitSha,sha,'SOURCE_BOUND_CONSUMER_SHA');
    assert.equal(projection.replayArtifactSha256,checksum,'SOURCE_BOUND_REPLAY_HASH');
    assert.equal(projection.originalSignedDepositWireSha256,
      verified.originalSignedWireSha256,'SOURCE_BOUND_ORIGINAL_SIGNED_WIRE_HASH');
    assert.equal(projection.reviewedWitnessDigest,verified.witnessDigest,
      'SOURCE_BOUND_WITNESS_DIGEST');
    assert.equal(projection.generatedYamlSha256,projectedMatch[1],
      'SOURCE_BOUND_GENERATED_YAML_DIGEST_MISMATCH');
    checkDenials(projection,'source-bound-build-input');
    assert.equal(projection.compiled,false,'BUILD_INPUT_PRETENDS_COMPILED');
    assert.equal(projection.installed,false,'BUILD_INPUT_PRETENDS_INSTALLED');
    assert.equal(projection.independentApproval,false,'BUILD_INPUT_PRETENDS_APPROVAL');
    assert.equal(projection.actionHash,null,'BUILD_INPUT_PRETENDS_ACTION_HASH');
    report.sourceDnaDomainBinding=assessDnaSourceBinding(
      projectedBytes.toString('utf8'),sourceDomain);
    assert.equal(report.sourceDnaDomainBinding.state,
      'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM','SOURCE_BOUND_DNA_MISMATCH');
    report.executionBoundDnaBuildInput={
      yamlSha256:projectedMatch[1],reportSha256:projectionMatch[1],
      originalManifestSha256:projection.originalManifestSha256,
      producerSourceCommitSha:projection.producerSourceCommitSha,
      consumerCodeCommitSha:projection.consumerCodeCommitSha,
      installed:false,approved:false};
    report.stages.source_verified={state:'EXECUTED_SAME_SHA_ORIGINAL_SIGNED_SOURCE_KIT',
      originalSignedWireSha256:verified.originalSignedWireSha256,
      sourceCommit:sha,historyComplete:false,independentConsensusVerified:false};
    report.stages.observer_evidence_admitted={state:'EXECUTED_KIT_V2_DURABLE_PENDING_NO_ACK',
      witnessDigest:verified.witnessDigest,transportRefusal:item.transportRefusal,
      durableOutboxReopened:'pending'};
  }catch(err){
    exit=2;
    report.failure={class:'SOURCE_OR_OBSERVER_REPLAY_NOT_ADMITTED',message:String(err?.message??err)};
    report.stages.source_verified.state='FAILED_OR_NOT_EXECUTED';
    report.stages.observer_evidence_admitted.state='FAILED_OR_NOT_EXECUTED';
  }
  report.stages.holochain_runtime_installed={state:report.sourceDnaDomainBinding?.mismatched?.length
      ?'BLOCKED_OBSERVER_DNA_SOURCE_DOMAIN_MISMATCH':'NOT_EXECUTED_IN_THIS_RUNNER',
    reason:'SEPARATE_REAL_071_LOCKED_BUILD_INSTALL_AND_EXTERNAL_LAIR_PREFLIGHT_REQUIRED',
    sourceBinding:report.sourceDnaDomainBinding?.state??'NOT_CHECKED'};
  report.stages.exact_call_approved={state:blockedStage,
    reason:'NO_INDEPENDENT_AUTHENTICATED_SOURCE_BINARY_CELL_AGENT_SIGNER_FUNCTION_PAYLOAD_APPROVAL'};
  for(const x of ['signed_audit_action_executed','typed_readback_verified','restart_replay_verified'])
    report.stages[x]={state:'NOT_EXECUTED_APPROVAL_ABSENT'};
  report.result=exit===0?'REPLAY_EXECUTED__AUDIT_WRITE_BLOCKED':'REPLAY_FAILED__AUDIT_WRITE_BLOCKED';
  mkdirSync(dirname(out),{recursive:true});
  const data=Buffer.from(JSON.stringify(report,null,2)+'\n');
  writeFileSync(out,data,{mode:0o600});
  writeFileSync(out+'.sha256',sha256(data)+'  '+basename(out)+'\n',{mode:0o600});
  console.log(JSON.stringify({sourceCommit:report.sourceCommit,result:report.result,
    stages:report.stages,report:out,sha256:sha256(data)}));
  if(args.includes('--require-full-demo'))exit=exit||3;
  process.exitCode=exit;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href)run();
