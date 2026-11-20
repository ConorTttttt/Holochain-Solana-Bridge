/** Independent SEC reference counterexamples: NOT Unyt/Solana execution. */
import test from 'node:test';
import assert from 'node:assert/strict';

const sum = (...values) => values.reduce((a, b) => a + b, 0n);
function invariant({ collateral, refundable = 0n, live = 0n, pending = 0n, other = 0n }) {
  const values = [collateral, refundable, live, pending, other];
  assert.ok(values.every(v => typeof v === 'bigint' && v >= 0n), 'nonnegative base units');
  assert.ok(sum(refundable, live, pending, other) <= collateral, 'UNBACKED_EXTERNAL_OBLIGATION');
}
const domainId = ({ genesis, program, mint, scope, dna, receipt, withdraw }) =>
  JSON.stringify([genesis, program, mint, scope, dna, receipt, withdraw]);
class IsolatedWithdrawalJournal {
  constructor() { this.paid = new Set(); }
  release(identity) {
    if (this.paid.has(identity)) throw new Error('DUPLICATE_PAYOUT');
    this.paid.add(identity);
  }
}

test('S1-MODEL-01 refund after issued claim double-counts identical collateral', () => {
  invariant({ collateral: 100n, refundable: 100n });
  assert.throws(() => invariant({ collateral: 100n, refundable: 100n, live: 100n }), /UNBACKED/);
  invariant({ collateral: 100n, refundable: 0n, live: 100n });
  assert.throws(() => invariant({ collateral: 0n, live: 100n }), /UNBACKED/);
});

test('S1-MODEL-02 pending payout is a separate outstanding liability until atomic settlement', () => {
  invariant({ collateral: 100n, pending: 100n });
  assert.throws(() => invariant({ collateral: 100n, live: 100n, pending: 100n }), /UNBACKED/);
  assert.throws(() => invariant({ collateral: 0n, pending: 100n }), /UNBACKED/);
});

test('S1-MODEL-03 distinct journals after partition both release the same global identity', () => {
  const claim = domainId({ genesis: 'g', program: 'p', mint: 'm', scope: 's', dna: 'd', receipt: 'r', withdraw: 'w' });
  const left = new IsolatedWithdrawalJournal();
  const right = new IsolatedWithdrawalJournal();
  left.release(claim);
  right.release(claim); // deliberately reproduces model deficiency, not a real payout.
  assert.equal(left.paid.has(claim) && right.paid.has(claim), true);
  assert.throws(() => left.release(claim), /DUPLICATE_PAYOUT/);
});

test('S1-MODEL-04 migration that changes replay key enables duplicate release', () => {
  const base = { genesis: 'g', program: 'p', mint: 'm', scope: 's', dna: 'd', receipt: 'r', withdraw: 'w' };
  const journal = new IsolatedWithdrawalJournal();
  const oldId = domainId(base);
  const migratedId = domainId({ ...base, dna: 'successor-dna' });
  journal.release(oldId);
  journal.release(migratedId); // inappropriate if predecessor/successor claims are the same obligation.
  assert.equal(journal.paid.size, 2);
  assert.notEqual(oldId, migratedId);
});

test('S1-MODEL-05 unverified parked state or wrong signer cannot establish authorization', () => {
  function authorize({ signer, expectedSigner, standing, noForkDispute, matchingAgreement }) {
    if (signer !== expectedSigner) return false;
    return standing === 'Parked' && noForkDispute === true && matchingAgreement === true;
  }
  const valid = { signer: 'trusted', expectedSigner: 'trusted', standing: 'Parked', noForkDispute: true, matchingAgreement: true };
  assert.equal(authorize(valid), true); // specification only, NOT evidence of finality.
  for (const patch of [{ signer: 'attacker' }, { standing: 'Unparked' },
    { noForkDispute: false }, { matchingAgreement: false }, { noForkDispute: undefined }]) {
    assert.equal(authorize({ ...valid, ...patch }), false);
  }
});

test('S1-MODEL-06 a trusted binding must cover every economic replay dimension', () => {
  const trusted = { genesis: 'g', program: 'p', mint: 'm', scope: 's', dna: 'd', receipt: 'r', withdraw: 'w' };
  function bound(candidate) {
    return Object.keys(trusted).every(key => typeof candidate[key] === 'string' && candidate[key] === trusted[key]);
  }
  assert.equal(bound(trusted), true);
  for (const key of Object.keys(trusted)) {
    assert.equal(bound({ ...trusted, [key]: key + '-wrong' }), false, `must bind ${key}`);
  }
});
