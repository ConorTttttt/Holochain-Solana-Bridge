/**
 * SEC exact-unit boundary contract for JS/JSON handoffs.
 * This is a local REFERENCE contract, not a published RAVE Rust execution.
 * Do not interpret a failing RAVE ReserveUnits acceptance test as evidence
 * that RAVE rounded values. All external economic actions remain disabled.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
const U64_MAX=(1n<<64n)-1n;
const JS_SAFE=BigInt(Number.MAX_SAFE_INTEGER);
function exactUnsignedBaseUnits(x) {
  assert.equal(typeof x,'string','must not use floating-point JSON amounts');
  assert.match(x,/^(0|[1-9][0-9]*)$/,'canonical decimal integer');
  const n=BigInt(x);
  assert.ok(n<=U64_MAX,'outside u64 range');
  return n;
}
test('SEC-NUM-01: JSON numeric input above 2^53 irreversibly loses exact units',()=>{
  const next=(JS_SAFE+2n).toString(); // 9007199254740993
  const parsed=JSON.parse('{"amount":'+next+'}');
  assert.notEqual(BigInt(parsed.amount),BigInt(next));
  assert.throws(()=>exactUnsignedBaseUnits(parsed.amount),/string/);
});
test('SEC-NUM-02: exact decimal strings roundtrip above JS safe limit and at u64 max',()=>{
  for(const n of [0n,1n,JS_SAFE,JS_SAFE+1n,JS_SAFE+2n,U64_MAX-1n,U64_MAX]){
    const value=n.toString();
    assert.equal(exactUnsignedBaseUnits(JSON.parse(JSON.stringify({amount:value})).amount),n);
  }
});
test('SEC-NUM-03: forbid non-canonical, negative, fractional, exponent and out-of-range base units',()=>{
  for(const value of ['','+1','01','1.0','0.5','1e6','-1','NaN',
    'Infinity',(U64_MAX+1n).toString()]) {
    assert.throws(()=>exactUnsignedBaseUnits(value));
  }
});
test('SEC-NUM-04: reserve conservation must be exact in JS reference domain',()=>{
  function reserve(debit,credit){
    const d=BigInt(debit),c=exactUnsignedBaseUnits(credit);
    return d<0n && -d===c;
  }
  assert.equal(reserve('-9007199254740993','9007199254740993'),true);
  assert.equal(reserve('-9007199254740993','9007199254740992'),false);
  assert.equal(reserve('-18446744073709551615','18446744073709551615'),true);
  assert.equal(reserve('-18446744073709551615','18446744073709551614'),false);
});
