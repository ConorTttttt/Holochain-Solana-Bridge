import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRawExecutionInstructionError, recoverIncludedRejection, assertRecoveredIncludedRejection,
} from './confirmation-recovery.mjs';

const signature = 'original-submitted-transaction-signature';
const rejection = () => ({ InstructionError: [0, { Custom: 2001 }] });
const status = (err = rejection(), slot = 19) => ({
  confirmationStatus: 'confirmed', slot, err,
});
const rpc = value => ({ getSignatureStatuses: async signatures => {
  assert.deepEqual(signatures, [signature]);
  return { value: [value] };
} });
const recover = (error, connection, options = {}) =>
  recoverIncludedRejection({ error, signature, connection, attempts: 1, ...options });

test('only SDK raw on-chain execution InstructionError is recoverable', () => {
  assert.equal(isRawExecutionInstructionError(rejection()), true);
  for (const error of [
    new Error('ECONNRESET'), new Error('block height exceeded'),
    { code: 'ETIMEDOUT' }, { InstructionError: [] },
    { InstructionError: [0, { Custom: 7 }], transportError: true },
    { InstructionError: ['0', { Custom: 7 }] }, null,
  ]) assert.equal(isRawExecutionInstructionError(error), false);
});

test('transport errors never poll status or become successful negatives', async () => {
  let polls = 0;
  const error = new Error('fetch failed: ECONNRESET');
  await assert.rejects(() => recover(error, {
    getSignatureStatuses: async () => { polls++; return { value: [status()] }; },
  }), thrown => thrown === error);
  assert.equal(polls, 0);
});

test('original submitted signature mandatory', async () => {
  const error = rejection();
  await assert.rejects(() => recoverIncludedRejection({
    error, signature: null, connection: rpc(status()), attempts: 1,
  }), thrown => thrown === error);
});

test('missing, unconfirmed or successful signature never counts as rejection', async () => {
  for (const observation of [
    null, { confirmationStatus: 'processed', slot: 19, err: rejection() },
    status(null),
  ]) {
    const error = rejection();
    await assert.rejects(() => recover(error, rpc(observation)),
      thrown => thrown === error);
  }
});

test('invalid status slot and contradictory SDK/status error fail closed', async () => {
  await assert.rejects(() => recover(rejection(), rpc(status(rejection(), -1))),
    /invalid slot/);
  await assert.rejects(() => recover(rejection(), rpc(status({
    InstructionError: [0, { Custom: 6000 }],
  }))), /disagrees with confirmed signature-status/);
});

test('transport or malformed status RPC cannot become an expected rejection', async () => {
  await assert.rejects(() => recover(rejection(), {
    getSignatureStatuses: async () => { throw new Error('RPC unavailable'); },
  }), /RPC unavailable/);
  await assert.rejects(() => recover(rejection(), {
    getSignatureStatuses: async () => ({ value: [] }),
  }), /response malformed/);
});

test('included execution must match observed original signature status and slot', async () => {
  const error = rejection();
  const recovered = await recover(error, rpc(status()));
  const included = { slot: 19, meta: { err: rejection() } };
  assertRecoveredIncludedRejection({ signature, included, recovered });
  for (const altered of [
    null, { slot: 19, meta: null }, { slot: 20, meta: { err: rejection() } },
    { slot: 19, meta: { err: null } },
    { slot: 19, meta: { err: { InstructionError: [0, { Custom: 6000 }] } } },
  ]) assert.throws(() => assertRecoveredIncludedRejection({
    signature, included: altered, recovered,
  }));
});
