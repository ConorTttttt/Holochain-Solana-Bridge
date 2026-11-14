import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestOnlyAdapter } from '../../holochain/test-only-adapter.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const binding = Object.freeze({ genesisHash: 'genesis', program: 'program', mint: 'mint',
  holochainScope: 'scope', dnaHash: 'dna-a', agreementHash: 'agreement-a', deploymentEpoch: '1' });
const observation = Object.freeze({ kind: 'solana-receipt-observation-v1',
  id: 'genesis:program:receipt', genesisHash: 'genesis', program: 'program',
  receiptAddress: 'receipt', configAddress: 'config', vaultAddress: 'vault', mint: 'mint',
  depositor: 'depositor', recipientCore: 'recipient', holochainScope: 'scope',
  depositNonce: '10', amountBaseUnits: '100', finalizedSlot: 100,
  receiptDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64),
  vaultDigest: 'c'.repeat(64), mintDigest: 'd'.repeat(64),
  mintSupplyBaseUnits: '1000', activeVaultBaseUnits: '500',
  activeLiabilitiesBaseUnits: '300', configBump: 254, receiptBump: 253,
  commitmentRequested: 'finalized', transactionVerified: false,
  evidenceTrust: 'untrusted_rpc_snapshot', refunded: false,
  state: 'active_refundable', creditEligible: false });

const ingest = (changes = {}, target = binding) => createTestOnlyAdapter(target).ingest({ ...observation, ...changes });
const inert = record => {
  assert.equal(record.creditEligible, false);
  assert.equal(record.spendableBaseUnits, '0');
  assert.equal(record.withdrawalAuthorized, false);
  assert.equal(record.conductorExecuted, false);
  assert.equal(record.deployedDnaVerified, false);
};

test('test-only OBS -> classification -> inert Holochain-shaped record', () => {
  const adapter = createTestOnlyAdapter(binding);
  const record = adapter.ingest(observation);
  assert.equal(record.verdict, 'quarantined');
  assert.ok(record.findings.includes('REFUNDABLE_COLLATERAL'));
  assert.equal(adapter.records().length, 1);
  assert.equal(record.kind, 'test-only-holochain-shadow-record-v1');
  inert(record);
  assert.throws(() => issueHolochainCredit(record), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal(record), /WITHDRAWALS_DISABLED/);
});

test('duplicate identical evidence in one adapter is rejected, not economic', () => {
  const adapter = createTestOnlyAdapter(binding);
  assert.equal(adapter.ingest(observation).verdict, 'quarantined');
  const again = adapter.ingest(observation);
  assert.equal(again.verdict, 'rejected');
  assert.ok(again.findings.includes('DUPLICATE_EVIDENCE'));
  inert(again);
});

test('wrong scope, program, mint and agreement identity fail closed', () => {
  for (const changes of [{ holochainScope: 'other' }, { program: 'other' }, { mint: 'other' }]) {
    const record = ingest(changes);
    assert.equal(record.verdict, 'rejected');
    inert(record);
  }
  const wrongAgreement = ingest({}, { ...binding, agreementHash: '' });
  assert.equal(wrongAgreement.verdict, 'rejected');
  assert.ok(wrongAgreement.findings.includes('MISSING_EXPLICIT_BINDING'));
});

test('refund, incorrect amount, claimed verified transaction fail closed economically', () => {
  const refunded = ingest({ refunded: true, state: 'refunded', receiptDigest: 'f'.repeat(64) });
  assert.equal(refunded.verdict, 'quarantined');
  assert.ok(refunded.findings.includes('REFUNDED_COLLATERAL'));
  inert(refunded);
  for (const changes of [{ amountBaseUnits: '101.0' }, { amountBaseUnits: '0' },
    { transactionVerified: true }, { creditEligible: true }, { state: 'refunded' }]) {
    const record = ingest(changes);
    assert.equal(record.verdict, 'rejected');
    inert(record);
  }
});

test('migration/partition creates independent journals: replay vulnerability remains unproven', () => {
  const left = createTestOnlyAdapter(binding);
  const right = createTestOnlyAdapter({ ...binding, dnaHash: 'dna-b', agreementHash: 'agreement-b' });
  assert.equal(left.ingest(observation).verdict, 'quarantined');
  assert.equal(right.ingest(observation).verdict, 'quarantined');
  // This intentionally demonstrates lack of global uniqueness across environments.
  assert.equal(left.records().length + right.records().length, 2);
  inert(left.records()[0]);
  inert(right.records()[0]);
});

test('stale slot and contradictory receipt bytes are refused within one process only', () => {
  const adapter = createTestOnlyAdapter(binding);
  adapter.ingest(observation);
  for (const changes of [{ finalizedSlot: 99 }, { receiptDigest: 'f'.repeat(64), finalizedSlot: 101 }]) {
    const record = adapter.ingest({ ...observation, ...changes });
    assert.equal(record.verdict, 'rejected');
    inert(record);
  }
});


test('exact u64 decimal strings above JS safe integer remain non-economic, never coerced', () => {
  for (const exact of ['9007199254740993', '18446744073709551615']) {
    const record = ingest({
      amountBaseUnits: exact, mintSupplyBaseUnits: exact,
      activeVaultBaseUnits: exact, activeLiabilitiesBaseUnits: exact,
    });
    assert.equal(record.verdict, 'quarantined', 'valid u64 must remain decimal text');
    inert(record);
  }
  // JS Number would round 2^53+1. The boundary must refuse it, not
  // coerce or silently change the deposited economic identity.
  const numeric = ingest({ amountBaseUnits: Number('9007199254740993') });
  assert.equal(numeric.verdict, 'rejected');
  assert.ok(numeric.findings.includes('INVALID_amountBaseUnits'));
  inert(numeric);
  const outOfRange = ingest({ amountBaseUnits: '18446744073709551616' });
  assert.equal(outOfRange.verdict, 'rejected');
  assert.ok(outOfRange.findings.includes('INVALID_amountBaseUnits'));
  inert(outOfRange);
});
