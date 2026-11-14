import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
function execute(extraEnv={},args=[]){
  const dir=mkdtempSync(join(tmpdir(),'hsc-a0-'));
  const outfile=join(dir,'report.json');
  const child=spawnSync(process.execPath,
    ['demo/a0-evidence-summary.mjs','--out',outfile,...args],
    {encoding:'utf8',env:{...process.env,A0_EXPECTED_SHA:sha,...extraEnv}});
  let report;
  try{report=JSON.parse(readFileSync(outfile,'utf8'))}catch{}
  rmSync(dir,{recursive:true,force:true});
  return {child,report};
}
test('always rejects A0 acceptance, never promotes mock green flags',()=>{
  const {child,report}=execute({A0_FORCE_ACCEPT:'1',A0_APPROVED:'true'});
  assert.equal(child.status,0,child.stderr);
  assert.equal(report.sourceCommit,sha);
  assert.equal(report.decisions.A0,'BLOCKED_NOT_ACCEPTED');
  assert.equal(report.restrictions.creditEligible,false);
  assert.equal(report.restrictions.independentConsensusVerified,false);
  assert.equal(report.restrictions.spendableBaseUnits,'0');
  assert.equal(report.restrictions.withdrawalAuthorized,false);
  assert.equal(report.restrictions.deliveryAuthorized,false);
  assert.equal(report.restrictions.ownDnaSignedWriteVerified,false);
  assert.equal(report.workflowPasses,'NOT_VERIFIED_BY_THIS_SCRIPT');
  assert.equal(report.stages.refund,'HISTORY_INCOMPLETE_SELECTED_SIGNED_WITNESSES_ONLY');
});
test('refuses wrong expected immutable workflow SHA',()=>{
  const {child,report}=execute({A0_EXPECTED_SHA:'0'.repeat(40)});
  assert.notEqual(child.status,0);
  assert.match(child.stderr,/checked-out SHA differs from CI event SHA/);
  assert.equal(report,undefined);
});
test('strict A0 acceptance CLI exits blocked even when summary generated',()=>{
  const {child,report}=execute({},['--require-a0']);
  assert.equal(child.status,3,child.stderr);
  assert.equal(report.decisions.C,'NO_GO_ECONOMIC');
});
