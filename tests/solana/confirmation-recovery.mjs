// Fail-closed recovery only for the raw Solana execution InstructionError
// that web3.js occasionally rejects from confirmTransaction(). Transport,
// expiration, absent history, success, and contradictory metadata are errors.
import assert from 'node:assert/strict';

export function isRawExecutionInstructionError(error) {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return false;
  if (Object.keys(error).length !== 1 || !Object.hasOwn(error, 'InstructionError')) return false;
  const pair = error.InstructionError;
  return Array.isArray(pair) && pair.length === 2 &&
    Number.isSafeInteger(pair[0]) && pair[0] >= 0 &&
    (typeof pair[1] === 'string' ||
      (pair[1] !== null && typeof pair[1] === 'object' && !Array.isArray(pair[1])));
}

export async function recoverIncludedRejection({
  error, signature, connection, attempts = 60, delayMs = 250,
}) {
  // Must reject ALL SDK transport/expiration exceptions without even polling.
  if (!isRawExecutionInstructionError(error) ||
      typeof signature !== 'string' || signature.length === 0) throw error;
  assert.ok(Number.isSafeInteger(attempts) && attempts > 0);
  for (let i = 0; i < attempts; i++) {
    // A status-RPC transport error is not an on-chain rejection witness.
    const result = await connection.getSignatureStatuses([signature],
      { searchTransactionHistory: true });
    assert.ok(Array.isArray(result?.value) && result.value.length === 1,
      'signature-status RPC response malformed: ' + signature);
    const status = result.value[0];
    if (status && ['confirmed', 'finalized'].includes(status.confirmationStatus)) {
      if (status.err === null || status.err === undefined) throw error;
      assert.ok(Number.isSafeInteger(status.slot) && status.slot >= 0,
        'included rejection status has invalid slot: ' + signature);
      assert.deepEqual(status.err, error,
        'SDK InstructionError disagrees with confirmed signature-status error: ' + signature);
      return { err: status.err, slot: status.slot, status };
    }
    if (i + 1 < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw error;
}

export function assertRecoveredIncludedRejection({ signature, included, recovered }) {
  assert.ok(included?.meta, 'recovered signature absent from included getTransaction: ' + signature);
  assert.ok(Number.isSafeInteger(included.slot) && included.slot >= 0,
    'included getTransaction slot malformed: ' + signature);
  assert.equal(included.slot, recovered.slot,
    'recovered signature status slot contradicts included transaction: ' + signature);
  assert.notEqual(included.meta.err, null,
    'SDK rejection cannot turn included success into expected failure: ' + signature);
  assert.notEqual(included.meta.err, undefined,
    'included transaction is missing execution error: ' + signature);
  assert.deepEqual(included.meta.err, recovered.err,
    'recovered signature status execution disagrees with getTransaction: ' + signature);
}
