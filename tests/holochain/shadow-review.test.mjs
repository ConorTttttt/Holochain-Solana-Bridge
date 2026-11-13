import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewShadow } from '../../holochain/shadow-review.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const binding = Object.freeze({ genesisHash: 'genesis', program: 'program', mint: 'mint',
  holochainScope: 'scope', dnaHash: 'dna-1', agreementHash: 'agreement-1', deploymentEpoch: '1' });
const receipt = Object.freeze({ kind: 'solana-receipt-observation-v1',
  id: 'genesis:program:receipt-1', genesisHash: 'genesis', program: 'program',
  receiptAddress: 'receipt-1', configAddress: 'config', vaultAddress: 'vault',
  mint: 'mint', depositor: 'depositor', recipientCore: 'recipient',
  holochainScope: 'scope', depositNonce: '1', amountBaseUnits: '123',
  finalizedSlot: 100, receiptDigest: 'a'.repeat(64),
  refunded: false, state: 'active_refundable', creditEligible: false });
const audit = (changes = {}, context = binding, journal = new Map()) =>
  reviewShadow({ ...receipt, ...changes }, context, journal);

test('consistent observation stays quarantined; there is no spendable balance', () => {
  const output = audit();
  assert.equal(output.verdict, 'quarantined');
  assert.equal(output.spendableBaseUnits, '0');
  assert.equal(output.creditEligible, false);
  assert.equal(output.withdrawalAuthorized, false);
  assert.ok(output.findings.includes('REFUNDABLE_COLLATERAL'));
});
test('repeated identical observation remains non-economic and idempotent in one journal', () => {
  const journal = new Map();
  assert.equal(audit({}, binding, journal).verdict, 'quarantined');
  assert.equal(audit({}, binding, journal).verdict, 'quarantined');
  assert.equal(journal.size, 1);
});
test('receipt bytes conflict across RPC snapshots: reject', () => {
  const journal = new Map();
  audit({}, binding, journal);
  const output = audit({ receiptDigest: 'b'.repeat(64), finalizedSlot: 101 }, binding, journal);
  assert.equal(output.verdict, 'rejected');
  assert.ok(output.findings.includes('CONFLICTING_RECEIPT_HISTORY'));
});
test('late refund is observed, and rollback to pre-refund state is rejected', () => {
  const journal = new Map();
  audit({}, binding, journal);
  const refund = audit({ receiptDigest: 'b'.repeat(64), refunded: true,
    state: 'refunded', finalizedSlot: 110 }, binding, journal);
  assert.equal(refund.verdict, 'quarantined');
  assert.ok(refund.findings.includes('REFUNDED_COLLATERAL'));
  const rollback = audit({ finalizedSlot: 120 }, binding, journal);
  assert.equal(rollback.verdict, 'rejected');
  assert.ok(rollback.findings.includes('REFUND_STATE_ROLLBACK'));
});
test('agreement replacement and DNA migration reuse same receipt: reject', () => {
  const journal = new Map();
  audit({}, binding, journal);
  for (const changed of [{ agreementHash: 'agreement-2' }, { dnaHash: 'dna-2' }, { deploymentEpoch: '2' }]) {
    const output = audit({}, { ...binding, ...changed }, journal);
    assert.equal(output.verdict, 'rejected');
    assert.ok(output.findings.includes('CROSS_AGREEMENT_OR_EPOCH_REPLAY'));
  }
});
test('mismatched scope, program or mint: reject', () => {
  for (const changed of [{ holochainScope: 'other-scope' }, { program: 'other-program' }, { mint: 'other-mint' }]) {
    assert.equal(audit(changed).verdict, 'rejected');
  }
});
test('invalid amount and forged eligibility: reject', () => {
  for (const value of ['0', '-1', '1.5', (1n << 64n).toString()]) {
    assert.ok(audit({ amountBaseUnits: value }).findings.includes('INVALID_AMOUNT'));
  }
  assert.ok(audit({ creditEligible: true }).findings.includes('CREDIT_ELIGIBILITY_ESCALATION'));
});
test('fail closed with a missing journal or target binding', () => {
  assert.ok(reviewShadow(receipt, binding, null).findings.includes('NO_SHARED_AUDIT_JOURNAL'));
  assert.ok(reviewShadow(receipt, null, new Map()).findings.includes('MISSING_EXPLICIT_BINDING'));
});
test('live economic and withdrawal boundaries remain disabled', () => {
  assert.throws(() => issueHolochainCredit(receipt), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal({}), /WITHDRAWALS_DISABLED/);
});
