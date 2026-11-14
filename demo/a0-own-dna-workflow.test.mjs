import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// This is a CI *scheduling* regression, not a Holochain build or write test.
// It prevents the P0 job from silently returning to workflow_dispatch-only.
const workflow=readFileSync('.github/workflows/a0-own-dna-runtime.yml','utf8');
const job=workflow.split('\n  own-dna-build:\n')[1];

test('own-DNA build is eligible for immutable pull-request HEAD, not only dispatch',()=>{
  assert.match(workflow,/on:\n  pull_request:/);
  assert.ok(job,'missing actual own-dna-build job');
  assert.doesNotMatch(job,/^    if:\s*github\.event_name\s*==\s*['"]workflow_dispatch['"]/m);
  assert.match(job,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(job,/A0_EXPECTED_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(job,/test "\$\(git rev-parse HEAD\)" = "\$A0_EXPECTED_SHA"/);
});

test('required preflight refuses incomplete source before installing Nix or Rust',()=>{
  const gate=job.indexOf('node demo/a0-runtime-gate.mjs --out ci-artifacts/a0-runtime-readiness.json --require-build');
  const nix=job.indexOf('uses: cachix/install-nix-action@');
  assert.ok(gate>0,'required build refusal is missing');
  assert.ok(nix>gate,'tool installation must follow source refusal');
  assert.match(job,/set -euo pipefail/);
  assert.match(job,/if: always\(\)/,'failed preflight artifacts must be retained');
});

test('no unsigned/zome mutation is scheduled by the build workflow',()=>{
  assert.match(job,/--require-write/,'signed-write refusal must be exercised');
  assert.doesNotMatch(job,/\s--\s+deliver(?:\s|$)/);
  assert.match(job,/a0-own-dna-build-\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});

test('real owned-DNA installer is separately gated behind successful locked build',()=>{
  const install=workflow.split('\n  own-dna-install-readonly:\n')[1];
  assert.ok(install);
  assert.match(install,/needs: \[own-dna-build\]/);
  assert.match(install,/source-commit\.sha/);
  assert.match(install,/a0-own-dna-install-readonly\.sh/);
});

test('same-run SOL/Observer source-bound job retains failures instead of skipping them',()=>{
  const ci=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
  const job=ci.split('\n  own-dna-same-run-build-readonly:\n')[1];
  assert.ok(job,'same-run source-bound Holochain job missing');
  assert.match(job,/needs: \[solana-lifecycle, cross-lane-js\]/);
  assert.match(job,/if: always\(\)/);
  assert.match(job,/SOL_JOB_RESULT: \$\{\{ needs\.solana-lifecycle\.result \}\}/);
  assert.match(job,/OBS_JOB_RESULT: \$\{\{ needs\.cross-lane-js\.result \}\}/);
  assert.match(job,/a0-same-run-prerequisites\.json/);
  assert.match(job,/a0-bind-same-run-dna\.mjs/);
  assert.match(job,/a0-report-installed-readonly\.mjs/);
  assert.match(job,/scripts\/ci\/a0-own-dna-install-readonly\.sh/);
  assert.doesNotMatch(job,/\b(record_observation|grant_capability|execute_rave)\b/);
});
