import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
function run(env={},flags=[]){
  const directory=mkdtempSync(join(tmpdir(),'a0-own-dna-'));
  const path=join(directory,'report.json');
  const child=spawnSync(process.execPath,['demo/a0-runtime-gate.mjs','--out',path,...flags],
    {encoding:'utf8',env:{...process.env,A0_EXPECTED_SHA:sha,...env}});
  let report;
  try{report=JSON.parse(readFileSync(path,'utf8'))}catch{}
  rmSync(directory,{recursive:true,force:true});
  return {child,report};
}
test('runtime inventory never upgrades signed-write or economic gates from local flags',()=>{
  const {child,report}=run({A0_APPROVED:'true',A0_FORCE_ACCEPT:'1',
    DEMO_ALLOW_TEST_ONLY_FIXTURE:'1',DEMO_EXPECTED_DNA_HASH:'untrusted'});
  assert.equal(child.status,0,child.stderr);
  assert.equal(report.sourceCommit,sha);
  assert.equal(report.decisions.A0,'BLOCKED_NOT_ACCEPTED');
  assert.equal(report.stages.audit_record_written,'BLOCKED_NO_INDEPENDENT_CALL_APPROVAL');
  assert.equal(report.stages.readback_verified,'BLOCKED_NO_REAL_ACTIONHASH');
  assert.equal(report.stages.history_incomplete,true);
  assert.equal(report.stages.blocked,true);
  assert.equal(report.canInvokeRecordObservation,false);
  assert.equal(report.creditEligible,false);
  assert.equal(report.independentConsensusVerified,false);
  assert.equal(report.spendableBaseUnits,'0');
  assert.equal(report.withdrawalAuthorized,false);
});
test('wrong immutable GitHub event SHA refuses before producing a report',()=>{
  const {child,report}=run({A0_EXPECTED_SHA:'0'.repeat(40)});
  assert.notEqual(child.status,0);
  assert.match(child.stderr,/checkout SHA differs from event SHA/);
  assert.equal(report,undefined);
});
test('mutating-call acceptance cannot be enabled by static build prerequisites',()=>{
  const {child,report}=run({},['--require-write']);
  assert.equal(child.status,3,child.stderr);
  assert.equal(report.independentSecurityApproved,false);
  assert.equal(report.canInvokeRecordObservation,false);
});
test('build gate only checks committed prerequisites, never approves signed write',()=>{
  const {child,report}=run({},['--require-build']);
  assert.equal(child.status,report.buildInputsTracked?0:3,child.stderr);
  assert.equal(report.canInvokeRecordObservation,false);
  if(!report.buildInputsTracked)assert.ok(report.blockers.some(x=>x.includes('BUILD_INPUT')||x.includes('SOLANA_SCOPE')));
});
