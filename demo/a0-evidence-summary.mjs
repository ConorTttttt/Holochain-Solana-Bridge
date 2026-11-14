#!/usr/bin/env node
/**
 * Integration-owned A0 evidence *inventory*, not security attestation.
 * Presence and SHA-256 of local files cannot prove that a workflow passed,
 * that Solana consensus was independently verified, or that Holochain wrote.
 * Deliberately NEVER emits A0 accepted, even when all files are present.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const denial = Object.freeze({
  creditEligible: false,
  independentConsensusVerified: false,
  spendableBaseUnits: '0',
  withdrawalAuthorized: false,
});
const expectedSha=process.env.A0_EXPECTED_SHA;
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(sha)) throw Error('A0_REFUSED: invalid checkout SHA');
if(expectedSha && (expectedSha!==sha || !/^[a-f0-9]{40}$/.test(expectedSha)))
  throw Error('A0_REFUSED: checked-out SHA differs from CI event SHA');
const args=process.argv.slice(2),outIndex=args.indexOf('--out');
if(outIndex!==-1 && (!args[outIndex+1] || args[outIndex+1].startsWith('--')))
  throw Error('A0_REFUSED: --out requires a filename');
const out=outIndex===-1 ? 'ci-artifacts/a0-evidence-summary.json' : args[outIndex+1];
const safeFiles=[
  'ci-integration-snapshot.json',
  'ci-artifacts/source-commit.sha',
  'ci-artifacts/demo-contract-denials.log',
  'ci-artifacts/demo-a0-failclosed.log',
  'ci-artifacts/real-signed-wire-observer.log',
  'ci-artifacts/real-snapshot-shadow-handoff.log',
  'ci-artifacts/cross-lane-summary.json',
  'target/localnet-evidence/source-commit.txt',
  'target/localnet-evidence/evidence-manifest.sha256',
  'target/localnet-evidence/program-id.txt',
  'target/idl/deposit_prototype.json',
  'target/deploy/deposit_prototype.so',
];
const files=Object.fromEntries(safeFiles.map(path=>{
  if(!existsSync(path) || !statSync(path).isFile())return [path,{status:'missing'}];
  const data=readFileSync(path);
  return [path,{status:'present_unverified',bytes:data.length,
    sha256:createHash('sha256').update(data).digest('hex')}];
}));
const sourceMarkers=[
  'ci-artifacts/source-commit.sha',
  'target/localnet-evidence/source-commit.txt',
];
const binding=Object.fromEntries(sourceMarkers.map(path=>{
  if(files[path].status==='missing')return [path,'not_available'];
  return [path,readFileSync(path,'utf8').trim()===sha?'same_sha':'MISMATCH'];
}));
let manifest=null;
try{manifest=JSON.parse(readFileSync('ci-integration-snapshot.json','utf8'))}
catch{}
const safeSourcePins=Object.fromEntries(['SOL','OBS','RAVE','SEC'].map(lane=>[
  lane, /^[a-f0-9]{40}$/.test(manifest?.sources?.[lane]?.sha??'')
    ? manifest.sources[lane].sha : null
]));
const summary={
  schema:'hsc-a0-evidence-inventory-v1',
  sourceCommit:sha,
  generatedAt:new Date().toISOString(),
  evidenceGrade:'FILE_INVENTORY_ONLY_NO_RUNTIME_ATTESTATION',
  workflowPasses:'NOT_VERIFIED_BY_THIS_SCRIPT',
  sourcePins:safeSourcePins,
  checkoutBinding:binding,
  files,
  stages:{
    localValidator:'REQUIRES_EXACT_SHA_ACTIONS_JOB_AND_SIGNED_ARCHIVE_REVIEW',
    observerKit:'REQUIRES_REAL_REPLAY_LOG_AND_SOURCE_BLOB_REVIEW',
    observerOutbox:'NOT_INTEGRATED_AUTHENTICATED_SOURCE',
    ownDnaBuild:'MISSING_COMPILED_071_WASM_DNA_HAPP_HASHES',
    holochainLairAuditWrite:'PROHIBITED_PENDING_INDEPENDENT_SECURITY_APPROVAL',
    actionHashTypedReadback:'NOT_PROVEN',
    restartAndDuplicate:'NOT_PROVEN_AGAINST_REAL_OWN_DNA',
    refund:'HISTORY_INCOMPLETE_SELECTED_SIGNED_WITNESSES_ONLY'
  },
  decisions:{
    A0:'BLOCKED_NOT_ACCEPTED',
    B1:'BLOCKED_INCOMPLETE_PRODUCED_SLOT_HISTORY',
    B2:'BLOCKED_UNYT_COORDINATOR_SOURCE_AND_CAPABILITY',
    C:'NO_GO_ECONOMIC'
  },
  blockers:[
    'A3_OUTBOX_REQUIRES_SOURCE_OWNED_IN_PROCESS_ADOPTION_AND_REAL_KIT',
    'A4_V1_FIXTURE_ONLY_DENIES_OBSERVER_REVIEWED_OUTBOX',
    'V2_SOURCE_WITNESS_DESTINATION_PROVENANCE_ABI_UNAPPROVED',
    'OWN_071_DNA_COMPILE_INSTALL_EXTERNAL_LAIR_SIGNED_ACTION_MISSING',
    'EXACT_MUTATING_CALL_TUPLE_NOT_INDEPENDENTLY_APPROVED',
    'HOSTILE_FILE_ROLLBACK_UNPROTECTED',
    'PRODUCED_SLOT_HISTORY_INCOMPLETE'
  ],
  restrictions:{
    historyComplete:false,deliveryAuthorized:false,refundDurablyCommitted:false,
    ownDnaSignedWriteVerified:false,independentSecurityApproved:false,...denial
  },
  provenanceNote:'Local hashes show exactly which files this checkout could inspect; they do not authenticate the contents, runtime execution, source history, approvals or external actors.'
};
const badBinding=Object.values(binding).includes('MISMATCH');
if(badBinding)summary.blockers.push('WRONG_SOURCE_SHA_IN_DOWNLOADED_EVIDENCE');
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(summary,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({
  sourceCommit:sha,a0:summary.decisions.A0,
  sourceBinding:binding,summaryFile:out,blockers:summary.blockers
},null,2));
if(badBinding)process.exitCode=2;
if(args.includes('--require-a0'))process.exitCode=3;
