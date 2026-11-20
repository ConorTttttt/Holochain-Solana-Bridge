/**
 * TEST-ONLY exact arithmetic diagnostic for the OBS u64 -> RAVE signed i64
 * six-decimal unit representation. No proof of unit equivalence, mint
 * decimals, RAVE policy, source identity, or permission to credit.
 * NOT an economic conversion, Holochain zome, or bridge entry point.
 */
const MAX_U64 = (1n << 64n) - 1n;
const MAX_I64 = (1n << 63n) - 1n;
const DECIMAL_U64 = /^(0|[1-9][0-9]*)$/;

export function inspectUntrustedScale(amountBaseUnits, mintDecimals) {
  const refuse = reason => Object.freeze({
    fits: false, reason, creditEligible: false,
    spendableBaseUnits: '0', withdrawalAuthorized: false,
    authorizedUnitMapping: false,
  });
  if (typeof amountBaseUnits !== 'string' || !DECIMAL_U64.test(amountBaseUnits)) {
    return refuse('REQUIRE_EXACT_U64_DECIMAL_STRING');
  }
  const raw = BigInt(amountBaseUnits);
  if (raw > MAX_U64) return refuse('U64_OVERFLOW');
  if (!Number.isInteger(mintDecimals) || mintDecimals < 0 || mintDecimals > 255) {
    return refuse('UNKNOWN_OR_INVALID_MINT_DECIMALS');
  }
  // The RAVE host harness represents six-place ZFuel values with signed i64.
  // An actual unit conversion also needs a reviewed source/target mapping.
  const numerator = raw * 1000000n;
  const denominator = 10n ** BigInt(mintDecimals);
  if (numerator % denominator !== 0n) return refuse('WOULD_REQUIRE_ROUNDING');
  const units = numerator / denominator;
  if (units > MAX_I64) return refuse('SIGNED_I64_OVERFLOW');
  return Object.freeze({
    fits: true, exactSixPlaceUnits: units.toString(),
    scope: 'TEST_ONLY_MATHEMATICAL_FIT_NOT_UNIT_EQUIVALENCE',
    authorizedUnitMapping: false,
    creditEligible: false, spendableBaseUnits: '0', withdrawalAuthorized: false,
  });
}
