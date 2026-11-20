import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,existsSync,rmSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('installer refuses before any Holochain/keystore invocation even with forged local approval flags',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hsc-no-mutation-'));
  try {
    const marker=join(dir,'mutation');
    for(const name of ['hc','holochain','lair-keystore','mktemp']) {
      const path=join(dir,name);
      writeFileSync(path,'#!/bin/sh\ntouch "'+marker+'"\nexit 99\n');chmodSync(path,0o700);
    }
    const result=spawnSync('bash',[resolve('scripts/ci/a0-own-dna-install-readonly.sh'),'absent.happ','absent.dna',join(dir,'output')],
      {encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,A0_APPROVED:'true',DEMO_ALLOW_TEST_ONLY_FIXTURE:'1',A0_EXACT_CALL_AUTHORIZED:'true'}});
    assert.equal(result.status,3,result.stderr);
    assert.match(result.stderr,/HOLOCHAIN_MUTATION_BLOCKED/);
    assert.equal(existsSync(marker),false,'mutation command invoked');
    assert.equal(existsSync(join(dir,'output')),false,'installer allocated output before authorization');
  } finally {rmSync(dir,{recursive:true,force:true})}
});

test('both automatic installer paths remain disabled; build artifacts survive the stop',()=>{
  const wf=readFileSync('.github/workflows/a0-own-dna-runtime.yml','utf8').split('\n  own-dna-install-readonly:\n')[1];
  assert.match(wf,/^    if: \$\{\{ false \}\}/m);
  const sameRun=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
  for(const name of ['Install disposable OWN audit DNA','Publish seven-stage report ONLY']) {
    const step=sameRun.slice(sameRun.indexOf('      - name: '+name)).split('\n      - name: ')[0];
    assert.match(step,/if: \$\{\{ false \}\}/);
  }
  assert.match(sameRun,/node demo\/a0-mutation-boundary.mjs --out/);
  assert.match(sameRun,/holochain\/demo\/ham-adapter\/target\/release\/solana-audit-ham-adapter/);
});

test('same-run OBS artifacts download into the directory read by source binding',()=>{
  const workflow=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
  const job=workflow.split('\n  own-dna-same-run-build-readonly:\n')[1];
  assert.match(job,/name: integration-cross-lane-js\n          path: ci-artifacts\n/);
});
