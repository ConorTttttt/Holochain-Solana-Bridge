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
  configDigest: 'b'.repeat(64), vaultDigest: 'c'.repeat(64), mintDigest: 'd'.repeat(64),
  mintSupplyBaseUnits: '1000', activeVaultBaseUnits: '500', activeLiabilitiesBaseUnits: '300',
  configBump: 254, receiptBump: 249, commitmentRequested: 'finalized',
  transactionVerified: false, evidenceTrust: 'untrusted_rpc_snapshot',
  refunded: false, state: 'active_refundable', creditEligible: false,
  independentConsensusVerified: false, spendableBaseUnits: '0', withdrawalAuthorized: false });
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
    assert.ok(audit({ amountBaseUnits: value }).findings.includes('INVALID_amountBaseUnits'));
  }
  assert.ok(audit({ creditEligible: true }).findings.includes('CREDIT_ELIGIBILITY_ESCALATION'));
});
test('fail closed with a missing journal or target binding', () => {
  assert.ok(reviewShadow(receipt, binding, null).findings.includes('NO_LOCAL_AUDIT_JOURNAL'));
  assert.ok(reviewShadow(receipt, null, new Map()).findings.includes('MISSING_EXPLICIT_BINDING'));
});
test('live economic and withdrawal boundaries remain disabled', () => {
  assert.throws(() => issueHolochainCredit(receipt), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal({}), /WITHDRAWALS_DISABLED/);
});

test('revised OBS schema: reject claimed transaction verification, evidence escalation and missing digests', () => {
  assert.ok(audit({ transactionVerified: true }).findings.includes('TRANSACTION_TRUST_ESCALATION'));
  assert.ok(audit({ evidenceTrust: 'trusted' }).findings.includes('EVIDENCE_TRUST_ESCALATION'));
  assert.ok(audit({ commitmentRequested: 'confirmed' }).findings.includes('UNEXPECTED_RPC_COMMITMENT'));
  assert.ok(audit({ configDigest: undefined }).findings.includes('INVALID_configDigest'));
  assert.ok(audit({ receiptBump: -1 }).findings.includes('INVALID_receiptBump'));
});

test('revised OBS accounting assertions are untrusted but internally inconsistent amounts reject', () => {
  assert.ok(audit({ activeLiabilitiesBaseUnits: '501' }).findings.includes('OBSERVED_LIABILITY_INCONSISTENCY'));
  assert.ok(audit({ mintSupplyBaseUnits: '499' }).findings.includes('OBSERVED_LIABILITY_INCONSISTENCY'));
  assert.ok(audit({ depositNonce: '1.5' }).findings.includes('INVALID_depositNonce'));
  assert.ok(audit({ activeVaultBaseUnits: '-20' }).findings.includes('INVALID_activeVaultBaseUnits'));
});

test('same-slot OBS config/vault/mint conflicts reject; new-slot balance drift remains quarantine', () => {
  const journal = new Map();
  audit({}, binding, journal);
  const conflict = audit({ configDigest: 'e'.repeat(64) }, binding, journal);
  assert.equal(conflict.verdict, 'rejected');
  assert.ok(conflict.findings.includes('SAME_SLOT_ACCOUNT_CONFLICT'));
  const drift = audit({ finalizedSlot: 101, activeVaultBaseUnits: '600', vaultDigest: 'e'.repeat(64) }, binding, journal);
  assert.equal(drift.verdict, 'quarantined');
  assert.equal(drift.spendableBaseUnits, '0');
});

test('raw OBS observation denial flags are mandatory literal values', () => {
  for (const [field, wrong, code] of [
    ['independentConsensusVerified', true, 'INDEPENDENT_CONSENSUS_ESCALATION'],
    ['spendableBaseUnits', '1', 'SPENDABLE_BALANCE_ESCALATION'],
    ['withdrawalAuthorized', true, 'WITHDRAWAL_AUTHORIZATION_ESCALATION'],
  ]) {
    for (const value of [wrong, undefined]) {
      const journal = new Map();
      const result = audit({ [field]: value }, binding, journal);
      assert.equal(result.verdict, 'rejected');
      assert.ok(result.findings.includes(code), field);
      assert.equal(journal.size, 0);
      assert.equal(result.creditEligible, false);
      assert.equal(result.spendableBaseUnits, '0');
      assert.equal(result.withdrawalAuthorized, false);
    }
  }
});
