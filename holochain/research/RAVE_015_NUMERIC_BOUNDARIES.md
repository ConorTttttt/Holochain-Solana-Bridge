# RAVE 0.15.0 numeric contract and large-integer regression

**Date:** 2026-11-13. **PR:** #34. **Issues:** #14, #18. **Release decision: STOP SHIP.**
This document distinguishes *published crate/native dependency semantics* from
*RAVE integration execution*, *test-only adapter checks* and *actual Holochain DNA validation*.
No patch in this PR changes bridge economic authorization.

## 1. Root cause of integration run 43510726154

In `RAVE 0.15.0 real crate tests` (job `132179959342`), the test
`exact_reserve_over_javascript_safe_integer_limit` failed at old
`tests/holochain/rave-engine/src/lib.rs:98`:

```
assertion failed: accepts_shape(json!({
    "1": "-9007199254740993", "0": "9007199254740993"
}))
test result: FAILED. 7 passed; 1 failed
```

**The old test confused whole units with fixed-point micro-units.**
The locked `rave_engine =0.15.0` pulls `zfuel =0.9.1`. The tagged source
`zo-el/zfuel@v0.9.1` at commit
`050c3435b4c7598a8bd1e62a7a8f4408d09b46e1`,
`src/fuel.rs`, defines `ZFuel { units: i64, precision: Precision }`,
a maximum precision of six decimal places and signed 64-bit fixed-point
capacity. At precision six the maximum positive *micro-unit* quantity is
`9_223_372_036_854_775_807`, corresponding to
`9223372036854.775807` **whole units**. The original string
`9007199254740993` is **9,007,199,254,740,993 whole units** — far outside
that range; its successful acceptance should NEVER be required.

The difference from JavaScript's safe-integer threshold is important:
`9007199254.740993` whole units is
`9_007_199_254_740_993` micro-units (`2^53+1`), within signed-i64 limits.
The corrected test uses exactly that *decimal string*, with a matching
negative debit. Neither Rust test nor bridge wire format converts it to
JavaScript `Number`.

**Observed:** CI checked downloaded `rave_engine-0.15.0.crate` bytes against
SHA-256 `7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde`;
the old suite compiled and ran seven passing tests and one failing assertion.
The corrected tests in PR #34 are **not yet run on a Rust runner**.
This source-based diagnosis is strong, but the revised tests must be executed
with `cargo +1.95.0 test --locked --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets`.

## 2. Actual supported numeric representations

| Boundary | Representation | Consequence |
| --- | --- | --- |
| `ZFuel` native | `i64` stored units plus precision 0–6 | Fixed-point, range-checked; no arbitrary-precision magnitude |
| Published RAVE `UnitMap` test API | `UnitMap::try_from(serde_json::Value)`, then `ReserveUnits::accepts(&UnitMap)` | Checks exactly two directed, conserved, nonzero units; not a collateral or source-finality proof |
| JSON wire | Decimal **strings**, e.g. `"9007199254.740993"` | Required for exact cross-JavaScript handling; native JSON numbers must not be trusted as exact bridge amounts |
| `ZFuel` serde | Serializes to a JSON string and deserializes from a string | A numeric JSON token is not its canonical serializable form |
| Rhai | Published `RhaiEngine::execute(&serde_json::Value, code: Vec<u8>, ...)` | Pure scripts are not deployed zome execution. Numeric `Value::Number` ingress and Rhai casts must be separately audited; do not infer arbitrary precision |
| MessagePack | RAVE execution **code** is encoded as a MessagePack Rust `String`; the test also round-trips string-valued `UnitMap` JSON via MessagePack | MessagePack itself is not a finality proof and does not make floats exact |
| Signedness | Negative debit, strictly positive credit; no equal positive counterpart for `i64::MIN` at precision six | Two-sided conservation cannot use the unpaired minimum-negative amount |
| `u64` source-chain balances | Observer uses decimal-string `u64` base units | **Not equivalent** to RAVE `ZFuel` whole units or signed micro-units; an explicit reviewed scale/range conversion is required before any future economic mapping |

This is a **documented type/capacity mismatch in the old fixture**, not
evidence that RAVE silently accepted an imprecise value. Still, no Rust
ReserveUnits shape check establishes bridge economic safety.

## 3. New Rust regression matrix (committed; execution outstanding)

* Exact `2^53-2`, `2^53-1`, `2^53`, `2^53+1` **micro-units** encoded as six-place decimal strings, each conserved exactly.
* Exact `2^53+1` string-valued MessagePack round-trip and acceptance.
* Old invalid `2^53+1` **whole-unit** magnitude, positive `i64::MAX`, negative `i64::MIN`, positive/negative overflow, and unsupported symmetric `i64::MIN` reserve.
* Zero, reverse directions, equal-sign entries, mismatched debits/credits, invalid unit counts, invalid strings, nulls, arrays, native numeric/floating JSON tokens and malformed serialized maps.
* Duplicate `"1"` or `"0"` keys at raw JSON ingress.

**Critical serialization issue:** Parsing untrusted raw JSON directly into
`serde_json::Value` irreversibly overwrites repeated object keys. A malicious
`{"1":"not-a-number","1":"-5","0":"5"}` can normalize to an acceptable
two-unit `Value`. The new Rust test intentionally reproduces this library
limitation and verifies that a test-only strict raw object visitor rejects
duplicates **before** normalization. That visitor is **NOT wired into**
a production Holochain coordinator; a future real wire boundary must be audited
and must reject duplicate raw keys prior to `UnitMap::try_from`.

The tests add `serde =1.0.228` and `zfuel =0.9.1` as direct dependencies,
reusing the versions already present in the committed `Cargo.lock`. The
lock's root harness entry was updated without changing transitive versions.
Any `cargo test --locked` rejection must be investigated rather than using
`--offline` skips, modifying `rave_engine` pins or weakening assertions.

## 4. Executed shadow/adversarial evidence

Integrated snapshot `24b60e72ac78afbab5562c605094c3146bddd653` in
[GitHub Actions run 43510726154](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43510726154)
logged:

- `shadow-review.test.mjs`: 12 passed / 0 failed.
- `shadow-cli.test.mjs`: 2 passed / 0 failed.
- `test-only-adapter.test.mjs`: 6 passed / 0 failed.
- `transaction-shadow.test.mjs`: 8 passed / 0 failed.
- `economic-attack-model.test.mjs`: 5 passed / 0 failed.

These **33 tests passed in that integration snapshot**, not in the newly
committed Rust test revision. They cover binding, duplicate evidence,
refunds, malformed amounts, schema/trust escalation, conflicting observations,
one-process replay and independent partitioned journals. No Holochain conductor
was launched; these are in-memory, non-economic classification fixtures.

## 5. Real Unyt/Holochain gate and security handoff

Release `unytco/unyt-sandbox v0.117.0` provides candidate `unyt.happ` and
`alliance.dna` binaries with checksum/signature metadata. The exact Unyt
source gitlink at that tag is
`d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf`, but the
`unytco/unyt-app` submodule returns **404** under the available credentials.
No equivalence to a deployed Unyt DNA/zome or to the reviewed RAVE crate is
established. This environment lacks `cargo`, `rustc`, `hc`, `holochain`
and `minisign`, and external download DNS is unavailable. The conductor
preflight remains deliberately fail-closed (exit 2); no real zome call,
two-conductor fork, migration, receipt-loss or partition test has executed.

**P0 security obligations (not confirmed deployed exploits):**
`ParkedLinkStanding` reads across conflicting histories, duplicated
commitments across agreements/epochs, recovery carryover across DNA
migrations, crash/lost receipts, split-brain journals and payout signer
exactly-once semantics. Each must be exercised against the exact
production-equivalent integrity/coordinator zomes with a replay-fenced
economic ledger and an independently reviewed Solana custody-finality policy.
A publicly published Rust API and mock adapters do not prove those invariants.

## 6. Reproduction and acceptance

```sh
bash tests/holochain/rave-engine/verify-crate.sh
cargo +1.95.0 test --locked --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets -- --nocapture
node --test tests/holochain/*.test.mjs
bash tests/holochain/sandbox/check-toolchain.sh   # expected exit 2 until real conductor gate exists
```

Capture versions, exact exit codes, lock hash, stdout/stderr and test count
from a network-enabled runner. Security must independently review the
numeric mapping and duplicate-key ingress vulnerability before
permission to issue credits is considered.

**Unchanged invariants:** `creditEligible:false`,
`spendableBaseUnits:"0"`, `withdrawalAuthorized:false`.
No mainnet custody, spendable Unyt credits or production withdrawals.
