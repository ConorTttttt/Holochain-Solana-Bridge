// Runnable without project dependencies: reference specification, NOT bridge implementation.
// This suite demonstrates conservation and replay requirements, not source/deployment proof.
import test from 'node:test';
import assert from 'node:assert/strict';

const base = x => {
  assert.equal(typeof x, 'bigint', 'exact integer base units required');
  assert.ok(x >= 0n, 'negative quantity');
  return x;
};
function covered({ custody, refundable = 0n, live = 0n, unpaid = 0n, other = 0n }) {
  [custody, refundable, live, unpaid, other].forEach(base);
  assert.ok(custody >= refundable + live + unpaid + other, 'undercollateralized');
}
class Model {
  constructor(custody, live) {
    this.custody = custody;
    this.live = live;
    this.unpaid = 0n;
    this.paid = new Set();
    this.reserved = new Map();
    covered(this);
  }
  reserve(identity, amount, proof) {
    if (!proof?.economicallyIrreversible || proof?.forkDispute) throw new Error('unproven debit');
    if (this.reserved.has(identity) || this.paid.has(identity)) throw new Error('replayed identity');
    base(amount);
    if (amount === 0n || amount > this.live) throw new Error('insufficient extant claim');
    this.live -= amount;
    this.unpaid += amount;
    this.reserved.set(identity, amount);
    covered(this);
  }
  pay(identity) {
    const amount = this.reserved.get(identity);
    if (amount === undefined) throw new Error('missing or paid');
    if (amount > this.custody) throw new Error('insufficient custody');
    this.custody -= amount;
    this.unpaid -= amount;
    this.reserved.delete(identity);
    this.paid.add(identity); // MUST be durably atomic with actual payout on Solana
    covered(this);
  }
}

test('positive: an uncredited refundable deposit is collateral-covered', () => {
  covered({ custody: 100n, refundable: 100n, live: 0n });
});

test('adversarial: refund liability plus minted credit cannot share the same 100 units', () => {
  assert.throws(() => covered({ custody: 100n, refundable: 100n, live: 100n }), /undercollateralized/);
});

test('adversarial: unpaid withdrawal must be reserved even after claim extinction', () => {
  assert.throws(() => covered({ custody: 99n, live: 0n, unpaid: 100n }), /undercollateralized/);
  covered({ custody: 100n, live: 0n, unpaid: 100n });
});

test('positive: irrevocable burn moves live claims to unpaid, payout reduces collateral', () => {
  const s = new Model(100n, 100n);
  s.reserve('global:withdrawal:one', 100n, { economicallyIrreversible: true, forkDispute: false });
  assert.equal(s.live, 0n);
  assert.equal(s.unpaid, 100n);
  s.pay('global:withdrawal:one');
  assert.equal(s.custody, 0n);
  assert.equal(s.unpaid, 0n);
});

test('adversarial: stale or fork-disputed parked link cannot release tokens', () => {
  const s = new Model(100n, 100n);
  assert.throws(() => s.reserve('withdrawal', 100n, { economicallyIrreversible: false }), /unproven debit/);
  assert.throws(() => s.reserve('withdrawal', 100n, { economicallyIrreversible: true, forkDispute: true }), /unproven debit/);
  assert.equal(s.live, 100n);
});

test('adversarial: migration and restored backup must not replay an old global claim ID', () => {
  const s = new Model(100n, 100n);
  const id = 'sol-genesis:program:mint:holo-dna:receipt:withdrawal';
  s.reserve(id, 100n, { economicallyIrreversible: true });
  assert.throws(() => s.reserve(id, 100n, { economicallyIrreversible: true }), /replayed identity/);
  s.pay(id);
  assert.throws(() => s.pay(id), /missing or paid/);
  assert.throws(() => s.reserve(id, 100n, { economicallyIrreversible: true }), /replayed identity/);
});

test('adversarial: values beyond Number.MAX_SAFE_INTEGER remain exact', () => {
  const n = (1n << 63n) + 7n;
  covered({ custody: n, live: n - 3n, unpaid: 3n });
  assert.throws(() => covered({ custody: n - 1n, live: n - 3n, unpaid: 3n }), /undercollateralized/);
});
