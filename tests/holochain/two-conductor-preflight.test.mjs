import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditTwoConductorPreflight, PINNED_SANDBOX_DNA,
} from './sandbox/audit-two-conductor-preflight.mjs';

const agentA = 'uhCAkdisposable-author-A';
const agentB = 'uhCAkdisposable-author-B';
const snapshots = key => ({
  apps: [{
    installed_app_id: 'unyt-v0117-audit', agent_pub_key: key,
    status: { type: 'enabled' },
    cell_info: { alliance: [{
      type: 'provisioned',
      value: { cell_id: { dna_hash: PINNED_SANDBOX_DNA, agent_pub_key: key } },
    }] },
  }],
  cells: [{ dna_hash: PINNED_SANDBOX_DNA, agent_pub_key: key }],
});

function fixture(run) {
  const tmp = mkdtempSync(join(tmpdir(), 'rave-two-authors-'));
  const rootA = join(tmp, 'sandbox-a'), rootB = join(tmp, 'sandbox-b');
  mkdirSync(rootA, { mode: 0o700 });
  mkdirSync(rootB, { mode: 0o700 });
  const a = snapshots(agentA), b = snapshots(agentB);
  try {
    return run({
      appsA: a.apps, cellsA: a.cells, rootA,
      appsB: b.apps, cellsB: b.cells, rootB,
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function inert(result) {
  assert.equal(result.creditEligible, false);
  assert.equal(result.independentConsensusVerified, false);
  assert.equal(result.spendableBaseUnits, '0');
  assert.equal(result.withdrawalAuthorized, false);
  assert.equal(result.networkIsolationVerified, false);
  assert.equal(result.sourceChainsIndependentlyVerified, false);
  assert.equal(result.sourceEquivalent, false);
  assert.equal(result.zomeCallAuthorized, false);
  assert.equal(result.conductorExecutedByThisTool, false);
  assert.match(result.runtimeStatus, /^BLOCKED_/);
}

test('distinct protected roots and different agent identities are only consistent STATIC snapshots', () =>
  fixture(inputs => {
    const result = auditTwoConductorPreflight(inputs);
    assert.equal(result.shapeVerdict, 'consistent-not-proven');
    assert.deepEqual(result.findings, []);
    inert(result);
  }));

test('same author identity, swapped DNA or unexpected second cell fail closed', () =>
  fixture(inputs => {
    const cases = [
      { appsB: snapshots(agentA).apps, cellsB: snapshots(agentA).cells },
      { appsB: [{ ...inputs.appsB[0], cell_info: { alliance: [{
        type: 'provisioned', value: { cell_id: {
          dna_hash: 'wrong-dna', agent_pub_key: agentB,
        } },
      }] } }] },
      { cellsA: [...inputs.cellsA, ...inputs.cellsA] },
    ];
    for (const changes of cases) {
      const result = auditTwoConductorPreflight({ ...inputs, ...changes });
      assert.equal(result.shapeVerdict, 'rejected');
      inert(result);
    }
  }));

test('overlapping, symlinked, missing and insecure roots reject without reading private keys', () =>
  fixture(inputs => {
    for (const changes of [
      { rootB: inputs.rootA }, { rootA: '/definitely/missing-rave-author' },
      { rootB: join(inputs.rootA, '..') },
    ]) {
      const result = auditTwoConductorPreflight({ ...inputs, ...changes });
      assert.equal(result.shapeVerdict, 'rejected');
      inert(result);
    }
    chmodSync(inputs.rootA, 0o755);
    const exposed = auditTwoConductorPreflight(inputs);
    assert.equal(exposed.shapeVerdict, 'rejected');
    assert.ok(exposed.findings.includes('A_SANDBOX_ROOT_NOT_PRIVATE'));
    inert(exposed);
  }));
