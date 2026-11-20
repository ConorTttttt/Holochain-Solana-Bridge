import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJobs, scanWorkflows, triggers, violations } from './workflow-install-gates.mjs';

const wf = (on, jobs) => `name: t\non:\n${on}\npermissions:\n  contents: read\njobs:\n${jobs}`;
const probeStep = `      - name: probe\n        run: |\n          bash tests/holochain/sandbox/probe-verified-unyt-conductor.sh a b\n`;
const job = (id, extra = '', steps = probeStep) =>
  `  ${id}:\n    runs-on: ubuntu-24.04\n${extra}    steps:\n      - uses: actions/checkout@x\n${steps}`;

test('repository workflows: every install/genesis/mutating-zome step is hard-disabled', () => {
  assert.deepEqual(scanWorkflows(), []);
});

test('rave-unyt-release.yml: no dispatch, push-only historical triggers, probe job disabled', () => {
  const text = readFileSync('.github/workflows/rave-unyt-release.yml', 'utf8');
  assert.deepEqual(triggers(text), ['push']);
  assert.doesNotMatch(text, /^\s*workflow_dispatch:/m);
  const probe = parseJobs(text).find(j => j.id === 'actual-non-economic-conductor-probe');
  assert.ok(probe, 'probe job must stay visible (disabled), not silently deleted');
  assert.equal(probe.if, '${{ false }}');
  // Release-byte verification and non-economic tests still run when triggered.
  for (const id of ['release-integrity', 'compatible-cli-bundle-inspection', 'non-economic-shadow-contract-tests'])
    assert.equal(parseJobs(text).find(j => j.id === id)?.if, null, id);
});

test('existing A0 installation refusals stay in force', () => {
  const a0 = parseJobs(readFileSync('.github/workflows/a0-own-dna-runtime.yml', 'utf8'));
  assert.equal(a0.find(j => j.id === 'own-dna-install-readonly')?.if, '${{ false }}');
  const snap = parseJobs(readFileSync('.github/workflows/integration-snapshot.yml', 'utf8'));
  const install = snap.flatMap(j => j.steps).filter(s => /a0-own-dna-install-readonly\.sh/.test(s.lines.join('\n')));
  assert.equal(install.length, 1);
  assert.match(install[0].if, /^\$\{\{ false \}\}/);
});

test('adversarial: ungated probe step, re-added dispatch and trigger widening are refused', () => {
  const f = '.github/workflows/rave-unyt-release.yml';
  const ungated = wf('  push:\n    branches: [agent/rave/9-rave-validation]', job('actual-non-economic-conductor-probe'));
  const v = violations(f, ungated);
  assert.ok(v.some(x => /step "probe"/.test(x)), v.join('\n'));
  assert.ok(v.some(x => /must be job-disabled/.test(x)), v.join('\n'));

  const gated = wf('  push:\n    branches: [agent/rave/9-rave-validation]', job('actual-non-economic-conductor-probe', '    if: ${{ false }}\n'));
  assert.deepEqual(violations(f, gated), []);

  for (const t of ['workflow_dispatch:', 'pull_request:', 'schedule:\n    - cron: "0 0 * * *"', 'workflow_call:', 'repository_dispatch:'])
    assert.ok(violations(f, wf(`  push:\n    branches: [agent/rave/9-rave-validation]\n  ${t}`,
      job('actual-non-economic-conductor-probe', '    if: ${{ false }}\n'))).some(x => /forbidden trigger/.test(x)), t);
  for (const b of ['main', 'claude/holochain-solana-consolidation-3l2lqm'])
    assert.ok(violations(f, wf(`  push:\n    branches: [agent/rave/9-rave-validation, ${b}]`,
      job('actual-non-economic-conductor-probe', '    if: ${{ false }}\n'))).some(x => /main or the consolidation/.test(x)), b);
});

test('adversarial: look-alike or conditional gates do not count as disabled', () => {
  const f = '.github/workflows/x.yml';
  for (const cond of [
    "github.event_name == 'workflow_dispatch'",
    '${{ false || inputs.force }}',
    '${{ !false }}',
    "${{ 'false' }}",
    'always()',
  ]) assert.equal(violations(f, wf('  push:', job('a', `    if: ${cond}\n`))).length, 1, cond);
  // A commented-out gate is not a gate.
  assert.equal(violations(f, wf('  push:', job('a', '    # if: ${{ false }}\n'))).length, 1);
  // A step-level gate works only on the step that mutates.
  const twoSteps = `      - name: gated\n        if: \${{ false }}\n        run: bash scripts/ci/a0-own-dna-install-readonly.sh x\n` +
    `      - name: ungated\n        run: hc sandbox generate --app x.happ\n`;
  const v = violations(f, wf('  push:', job('a', '', twoSteps)));
  assert.equal(v.length, 1);
  assert.match(v[0], /step "ungated"/);
  // Mutating zome calls and app installs are covered, not just conductor scripts.
  for (const run of ['hc s call grant_capability', 'node x.mjs --zome record_observation', 'npx foo install-app --app y'])
    assert.equal(violations(f, wf('  push:', job('a', '', `      - name: z\n        run: ${run}\n`))).length, 1, run);
  // Mentions in comments are not executions.
  assert.deepEqual(violations(f, wf('  push:', job('a', '', `      - name: z\n        # never run probe-verified-unyt-conductor.sh here\n        run: echo ok\n`))), []);
  // Reusable local workflow calls must be job-disabled.
  assert.equal(violations(f, wf('  push:', '  a:\n    uses: ./.github/workflows/rave-unyt-release.yml\n')).length, 1);
});
