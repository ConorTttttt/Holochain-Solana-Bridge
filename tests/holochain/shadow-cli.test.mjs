import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const runner = resolve('holochain/shadow-cli.mjs');
const binding = { genesisHash: 'g', program: 'p', mint: 'm', holochainScope: 's', dnaHash: 'd', agreementHash: 'a', deploymentEpoch: '1' };
const observation = { kind: 'solana-receipt-observation-v1', id: 'g:p:r', genesisHash: 'g', program: 'p', receiptAddress: 'r',
  configAddress: 'c', vaultAddress: 'v', mint: 'm', depositor: 'user', recipientCore: 'recipient', holochainScope: 's',
  depositNonce: '1', amountBaseUnits: '10', finalizedSlot: 100, receiptDigest: 'a'.repeat(64),
  configDigest: 'b'.repeat(64), vaultDigest: 'c'.repeat(64), mintDigest: 'd'.repeat(64),
  configBump: 252, receiptBump: 249, mintSupplyBaseUnits: '1000', activeVaultBaseUnits: '500',
  activeLiabilitiesBaseUnits: '200', commitmentRequested: 'finalized', transactionVerified: false,
  evidenceTrust: 'untrusted_rpc_snapshot', refunded: false, state: 'active_refundable', creditEligible: false };
function run(changes = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rave-s0-cli-'));
  try {
    const path = join(dir, 'target.json');
    writeFileSync(path, JSON.stringify(binding), { mode: 0o600 });
    return spawnSync(process.execPath, [runner, path], { input: JSON.stringify({ ...observation, ...changes }), encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('executable shadow CLI reads current OBS schema and returns quarantined-only JSON', () => {
  const runResult = run();
  assert.equal(runResult.status, 0, runResult.stderr);
  const out = JSON.parse(runResult.stdout);
  assert.equal(out.verdict, 'quarantined');
  assert.equal(out.creditEligible, false);
  assert.equal(out.spendableBaseUnits, '0');
  assert.equal(out.withdrawalAuthorized, false);
});
test('CLI fails closed on invalid contract/trust; no economic output', () => {
  const result = run({ transactionVerified: true });
  assert.equal(result.status, 2);
  const out = JSON.parse(result.stdout);
  assert.equal(out.verdict, 'rejected');
  assert.equal(out.creditEligible, false);
  assert.equal(out.spendableBaseUnits, '0');
});
