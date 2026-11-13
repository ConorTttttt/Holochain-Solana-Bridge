// Independent SEC-lane tests. Run: node --test security/test/adversarial.test.mjs
// Fixture snapshots test the observer's trust boundary; they are NOT Solana consensus proofs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addressBytes, discriminator, encode58 } from '../../observer/src/decode.mjs';
import { CLASSIC_TOKEN_PROGRAM, verifySnapshot, reconcileObservations } from '../../observer/src/verify.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const key = byte => encode58(Buffer.alloc(32, byte));
const a = {
  program: key(1), receipt: key(2), config: key(3), vault: key(4),
  mint: key(5), depositor: key(6), admin: key(7), genesis: key(8),
  scope: Buffer.alloc(32, 9), recipient: Buffer.alloc(32, 10),
};
const expected = {
  program: a.program, receipt: a.receipt, config: a.config,
  vault: a.vault, mint: a.mint, scope: a.scope.toString('hex'),
};
function putKey(buf, offset, pubkey) { addressBytes(pubkey).copy(buf, offset); }
function config(active = 100n) {
  const out = Buffer.alloc(114);
  discriminator('BridgeConfig').copy(out);
  putKey(out, 8, a.admin); putKey(out, 40, a.mint);
  a.scope.copy(out, 72); out.writeBigUInt64LE(active, 105); out[113] = 255;
  return out;
}
function receipt(refunded = false, mint = a.mint) {
  const out = Buffer.alloc(218);
  discriminator('DepositReceipt').copy(out);
  putKey(out, 8, a.depositor); putKey(out, 40, mint);
  putKey(out, 72, a.vault); putKey(out, 104, a.config);
  a.recipient.copy(out, 136); a.scope.copy(out, 168);
  out.writeBigUInt64LE(42n, 200); out.writeBigUInt64LE(100n, 208);
  out[216] = Number(refunded); out[217] = 255;
  return out;
}
function vault(amount = 100n) {
  const out = Buffer.alloc(165);
  putKey(out, 0, a.mint); putKey(out, 32, a.config);
  out.writeBigUInt64LE(amount, 64); out[108] = 1;
  return out;
}
function observed({ slot = 100, refunded = false, badMint = false, chosen = expected } = {}) {
  const r = receipt(refunded, badMint ? key(77) : a.mint);
  const c = config(refunded ? 0n : 100n);
  const v = vault(refunded ? 0n : 100n);
  return verifySnapshot({
    snapshot: { slot, accounts: [
      { owner: a.program, raw: r },
      { owner: a.program, raw: c },
      { owner: CLASSIC_TOKEN_PROGRAM, raw: v },
    ] },
    expected: chosen, genesisHash: a.genesis, source: 'test-rpc',
  });
}

test('SEC-01 positive: an active refundable receipt yields observation but never credit', () => {
  const value = observed();
  assert.equal(value.state, 'active_refundable');
  assert.equal(value.amountBaseUnits, '100');
  assert.equal(value.creditEligible, false);
  assert.throws(() => issueHolochainCredit(value), /CREDITING_DISABLED/);
});

test('SEC-02 refund-after-observation does not confer issuance rights', () => {
  const before = observed({ slot: 100 });
  const after = observed({ slot: 101, refunded: true });
  assert.equal(before.state, 'active_refundable');
  assert.equal(after.state, 'refunded');
  assert.equal(after.activeLiabilitiesBaseUnits, '0');
  assert.equal(before.creditEligible, false);
  assert.equal(after.creditEligible, false);
  assert.throws(() => reconcileObservations(before, after), /disagree/);
  assert.throws(() => issueHolochainCredit(before), /CREDITING_DISABLED/);
});

test('SEC-03 even a caller-forged creditEligible=true is rejected by the issuance gate', () => {
  assert.throws(() => issueHolochainCredit({ creditEligible: true, amountBaseUnits: '100' }), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal({ parked: true, amount: '100' }), /WITHDRAWALS_DISABLED/);
});

test('SEC-04 malicious account substitution with a different mint is rejected', () => {
  assert.throws(() => observed({ badMint: true }), /Mint mismatch/);
});

test('SEC-05 documented gap: arbitrary claimed receipt address is not PDA-derived', () => {
  // The observer treats expected.receipt as caller-supplied. It cannot prove these
  // valid-looking bytes were actually stored at the canonical Solana receipt PDA.
  const substituted = observed({ chosen: { ...expected, receipt: key(99) } });
  assert.equal(substituted.receiptAddress, key(99));
  assert.equal(substituted.creditEligible, false);
});

test('SEC-06 documented gap: a claimed finalized slot is not a consensus proof', () => {
  // verifySnapshot checks only the slot's shape, not cryptographic block inclusion.
  const spoof = observed({ slot: 900000 });
  assert.equal(spoof.finalizedSlot, 900000);
  assert.equal(spoof.creditEligible, false);
});

test('SEC-07 two agreeing observations cannot make an unbacked claim eligible', () => {
  const first = observed({ slot: 100 });
  const second = observed({ slot: 101 });
  const joined = reconcileObservations(first, { ...second, source: 'second-rpc' });
  assert.equal(joined.checkedBy.length, 2);
  assert.equal(joined.creditEligible, false);
});

// The following tests exercise a REFERENCE SPECIFICATION, not deployed Solana,
// Holochain or Unyt code. They define required behavior for future implementations.
function ensureSolvent({ collateral, refundable = 0n, claims = 0n, pending = 0n, other = 0n }) {
  const n = [collateral, refundable, claims, pending, other];
  assert.ok(n.every(x => typeof x === 'bigint' && x >= 0n), 'nonnegative exact base units');
  assert.ok(refundable + claims + pending + other <= collateral, 'insufficient spendable collateral');
}
class ReferenceRedemptionLedger {
  constructor(collateral, claims) {
    this.collateral = collateral;
    this.claims = claims;
    this.pending = 0n;
    this.redemptions = new Map(); // persistent globally across migrations/epochs
  }
  reserve(globalId, amount, irreversibleParkedSpend) {
    if (!irreversibleParkedSpend) throw new Error('unproven irreversible spend');
    if (this.redemptions.has(globalId)) throw new Error('global replay');
    if (amount <= 0n || this.claims < amount) throw new Error('not enough extinguished claim');
    this.claims -= amount;
    this.pending += amount;
    this.redemptions.set(globalId, { amount, status: 'unpaid' });
    ensureSolvent(this);
  }
  settle(globalId) {
    const item = this.redemptions.get(globalId);
    if (!item || item.status !== 'unpaid') throw new Error('already paid or unknown');
    if (this.collateral < item.amount) throw new Error('insufficient funds');
    this.collateral -= item.amount;
    this.pending -= item.amount;
    item.status = 'paid'; // on-chain atomic status + transfer required in real design
    ensureSolvent(this);
  }
}

test('SPEC-01: refundable deposit and equivalent spendable credit violate solvency', () => {
  ensureSolvent({ collateral: 100n, refundable: 100n });
  assert.throws(() => ensureSolvent({ collateral: 100n, refundable: 100n, claims: 100n }), /insufficient spendable collateral/);
});

test('SPEC-02: a pending withdrawal replaces, never duplicates, an extinguished claim', () => {
  const s = new ReferenceRedemptionLedger(100n, 100n);
  ensureSolvent(s);
  s.reserve('genesis:app:depositor:withdrawal', 100n, true);
  assert.equal(s.claims, 0n);
  assert.equal(s.pending, 100n);
  s.settle('genesis:app:depositor:withdrawal');
  assert.equal(s.collateral, 0n);
  assert.equal(s.pending, 0n);
  assert.throws(() => s.settle('genesis:app:depositor:withdrawal'), /already paid/);
});

test('SPEC-03: a forked or reversible parked spend cannot authorize release', () => {
  const s = new ReferenceRedemptionLedger(100n, 100n);
  assert.throws(() => s.reserve('withdraw-1', 100n, false), /unproven irreversible spend/);
  assert.equal(s.claims, 100n);
  assert.equal(s.pending, 0n);
});

test('SPEC-04: migration/recovery cannot reset global one-time withdrawal identity', () => {
  const s = new ReferenceRedemptionLedger(100n, 100n);
  const globalId = 'genesis:program:scope:dna:receipt:withdraw-1';
  s.reserve(globalId, 100n, true);
  assert.throws(() => s.reserve(globalId, 100n, true), /global replay/);
  s.settle(globalId);
  assert.throws(() => s.reserve(globalId, 100n, true), /global replay/);
});
