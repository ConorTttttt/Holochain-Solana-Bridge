import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectUntrustedScale } from './scale-guard.mjs';

const inert = result => {
  assert.equal(result.creditEligible, false);
  assert.equal(result.spendableBaseUnits, '0');
  assert.equal(result.withdrawalAuthorized, false);
  assert.equal(result.authorizedUnitMapping, false);
};
test('exact six-place arithmetic preserves 2^53+1 base units without Number', () => {
  const result = inspectUntrustedScale('9007199254740993', 6);
  assert.equal(result.fits, true);
  assert.equal(result.exactSixPlaceUnits, '9007199254740993');
  inert(result);
});
test('signed RAVE i64 boundary and u64 maximum refuse unsafe scaling', () => {
  const max = inspectUntrustedScale('9223372036854775807', 6);
  assert.equal(max.fits, true);
  inert(max);
  for (const candidate of [
    ['9223372036854775808', 6, 'SIGNED_I64_OVERFLOW'],
    ['18446744073709551615', 6, 'SIGNED_I64_OVERFLOW'],
    ['18446744073709551616', 6, 'U64_OVERFLOW'],
    ['9223372036854775807', 0, 'SIGNED_I64_OVERFLOW'],
  ]) {
    const result = inspectUntrustedScale(candidate[0], candidate[1]);
    assert.equal(result.fits, false);
    assert.equal(result.reason, candidate[2]);
    inert(result);
  }
});
test('fractional or unknown precision cannot silently round or guess', () => {
  for (const [value, decimals, reason] of [
    ['1', 9, 'WOULD_REQUIRE_ROUNDING'],
    ['9007199254740993', undefined, 'UNKNOWN_OR_INVALID_MINT_DECIMALS'],
    ['1', -1, 'UNKNOWN_OR_INVALID_MINT_DECIMALS'],
    ['1', 256, 'UNKNOWN_OR_INVALID_MINT_DECIMALS'],
    [9007199254740992, 6, 'REQUIRE_EXACT_U64_DECIMAL_STRING'],
    ['1.5', 6, 'REQUIRE_EXACT_U64_DECIMAL_STRING'],
    ['-1', 6, 'REQUIRE_EXACT_U64_DECIMAL_STRING'],
    ['01', 6, 'REQUIRE_EXACT_U64_DECIMAL_STRING'],
  ]) {
    const result = inspectUntrustedScale(value, decimals);
    assert.equal(result.fits, false, String(value));
    assert.equal(result.reason, reason);
    inert(result);
  }
});
test('a fractional source amount exactly divisible by its precision is math-only', () => {
  const exact = inspectUntrustedScale('123000', 9);
  assert.equal(exact.fits, true);
  assert.equal(exact.exactSixPlaceUnits, '123');
  assert.equal(exact.scope, 'TEST_ONLY_MATHEMATICAL_FIT_NOT_UNIT_EQUIVALENCE');
  inert(exact);
});
