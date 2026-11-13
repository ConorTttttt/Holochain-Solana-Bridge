// Independent SEC-lane tests. Exercise the actual Observer integration when its
// branch is present; against main, v2-only checks are explicitly SKIPPED rather
// than asserting obsolete pre-PDA behavior. Never an economic proof or audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as decoder from '../../observer/src/decode.mjs';
import { CLASSIC_TOKEN_PROGRAM, verifySnapshot, reconcileObservations } from '../../observer/src/verify.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const { addressBytes, discriminator, encode58 } = decoder;
const hasV2Observer = typeof decoder.decodeMint === 'function';
const { deriveBridgeAddresses } = hasV2Observer
  ? await import('../../observer/src/pda.mjs')
  : { deriveBridgeAddresses: null };

const key = byte => encode58(Buffer.alloc(32, byte));
const a = {
  // The published program ID is a development placeholder, not a verified deployment.
  program: 'Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS',
  mint: key(5), depositor: key(6), admin: key(7), genesis: key(8),
  scope: Buffer.alloc(32, 9), recipient: Buffer.alloc(32, 10),
};
const pdas = hasV2Observer
  ? await deriveBridgeAddresses({
    program: a.program, mint: a.mint, depositor: a.depositor, nonce: 42n,
  })
  : { config: key(3), vault: key(4), receipt: key(2), configBump: 255, receiptBump: 255 };
const expected = {
  program: a.program, receipt: pdas.receipt, config: pdas.config,
  vault: pdas.vault, mint: a.mint, scope: a.scope.toString('hex'),
};
function putKey(buf, offset, pubkey) { addressBytes(pubkey).copy(buf, offset); }

function config({ active = 100n, bump = pdas.configBump } = {}) {
  const out = Buffer.alloc(114);
  discriminator('BridgeConfig').copy(out);
  putKey(out, 8, a.admin); putKey(out, 40, a.mint);
  a.scope.copy(out, 72);
  out.writeBigUInt64LE(active, 105);
  out[113] = bump;
  return out;
}
function receipt({
  refunded = false, mint = a.mint, bump = pdas.receiptBump,
  nonce = 42n, depositor = a.depositor,
} = {}) {
  const out = Buffer.alloc(218);
  discriminator('DepositReceipt').copy(out);
  putKey(out, 8, depositor); putKey(out, 40, mint);
  putKey(out, 72, expected.vault); putKey(out, 104, expected.config);
  a.recipient.copy(out, 136); a.scope.copy(out, 168);
  out.writeBigUInt64LE(nonce, 200);
  out.writeBigUInt64LE(100n, 208);
  out[216] = Number(refunded);
  out[217] = bump;
  return out;
}
function vault({ amount = 100n, authority = expected.config, delegated = false } = {}) {
  const out = Buffer.alloc(165);
  putKey(out, 0, a.mint); putKey(out, 32, authority);
  out.writeBigUInt64LE(amount, 64);
  out.writeUInt32LE(delegated ? 1 : 0, 72);
  out[108] = 1;
  return out;
}
function mint({ supply = 1000n, frozenAuthority = false, initialized = true } = {}) {
  const out = Buffer.alloc(82);
  out.writeUInt32LE(1, 0); // mint authority exists for disposable localnet tokens
  out.writeBigUInt64LE(supply, 36);
  out[44] = 6;
  out[45] = initialized ? 1 : 0;
  out.writeUInt32LE(frozenAuthority ? 1 : 0, 46);
  return out;
}
function snapshot({
  slot = 100, refunded = false, badMint = false,
  active = refunded ? 0n : 100n, vaultAmount = refunded ? 0n : 100n,
  wrongVaultAuthority = false, delegated = false,
  receiptBump = pdas.receiptBump, configBump = pdas.configBump,
  nonce = 42n, mintFrozen = false, mintOwner = CLASSIC_TOKEN_PROGRAM,
} = {}) {
  const r = receipt({
    refunded, mint: badMint ? key(77) : a.mint, bump: receiptBump, nonce,
  });
  const values = [
    { owner: a.program, raw: r },
    { owner: a.program, raw: config({ active, bump: configBump }) },
    { owner: CLASSIC_TOKEN_PROGRAM, raw: vault({
      amount: vaultAmount, authority: wrongVaultAuthority ? key(99) : expected.config,
      delegated,
    }) },
  ];
  // Observer PR #36 added strict mint-owner/data validation. The old Observer
  // accepts only three accounts, so old-branch smoke tests remain separately runnable.
  if (hasV2Observer) values.push({
    owner: mintOwner, raw: mint({ frozenAuthority: mintFrozen }),
  });
  return { slot, accounts: values };
}
function observed({ chosen = expected, ...state } = {}) {
  return verifySnapshot({
    snapshot: snapshot(state),
    expected: chosen, genesisHash: a.genesis, source: 'test-rpc',
  });
}
const expectRejected = async (options, pattern) =>
  assert.rejects(async () => observed(options), pattern);

test('SEC-01 uncredited refundable deposit yields observation, never economic authority', async () => {
  const value = await observed();
  assert.equal(value.state, 'active_refundable');
  assert.equal(value.amountBaseUnits, '100');
  assert.equal(value.creditEligible, false);
  if (hasV2Observer) {
    assert.equal(value.transactionVerified, false);
    assert.equal(value.evidenceTrust, 'untrusted_rpc_snapshot');
  }
  assert.throws(() => issueHolochainCredit(value), /CREDITING_DISABLED/);
});

test('SEC-02 refund transition never produces issuance rights', async () => {
  const before = await observed({ slot: 100 });
  const after = await observed({ slot: 101, refunded: true });
  assert.equal(before.state, 'active_refundable');
  assert.equal(after.state, 'refunded');
  assert.equal(after.activeLiabilitiesBaseUnits, '0');
  assert.equal(before.creditEligible, false);
  assert.equal(after.creditEligible, false);
  assert.throws(() => reconcileObservations(before, after), /disagree/);
  assert.throws(() => issueHolochainCredit(before), /CREDITING_DISABLED/);
});

test('SEC-03 forged credit and parked-withdrawal claims are denied by explicit gates', () => {
  assert.throws(() => issueHolochainCredit({
    creditEligible: true, amountBaseUnits: '100',
  }), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal({
    parked: true, amount: '100',
  }), /WITHDRAWALS_DISABLED/);
});

test('SEC-04 altered mint in receipt is rejected', async () => {
  await expectRejected({ badMint: true }, /Mint mismatch/);
});

test('SEC-05 claimed noncanonical receipt PDA is rejected by Observer v2', async t => {
  if (!hasV2Observer) return t.skip('Requires Observer PR #36 with canonical PDA validation');
  await expectRejected(
    { chosen: { ...expected, receipt: key(99) } },
    /Noncanonical receipt PDA/,
  );
});

test('SEC-06 a spoofed finalized slot is NOT a consensus/inclusion proof', async () => {
  const spoof = await observed({ slot: 900000 });
  assert.equal(spoof.finalizedSlot, 900000);
  assert.equal(spoof.creditEligible, false);
  if (hasV2Observer) {
    assert.equal(spoof.transactionVerified, false);
    assert.equal(spoof.commitmentRequested, 'finalized');
  }
});

test('SEC-07 two agreeing RPC snapshots never authorize unbacked credit', async () => {
  const first = await observed({ slot: 100 });
  const second = await observed({ slot: 101 });
  const joined = reconcileObservations(first, { ...second, source: 'other-rpc' });
  assert.deepEqual(joined.checkedBy, ['test-rpc', 'other-rpc']);
  assert.equal(joined.creditEligible, false);
});

test('SEC-08 missing fourth mint account is rejected by Observer v2', async t => {
  if (!hasV2Observer) return t.skip('Requires mint-account validation from PR #36');
  const s = snapshot();
  s.accounts.pop();
  await assert.rejects(
    () => verifySnapshot({ snapshot: s, expected, genesisHash: a.genesis }),
    /Unexpected account snapshot/,
  );
});

test('SEC-09 wrong nonce and invalid PDA bumps are rejected', async t => {
  if (!hasV2Observer) return t.skip('Requires canonical PDA validation from PR #36');
  await expectRejected({ nonce: 43n }, /Noncanonical receipt PDA/);
  await expectRejected({ configBump: (pdas.configBump + 1) % 256 }, /config PDA bump/);
  await expectRejected({ receiptBump: (pdas.receiptBump + 1) % 256 }, /receipt PDA bump/);
});

test('SEC-10 malicious mint owner, freeze authority, delegation and vault authority fail closed', async t => {
  if (!hasV2Observer) return t.skip('Requires strict mint/token checks from PR #36');
  await expectRejected({ mintOwner: key(99) }, /Mint is not owned/);
  await expectRejected({ mintFrozen: true }, /freezable/);
  await expectRejected({ delegated: true }, /unapproved SPL token authority/);
  await expectRejected({ wrongVaultAuthority: true }, /Vault authority/);
});

test('SEC-11 same-slot inconsistent collateral is rejected; different-slot observations remain non-economic', async t => {
  if (!hasV2Observer) return t.skip('Requires v2 digest-aware reconciliation');
  const old = await observed({ slot: 100 });
  const changedSameSlot = await observed({ slot: 100, vaultAmount: 101n });
  assert.throws(
    () => reconcileObservations(old, changedSameSlot),
    /disagree about vaultDigest at same slot/,
  );
  const changedLater = await observed({ slot: 101, vaultAmount: 101n });
  const joined = reconcileObservations(old, changedLater);
  assert.equal(joined.agreement, 'receipt_bytes_only');
  assert.equal(joined.transactionVerified, false);
  assert.equal(joined.creditEligible, false);
});

test('SEC-12 a claimed source balance cannot exceed controlled spendable vault funds', async () => {
  await expectRejected({ active: 101n, vaultAmount: 100n }, /liabilities exceed vault balance/);
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
