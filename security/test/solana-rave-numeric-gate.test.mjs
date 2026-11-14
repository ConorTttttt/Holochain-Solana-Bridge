/**
 * Independent SEC numeric ingress CONTRACT tests; not production conversion code.
 * No spendable amount is issued. Expose exact domain mismatches across SOL,
 * JSON/BigInt and published ZFuel i64 micro-unit representation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const U64_MAX = (1n << 64n) - 1n;
const I64_MAX = (1n << 63n) - 1n;

function canonicalSourceAmount(raw) {
  assert.equal(typeof raw, 'string', 'numeric JSON/JS Number ingress forbidden');
  assert.match(raw, /^(0|[1-9][0-9]*)$/, 'noncanonical base-unit amount');
  const amount = BigInt(raw);
  assert.ok(amount <= U64_MAX, 'outside unsigned Solana u64');
  return amount;
}

/** Reference: conversion is valid only when exact and representable. */
function exactZFuelMicroUnits(raw, tokenDecimals) {
  const baseUnits = canonicalSourceAmount(raw);
  assert.ok(Number.isSafeInteger(tokenDecimals) && tokenDecimals >= 0 && tokenDecimals <= 255,
    'untrusted token decimals');
  const exponent = tokenDecimals - 6;
  let units;
  if (exponent > 0) {
    const divisor = 10n ** BigInt(exponent);
    assert.equal(baseUnits % divisor, 0n, 'fractional micro-unit; rounding forbidden');
    units = baseUnits / divisor;
  } else {
    units = baseUnits * 10n ** BigInt(-exponent);
  }
  assert.ok(units <= I64_MAX, 'outside signed ZFuel positive capacity');
  return units;
}
function sixPlace(units) {
  const whole = units / 1_000_000n;
  const fraction = (units % 1_000_000n).toString().padStart(6, '0');
  return `${whole}.${fraction}`;
}

test('SEC-NUM-X1: >2^53 is exact as a decimal string, but not a JSON Number', () => {
  const raw = '9007199254740993';
  const wire = JSON.stringify({ amountBaseUnits: raw });
  assert.equal(exactZFuelMicroUnits(JSON.parse(wire).amountBaseUnits, 6), 9007199254740993n);
  assert.equal(sixPlace(exactZFuelMicroUnits(raw, 6)), '9007199254.740993');
  assert.notEqual(BigInt(JSON.parse(`{"amountBaseUnits":${raw}}`).amountBaseUnits), BigInt(raw));
  assert.throws(() => exactZFuelMicroUnits(JSON.parse(`{"amountBaseUnits":${raw}}`).amountBaseUnits, 6), /string/);
});

test('SEC-NUM-X2: Solana u64 maximum is NOT representable as positive ZFuel i64 micro-units', () => {
  assert.equal(canonicalSourceAmount(U64_MAX.toString()), U64_MAX);
  assert.throws(() => exactZFuelMicroUnits(U64_MAX.toString(), 6), /outside signed ZFuel/);
  assert.equal(sixPlace(exactZFuelMicroUnits(I64_MAX.toString(), 6)), '9223372036854.775807');
  assert.throws(() => exactZFuelMicroUnits((I64_MAX + 1n).toString(), 6), /outside signed ZFuel/);
  assert.throws(() => canonicalSourceAmount((U64_MAX + 1n).toString()), /outside unsigned Solana/);
});

test('SEC-NUM-X3: decimal-scale conversion either preserves every unit or fails explicitly', () => {
  assert.equal(exactZFuelMicroUnits('1', 6), 1n);
  assert.equal(exactZFuelMicroUnits('1', 3), 1000n);
  assert.equal(exactZFuelMicroUnits('1000', 9), 1n);
  assert.throws(() => exactZFuelMicroUnits('1001', 9), /rounding forbidden/);
  assert.throws(() => exactZFuelMicroUnits('1', 9), /rounding forbidden/);
  assert.equal(exactZFuelMicroUnits('9223372036854', 0), 9223372036854000000n);
  assert.throws(() => exactZFuelMicroUnits('9223372036855', 0), /outside signed ZFuel/);
});

test('SEC-NUM-X4: raw duplicate JSON keys lose their attack-relevant value after parse', () => {
  const raw = '{"amountBaseUnits":"1","amountBaseUnits":"9007199254740993"}';
  const parsed = JSON.parse(raw);
  assert.equal(Object.keys(parsed).length, 1);
  assert.equal(parsed.amountBaseUnits, '9007199254740993');
  // This test documents a dangerous permissive parser, NOT a secure parser.
  // Raw input MUST be duplicate-key checked before JSON.parse / serde_json Value.
  const nested = JSON.parse('{"reserve":{"1":"-1","1":"-2","0":"2"}}');
  assert.deepEqual(nested.reserve, { '1': '-2', '0': '2' });
});

test('SEC-NUM-X5: negative, exponent, decimal, leading zeros and wrong runtime types are denied', () => {
  for (const bad of ['-1', '+1', '01', '1.0', '1e6', '', ' 1', 'Infinity', 'NaN',
    (U64_MAX + 1n).toString(), 0, 1.5, 1n, null, undefined]) {
    assert.throws(() => canonicalSourceAmount(bad));
  }
  for (const decimals of [-1, 256, 6.5, '6', null]) {
    assert.throws(() => exactZFuelMicroUnits('1', decimals), /decimals/);
  }
});
