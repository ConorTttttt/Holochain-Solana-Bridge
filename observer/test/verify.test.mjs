import test from 'node:test';
import assert from 'node:assert/strict';
import { addressBytes, decode58, discriminator, encode58 } from '../src/decode.mjs';
import { CLASSIC_TOKEN_PROGRAM, observeRpc, reconcileObservations, verifySnapshot } from '../src/verify.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const pub = x => encode58(Buffer.alloc(32, x));
const a = {
  program: pub(1), receipt: pub(2), config: pub(3), vault: pub(4),
  mint: pub(5), depositor: pub(6), admin: pub(7), recipient: Buffer.alloc(32, 8),
  scope: Buffer.alloc(32, 9), genesis: pub(10),
};
const expected = { program: a.program, receipt: a.receipt, config: a.config, vault: a.vault, mint: a.mint, scope: a.scope.toString('hex') };

function putKey(bytes, pos, key) { addressBytes(key).copy(bytes, pos); }
function config({ paused = false, active = 100n, scope = a.scope } = {}) {
  const b = Buffer.alloc(114);
  discriminator('BridgeConfig').copy(b);
  putKey(b, 8, a.admin); putKey(b, 40, a.mint); scope.copy(b, 72);
  b[104] = paused ? 1 : 0;
  b.writeBigUInt64LE(active, 105); b[113] = 255;
  return b;
}
function receipt({ refunded = false, amount = 100n, mint = a.mint, scope = a.scope } = {}) {
  const b = Buffer.alloc(218);
  discriminator('DepositReceipt').copy(b);
  putKey(b, 8, a.depositor); putKey(b, 40, mint);
  putKey(b, 72, a.vault); putKey(b, 104, a.config);
  a.recipient.copy(b, 136); scope.copy(b, 168);
  b.writeBigUInt64LE(42n, 200); b.writeBigUInt64LE(amount, 208);
  b[216] = refunded ? 1 : 0; b[217] = 255;
  return b;
}
function vault({ amount = 100n, mint = a.mint, authority = a.config, delegate = false, frozen = false, close = false } = {}) {
  const b = Buffer.alloc(165);
  putKey(b, 0, mint); putKey(b, 32, authority);
  b.writeBigUInt64LE(amount, 64);
  b.writeUInt32LE(delegate ? 1 : 0, 72); b[108] = frozen ? 2 : 1;
  b.writeUInt32LE(close ? 1 : 0, 129);
  return b;
}
function snapshot({ r = receipt(), c = config(), v = vault(), receiptOwner = a.program, vaultOwner = CLASSIC_TOKEN_PROGRAM, slot = 5000 } = {}) {
  return { slot, accounts: [
    { owner: receiptOwner, raw: r },
    { owner: a.program, raw: c },
    { owner: vaultOwner, raw: v },
  ] };
}
function verified(s = snapshot(), e = expected) {
  return verifySnapshot({ snapshot: s, expected: e, genesisHash: a.genesis });
}

test('base58 32-byte keys round trip, including leading zeroes', () => {
  for (const x of [Buffer.alloc(32), Buffer.alloc(32, 1), Buffer.from([0, 0, ...new Array(30).fill(2)])]) {
    assert.deepEqual(decode58(encode58(x)), x);
  }
  assert.throws(() => addressBytes('BAD@ADDRESS'));
});

test('reads valid finalized receipt as observation, NEVER a credit authorization', () => {
  const got = verified();
  assert.equal(got.amountBaseUnits, '100');
  assert.equal(got.depositNonce, '42');
  assert.equal(got.state, 'active_refundable');
  assert.equal(got.creditEligible, false);
  assert.equal(got.finalizedSlot, 5000);
  assert.throws(() => issueHolochainCredit(got), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal({}), /WITHDRAWALS_DISABLED/);
});

test('reports refunded receipt and still refuses issuance', () => {
  const got = verified(snapshot({ r: receipt({refunded: true}), c: config({active: 0n}), v: vault({amount: 0n}) }));
  assert.equal(got.state, 'refunded');
  assert.equal(got.creditEligible, false);
});

test('rejects receipt forged by another owner', () => {
  assert.throws(() => verified(snapshot({receiptOwner: pub(24)})), /wrong program owner/);
});

test('rejects swapped mint and Holochain scope', () => {
  assert.throws(() => verified(snapshot({r: receipt({mint: pub(22)})})), /Mint mismatch/);
  assert.throws(() => verified(snapshot({r: receipt({scope: Buffer.alloc(32, 3)})})), /scope mismatch/);
});

test('rejects wrong vault authority and token program', () => {
  assert.throws(() => verified(snapshot({v: vault({authority: pub(29)})})), /Vault authority/);
  assert.throws(() => verified(snapshot({vaultOwner: pub(30)})), /not a classic SPL Token/);
});

test('rejects insolvency evidence, delegate, close authority, or frozen vault', () => {
  assert.throws(() => verified(snapshot({v: vault({amount: 99n})})), /liabilities exceed/);
  assert.throws(() => verified(snapshot({v: vault({delegate: true})})), /unapproved SPL/);
  assert.throws(() => verified(snapshot({v: vault({close: true})})), /unapproved SPL/);
  assert.throws(() => verified(snapshot({v: vault({frozen: true})})), /frozen or uninitialized/);
});

test('rejects wrong account discriminator and corrupted boolean', () => {
  const r = receipt(); r[0] ^= 42;
  assert.throws(() => verified(snapshot({r})), /discriminator mismatch/);
  const invalid = receipt(); invalid[216] = 3;
  assert.throws(() => verified(snapshot({r: invalid})), /Noncanonical serialized boolean/);
});

test('rejects a snapshot without a finalized context', () => {
  assert.throws(() => verified(snapshot({slot: 0})), /No finalized snapshot slot/);
});

test('two-RPC reconciliation rejects disagreement about refunded status', () => {
  const active = verified();
  const refunded = verified(snapshot({r: receipt({refunded: true}), c: config({active:0n}), v: vault({amount:0n}), slot:5001}));
  assert.throws(() => reconcileObservations(active, refunded), /disagree/);
});

test('two-RPC reconciliation permits different finalized snapshot slots if receipt bytes match', () => {
  const a = verified();
  const b = verifySnapshot({snapshot: snapshot({slot: 5010, c: config({active:200n}), v: vault({amount:200n})}), expected, genesisHash: pub(10), source:'other'});
  const joined = reconcileObservations(a,b);
  assert.equal(joined.creditEligible, false);
  assert.equal(joined.checkedBy.length,2);
});

test('RPC reader validates genesis and requests finalized account data', async () => {
  const s = snapshot();
  const calls = [];
  const fakeFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    const result = body.method === 'getGenesisHash' ? a.genesis : {
      context: {slot: s.slot},
      value: s.accounts.map(x=>({owner:x.owner, data:[x.raw.toString('base64'),'base64']})),
    };
    return {ok: true, json: async () => ({jsonrpc:'2.0',id:1,result})};
  };
  const outcome = await observeRpc({rpcUrl:'http://127.0.0.1:8899', expected, genesisHash:a.genesis, fetchFn:fakeFetch});
  assert.equal(outcome.creditEligible, false);
  assert.equal(calls[1].params[1].commitment, 'finalized');
  assert.deepEqual(calls[1].params[0],[a.receipt,a.config,a.vault]);
});

test('RPC reader rejects wrong chain before fetching accounts', async () => {
  let calls=0;
  const bad = async () => {calls++;return {ok:true,json:async()=>({result:pub(99)})};};
  await assert.rejects(observeRpc({rpcUrl:'http://127.0.0.1:8899', expected, genesisHash:a.genesis, fetchFn:bad}), /genesis hash mismatch/);
  assert.equal(calls,1);
});
