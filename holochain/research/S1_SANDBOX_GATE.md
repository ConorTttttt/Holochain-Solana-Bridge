# Sprint 1 Holochain/RAVE shadow sandbox — #14 / PR #34

**P0 STOP SHIP** remains. No real Holochain credit or production withdrawal path was added. Existing `holochain/evidence-gate.mjs` is unchanged.

## What actually executes

From repository root on Node.js 22.16.0:

```sh
node --test tests/holochain/*.test.mjs
node --check holochain/test-only-adapter-cli.mjs
bash -n tests/holochain/sandbox/check-toolchain.sh
```

`holochain/test-only-adapter.mjs` invokes the repository's `reviewShadow()` on an OBS `solana-receipt-observation-v1` object and generates an inert audit record in a **process-local** journal. Its separate CLI accepts binding JSON as argument and an array of observations on stdin:

```sh
node holochain/test-only-adapter-cli.mjs /path/to/binding.json < /path/to/observations.json
```

Exit 0 means all records are *quarantined*, not valid collateral. Exit 2 means rejected/malformed input. Every record has `creditEligible: false`, `spendableBaseUnits: "0"`, `withdrawalAuthorized: false`, `transactionVerified: false`, `conductorExecuted: false` and `deployedDnaVerified: false`. Duplicate evidence is rejected only within one adapter instance; independent journals accept the same receipt, an intentional counterexample to global replay assurances. A refund is never an issuance authorization. This module makes **no conductor call, zome call or economic entry**.

Six new local Node tests passed (Node 22.16.0, 6/6, zero skipped). Local test environment contained the new source files and transcribed existing shadow reviewer and disabled credit gate. Full-checkout CI rerun is still required.

## Source/real RAVE boundary

`tests/holochain/rave-engine/verify-crate.sh` now fetches the crates.io sparse index, checks version 0.15.0 checksum and yanked status against the reviewed digest `7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde`, downloads the `.crate`, validates archive SHA-256, and examines its manifest/source inventory. Its new network path is **not yet executed** (current sandbox has no crates.io DNS).

The real crate host tests exercise `ReserveUnits::accepts`, `RhaiEngine::execute` and enum status variants; this is NOT direct execution of deployed Unyt integrity/coordinator validations, receipt or recovery lifecycle, or a globally final parked spend.

Prior GitHub Actions run 43499276656 produced a Cargo.lock artifact with SHA-256 `d05b99530bcfbad6ff6e3f67f503622bb6f7b15f5a7350f8a5f6ebe3ffaa5e18`. Its log reports two passing native tests in the earlier harness. The artifact has been downloaded for review but **no reviewed lockfile is committed** on this branch. CI must commit a reviewed lock and run with `--locked` before claiming transitive dependency reproducibility.

On an online Rust 1.95.0 runner:

```sh
bash tests/holochain/rave-engine/verify-crate.sh
cargo +1.95.0 test --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets
```

## Real conductor gate, intentionally blocked

The documented Holochain 0.7.1 stack uses `holochain` and `hc sandbox`. Run `bash tests/holochain/sandbox/check-toolchain.sh`; it intentionally **exits 2 even after** presence/hash checks, because no exact deployed Unyt hApp, DNA hash, integrity/coordinator WASM/source match and reviewed zome-call test are available. To unblock, supply verified source commit, zome hashes, hApp SHA, deployment DNA hash, actual compatible conductor install, positive/negative coordinator/integrity zome tests and multi-conductor fork/recovery assertions. Do not substitute an unrelated sample DNA.

References: https://developer.holochain.org/resources/compatibility/holochain-0.7/ and https://developer.holochain.org/resources/howtos/debugging/ .

## Economic finality matrix

| Attack | Executed layer | Still unproven |
|---|---|---|
| Conservation / invalid amounts | Published `ReserveUnits` shape check; shadow amount syntax | Real agreement/receipt/conservation settlement |
| Duplicate commitment and receipt | Offline model; adapter same-process duplicate | Global source-chain / DNA uniqueness |
| Refund after observation | Shadow-only model | Nonrefundable Solana custody (not implemented) |
| Parked/unparked and stale links | Published status variants; offline model | Authoritative `ParkedLinkStanding` on fork/partition |
| Reclaim / failed receipts | Public source review and model | Real coordinator rollback, reclaim economics |
| Agreement replacement and repeated recovery | Partition counterexample | Global idempotency across agreement histories |
| DNA migration and double payout | Separate shadow journals demonstrate risk | Durable settlement identity across epochs and on-chain payout |

## CI handoff to Agent 1

1. Run `node --test tests/holochain/*.test.mjs`, archive TAP output, fail on skips. Include all six new adapter tests.
2. On network-enabled runner run `bash tests/holochain/rave-engine/verify-crate.sh`; archive SHA, manifest/source proof and exit code.
3. Run native Rust 1.95.0 tests; review/commit harness `Cargo.lock`, then enforce `cargo +1.95.0 test --locked --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets`. Do not report locked execution until the lock actually exists.
4. Track `check-toolchain.sh` separately as an **open/blocked real-conductor gate**, not a passing or silently skipped test.
5. Keep draft and P0 STOP SHIP; require independent SEC and human review of any proposed economic change.
