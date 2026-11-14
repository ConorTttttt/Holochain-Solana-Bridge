/** Replay actual local-validator account-byte captures through the real OBS PDA and
 * RAVE shadow reviewers. Never treat RPC 'finalized' as transaction inclusion proof.
 * This CI-only test deliberately fails on a missing compiler/validator artifact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeReceipt } from '../../observer/src/decode.mjs';
import { verifySnapshot, reconcileObservations } from '../../observer/src/verify.mjs';
import { reviewShadow } from '../../holochain/shadow-review.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const idl = JSON.parse(readFileSync('target/idl/deposit_prototype.json', 'utf8'));
const journal = new Map();
function sourceFixture(label) {
  // Source is the real SOL-owned validator test, never an in-test synthetic record.
  const record = JSON.parse(readFileSync(`target/localnet-evidence/${label}.json`, 'utf8'));
  assert.equal(record.kind, 'localnet-finalized-rpc-account-snapshot-not-consensus-proof');
  assert.equal(record.programId, idl.address);
  assert.ok(Number.isSafeInteger(record.slot) && record.slot > 0);
  assert.equal(record.accounts.length, 4, 'single-receipt OBS contract requires four accounts');
  assert.ok(record.accounts.every(x => x.executable === false && x.lamports > 0));
  const [receipt, config, vault, mint] = record.accounts;
  const decoded = decodeReceipt(Buffer.from(receipt.dataBase64, 'base64'));
  const expected = {
    program: record.programId, receipt: receipt.address, config: config.address,
    vault: vault.address, mint: mint.address, scope: decoded.scope,
  };
  const snapshot = {
    slot: record.slot,
    accounts: record.accounts.map(x => ({owner: x.owner, raw: Buffer.from(x.dataBase64, 'base64')})),
  };
  return {record, expected, snapshot};
}
async function observe(label) {
  const {record, expected, snapshot} = sourceFixture(label);
  const observed = await verifySnapshot({
    snapshot, expected, genesisHash: record.genesisHash, source: `localnet-${label}`,
  });
  const binding = Object.freeze({
    genesisHash: record.genesisHash, program: record.programId, mint: expected.mint,
    holochainScope: observed.holochainScope, dnaHash: 'NOT_DEPLOYED_S0',
    agreementHash: 'SHADOW_ONLY_NO_ECONOMICS', deploymentEpoch: 'localnet-s0',
  });
  const shadow = reviewShadow(observed, binding, journal);
  assert.equal(shadow.verdict, 'quarantined', JSON.stringify(shadow.findings));
  assert.equal(shadow.creditEligible, false);
  assert.equal(shadow.spendableBaseUnits, '0');
  assert.equal(shadow.withdrawalAuthorized, false);
  assert.equal(observed.transactionVerified, false);
  assert.equal(observed.evidenceTrust, 'untrusted_rpc_snapshot');
  assert.throws(() => issueHolochainCredit(observed), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal(observed), /WITHDRAWALS_DISABLED/);
  return {record, observed, shadow};
}

test('actual finalized localnet deposit -> canonical OBS snapshot -> quarantined shadow record', async () => {
  const active = await observe('active-receipt');
  assert.equal(active.observed.state, 'active_refundable');
  assert.equal(active.observed.refunded, false);
  assert.ok(active.record.signatures.deposit, 'missing real deposit transaction signature');
  assert.equal(journal.size, 1);
});

test('actual finalized refund invalidates prior receipt state and remains non-economic', async () => {
  // Each test is independently executable and cannot assume previous ordering.
  const first = await observe('active-receipt');
  const second = await observe('refunded-receipt');
  assert.equal(first.observed.id, second.observed.id, 'refund must bind to same receipt identity');
  assert.equal(second.observed.state, 'refunded');
  assert.equal(second.observed.refunded, true);
  assert.equal(second.observed.activeLiabilitiesBaseUnits, '0');
  assert.equal(second.observed.activeVaultBaseUnits, '0');
  assert.ok(second.record.signatures.refund, 'missing refund transaction signature');
  assert.ok(second.observed.finalizedSlot >= first.observed.finalizedSlot);
  assert.ok(second.shadow.findings.includes('REFUND_TRANSITION'));
  assert.throws(() => reconcileObservations(first.observed, second.observed), /disagree/);
  assert.equal(journal.size, 1, 'same receipt identity must never create new liability');
});
