import test from 'node:test';
import assert from 'node:assert/strict';

// OFFLINE ADVERSARIAL MODEL ONLY. These checks do not verify Unyt DNA or RAVE.
function modelRecovery(journal, { originDna, commitment, agreement, epoch }) {
  if (!originDna || !commitment || !agreement || !epoch) return 'REFUSE_INCOMPLETE_DOMAIN';
  const globalKey = `${originDna}:${commitment}`; // intentionally NOT agreement/epoch scoped
  if (journal.has(globalKey)) return 'REFUSE_ALREADY_RECOVERED';
  journal.add(globalKey);
  return 'SIMULATED_RECOVERY';
}
function modelSigner(standing, agreementMatches, independentNodeOnline = true) {
  if (!independentNodeOnline) return 'REFUSE_UNAVAILABLE';
  if (standing !== 'Parked') return 'REFUSE_NOT_PARKED';
  if (!agreementMatches) return 'REFUSE_WRONG_AGREEMENT';
  return 'ELIGIBLE_FOR_FURTHER_CHECKS_ONLY';
}
function modelConservation(input, output) {
  if (!Array.isArray(input) || !Array.isArray(output)) return false;
  if (![...input, ...output].every(x => /^\d+$/.test(x))) return false;
  return input.reduce((a, x) => a + BigInt(x), 0n) ===
    output.reduce((a, x) => a + BigInt(x), 0n);
}

test('recovery once: happy-path model only', () => {
  const seen = new Set();
  assert.equal(modelRecovery(seen, { originDna: 'dna-a', commitment: 'c1', agreement: 'a', epoch: '1' }), 'SIMULATED_RECOVERY');
});
test('repeat recovery in same agreement and replaced agreement refused', () => {
  const seen = new Set();
  const basis = { originDna: 'dna-a', commitment: 'c1', agreement: 'a', epoch: '1' };
  assert.equal(modelRecovery(seen, basis), 'SIMULATED_RECOVERY');
  assert.equal(modelRecovery(seen, basis), 'REFUSE_ALREADY_RECOVERED');
  assert.equal(modelRecovery(seen, { ...basis, agreement: 'b' }), 'REFUSE_ALREADY_RECOVERED');
  assert.equal(modelRecovery(seen, { ...basis, epoch: '2' }), 'REFUSE_ALREADY_RECOVERED');
});
test('missing replay ledger across partition or migration exposes attack (documented gap)', () => {
  const candidate = { originDna: 'dna-a', commitment: 'c1', agreement: 'a', epoch: '1' };
  assert.equal(modelRecovery(new Set(), candidate), 'SIMULATED_RECOVERY');
  assert.equal(modelRecovery(new Set(), { ...candidate, agreement: 'b', epoch: '2' }), 'SIMULATED_RECOVERY');
  // Two isolated sets each permit it; this is an ATTACK demonstration, not safety proof.
});
test('parked standing is not eternal; partitions and mismatched agreements fail closed', () => {
  assert.equal(modelSigner('Parked', true), 'ELIGIBLE_FOR_FURTHER_CHECKS_ONLY');
  for (const standing of ['Unparked', 'NotHeld', 'NotAParkedLink', null]) {
    assert.equal(modelSigner(standing, true), 'REFUSE_NOT_PARKED');
  }
  assert.equal(modelSigner('Parked', false), 'REFUSE_WRONG_AGREEMENT');
  assert.equal(modelSigner('Parked', true, false), 'REFUSE_UNAVAILABLE');
});
test('invalid transaction amounts and nonconserving ledger reject (offline invariant)', () => {
  assert.equal(modelConservation(['5', '7'], ['12']), true);
  assert.equal(modelConservation(['5'], ['6']), false);
  assert.equal(modelConservation(['1.2'], ['1.2']), false);
  assert.equal(modelConservation(['-1'], ['1']), false);
});
