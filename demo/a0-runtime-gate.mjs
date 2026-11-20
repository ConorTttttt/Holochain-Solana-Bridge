#!/usr/bin/env node
/**
 * CI-owned readiness inventory for a future own-DNA runtime lane.
 * NEVER executes or authorizes record_observation; immutable source/lock
 * presence is not security approval, RPC consensus, or a signed ActionHash.
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, existsSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

const args=process.argv.slice(2);
const outAt=args.indexOf('--out');
if(outAt>=0 && (!args[outAt+1] || args[outAt+1].startsWith('--'))){
  throw Error('A0_RUNTIME_REFUSED: --out requires a path');
}
const output=outAt>=0?args[outAt+1]:'ci-artifacts/a0-runtime-readiness.json';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[0-9a-f]{40}$/.test(sha)) throw Error('A0_RUNTIME_REFUSED: invalid git SHA');
const expected=process.env.A0_EXPECTED_SHA;
if(expected && (expected!==sha || !/^[0-9a-f]{40}$/.test(expected))){
  throw Error('A0_RUNTIME_REFUSED: checkout SHA differs from event SHA');
}
const pins=JSON.parse(readFileSync('demo/a0-runtime-source-pins.json','utf8'));
const hex40=/^[0-9a-f]{40}$/;
for(const source of Object.values(pins.candidateSourceOwners)){
  if(!hex40.test(source.sha))throw Error('A0_RUNTIME_REFUSED: unpinned owner source');
}
if(pins.schema!=='hsc-a0-runtime-source-pins-v1' ||
   pins.toolchains.rust!=='1.95.0' || pins.toolchains.holochain!=='0.7.1' ||
   !hex40.test(pins.toolchains.holonixRevision) || !hex40.test(pins.toolchains.hamRevision) ||
   pins.policy.readOnlyBuildEvaluationOnly!==true ||
   pins.policy.approvedObserverDnaV2Abi!==false || pins.policy.approvedMutatingCall!==false ||
   pins.policy.allowPublishedUnytCoordinator!==false ||
   pins.policy.allowEconomicCredit!==false || pins.policy.allowSolanaWithdrawal!==false){
  throw Error('A0_RUNTIME_REFUSED: unsafe build manifest');
}
const blockers=[];
const fileState={};
for(const path of pins.reviewedBuildInputs){
  if(!/^[\w./-]+$/.test(path) || path.includes('..')) throw Error('A0_RUNTIME_REFUSED: unsafe source path');
  const present=existsSync(path);
  let tracked=false;
  if(present){
    try{execFileSync('git',['ls-files','--error-unmatch','--',path],{stdio:'ignore'});tracked=true}catch{}
  }
  const ready=present&&tracked;
  fileState[path]={present,tracked,sha256:ready?createHash('sha256').update(readFileSync(path)).digest('hex'):null};
  if(!ready)blockers.push('MISSING_TRACKED_BUILD_INPUT:'+path);
}
const yamlPath='holochain/demo/dna.yaml';
let scope='NOT_AVAILABLE';
if(fileState[yamlPath]?.tracked){
  const contents=readFileSync(yamlPath,'utf8');
  scope=/DEMO-ONLY-REPLACE|0707070707070707070707070707070707070707070707070707070707070707/.test(contents)
    ? 'PLACEHOLDER_REFUSED' : 'PRESENT_REQUIRES_REAL_SOURCE_PROVENANCE';
}
if(scope!=='PRESENT_REQUIRES_REAL_SOURCE_PROVENANCE')blockers.push('UNVERIFIED_DISPOSABLE_SOLANA_SCOPE');
// Even a fully populated immutable build tree is not proof of a compiled
// artifact, approved ABI or authorization to mutate an installed DNA.
const staticBuildInputsPresent=blockers.every(x=>!x.startsWith('MISSING_TRACKED_BUILD_INPUT:')) &&
  scope==='PRESENT_REQUIRES_REAL_SOURCE_PROVENANCE';
blockers.push('V2_OBSERVER_DNA_CONTRACT_NOT_INDEPENDENTLY_APPROVED');
blockers.push('REAL_LAIR_SIGNED_AUDIT_WRITE_NOT_AUTHORIZED');
blockers.push('NO_INSTALLED_DNA_CELLID_AGENT_AND_ACTIONHASH');
blockers.push('SOLANA_PRODUCED_SLOT_HISTORY_INCOMPLETE');
const report={
  schema:'hsc-a0-runtime-readiness-v1',
  generatedAt:new Date().toISOString(),
  sourceCommit:sha,
  evidenceGrade:'STATIC_SOURCE_AND_LOCKFILE_INVENTORY_ONLY',
  pinnedSources:pins.candidateSourceOwners,
  tools:pins.toolchains,
  files:fileState,
  sourceScopeStatus:scope,
  buildInputsTracked:staticBuildInputsPresent,
  stages:{
    source_verified:'REQUIRES_SAME_SHA_REAL_KIT_SIGNED_WIRE_REPLAY',
    outbox_queued:'REQUIRES_AUTHENTICATED_A3_V2_IN_PROCESS_HANDOFF',
    audit_record_written:'BLOCKED_NO_INDEPENDENT_CALL_APPROVAL',
    readback_verified:'BLOCKED_NO_REAL_ACTIONHASH',
    history_incomplete:true,
    blocked:true
  },
  decisions:{A0:'BLOCKED_NOT_ACCEPTED',B1:'BLOCKED_HISTORY_INCOMPLETE',
    B2:'BLOCKED_RELEASED_UNYT_COORDINATOR',C:'NO_GO_ECONOMIC'},
  independentSecurityApproved:false,
  canInvokeRecordObservation:false,
  creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false,
  blockers,
  note:'No file hash, environment variable, Actions job status or JSON origin label upgrades A0. Read-only build evaluation is distinct from an authorized signed call.'
};
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({sourceCommit:sha,buildInputsTracked:staticBuildInputsPresent,
  a0:report.decisions.A0,blockers,report:output}));
if(args.includes('--require-write'))process.exitCode=3;
else if(args.includes('--require-build')&&!staticBuildInputsPresent)process.exitCode=3;
