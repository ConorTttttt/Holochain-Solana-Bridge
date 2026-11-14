# Agent 5 — exact-source independent gate review (13 November 2026)

**PR:** #33 · **Issues:** #15, #21 · **Decision:** **Gate A FAIL; Gate B HOLD (isolated, non-economic reference research only); Gate C NO-GO.** No merge approval, no release/issuance/withdrawal authority, and no self-approval of economic changes.

## Exact review target and evidence precedence

The newest combined integration source inspected during this review is `6d53b33ad8ca4b37d2a86201d29a2c7090da6c22` on `integration/s0/11-all-agent-snapshot` (#37). The manifest pins CI `9f620bc7a6bbc5b920ea1cba87ec46bc0e293dd2`, SOL `fef1a8ce0e5958814914d973a366c6ca3c26fdf1`, OBS `1638ada9ab8fa8156a45f6db4392eedcebaeabea`, RAVE `d752c284dfdef19f873c5da75c66559d87f69b4e` and SEC `d8cbff0f5ab3d3e734fb14de944a8024d05f87cd`. Integration additionally instruments SOL signed-wire capture. The new security ledger-corruption test was committed to SEC *after* those source pins and is **not yet integrated**.

**NO complete required Actions execution for `6d53b33a` was available when inspected.** The last observed *completed* integrated attempts were on older `4949b5693dccba1ff373a276a75c27db2f045005`: [CI 43520698081](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43520698081) failed OBS (47/48 standalone; 124/125 offline), and [validator/RAVE 43520697998](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43520697998) failed SOL transaction serialization before intended on-chain negative test; published RAVE Rust 12/12 passed. Fresh Actions runs observed at 23:25 UTC were *in progress* on other commits, **not** evidence that this exact integration is green. A previously successful CI branch is not a substitute for #37 exact-head cross-agent verification.

## Independently executed adversarial tests — exact source bytes

**Environment:** Node `v22.16.0`, Linux isolated local working directory, no Solana validator, no networked npm install, no Holochain conductor. Downloaded reviewed file contents through the connected GitHub repository interface and compared local `git hash-object` output with GitHub blob SHAs. The locally reconstructed source was byte-identical.

```text
observer/src/ledger.mjs                                84c57464af324e0842dd70b8d0b4772ac399e2b7
security/test/replay-ledger-adversarial.test.mjs         67aa4fcfc63c6b44b1db95b22ec137169d9dd819
security/test/solana-rave-numeric-gate.test.mjs          808fabed2454cc365c5832d36e5e430128fa2878
security/test/solvency-model.test.mjs                    2ba403364899f6bc9c818dfbdf64919c937a8339
security/test/sprint1-economic-attacks.test.mjs          614417d551306c00d2764d714ea95246c7a20f07
security/test/ledger-corruption-boundary.test.mjs        a2087d3998ef5275bf3a8c7170cd77e6e016d336
```

The final line is **new SEC-only review code** (same SHA committed to PR #33), executed with the unmodified integration-owned OBS ledger. `node --check` on the new test and numeric test succeeded. Executing:

```sh
node --test security/test/{solvency-model,sprint1-economic-attacks,solana-rave-numeric-gate,replay-ledger-adversarial,ledger-corruption-boundary}.test.mjs
```

with those exact reviewed files plus the actual `observer/src/ledger.mjs` in the corresponding relative checkout yielded **29 tests, 29 pass, 0 fail, 0 skip**. This is a **real unit/reference execution on exact byte-matched modules**, *not* a complete integrated SDK, Rust or local-validator run. Existing tests on the SEC-only branch would skip when OBS source is not present: those skips are never counted here.

**New demonstrated ledger attack surface** (`ledger-corruption-boundary.test.mjs`, 4 test counts including parent):

1. An attacker who changes only an evidence amount triggers the persisted SHA fingerprint rejection, and the writer lock is cleaned up.
2. An attacker with write access to the ledger JSON can replace a stored blockhash and *increase the checkpoint* to skip as-yet-unchecked slots; recovered `DepositLedger` accepts this.
3. An attacker can change evidence amounts and recompute the ordinary SHA-256 fingerprint; the recovered ledger accepts this. Keeping `creditEligible:false` is still enforced, but the stored amount is **not authenticated** against malicious local writes.

Thus the indexer has useful crash/accidental-corruption checks but **no cryptographically authenticated checkpoint**. A ledger guarded by a normal SHA digest is not an authoritative global replay/finality ledger. This is a demonstrated local attacker capability, not evidence of a deployed external payout exploit.

## Two recently corrected P0 regressions: interpretation and missing live evidence

**OBS (Agent 3):** The reviewed latest `observer/test/indexer.test.mjs` now constrains mock `getBlocks(start,end)` to the requested inclusive interval; it also adds two-signer and restart assertions. `observer/src/indexer.mjs` calls `verifyWireSignatures` on *every* entry before deciding whether a transaction's `meta.err` is non-null. The SEC `indexer-checkpoint-regression.test.mjs` uses interval-correct listings except in a separate explicit malformed-list test, asserts an `invalid Ed25519 transaction signature` failure, immutable persisted checkpoint 20, cleanup of the writer lock, and a clean replay through slot 21. **These source checks are not a completed runtime pass**: execute actual `@solana/kit@8.6.0` full OBS and SEC suites against the exact combined SHA, with 0 applicable skips. Specifically confirm the bad signature rejection is **not masked by an earlier listing-fixture exception**; also test failed, unrelated, duplicate, wrong-key, contradictory-block and corrupted-journal cases. Agent 3 owns source tests; Agent 1 owns the merged CI execution; SEC independently reviews logs.

**SOL (Agent 2):** The corrected `tests/solana/integration.test.mjs` now differentiates missing client signatures from fully signed wrong-owner token-source attempts. It prepares a canonical attacker receipt, signs with the attacker as payer/depositor, submits the unauthorized SPL source operation, requires *included on-chain* non-null `meta.err`, verifies rejected operations leave raw custody/accounting state unchanged, and verifies the failed receipt did not initialize. `submitOnChain` explicitly does `tx.sign(...signers)` then `sendRawTransaction(...skipPreflight:true)`, followed by confirmed inclusion. These are **reviewed source-level assertions**, not a witnessed new validator success. Run actual clean local validator and capture signatures, `meta.err`, slots, generated IDL/ELF hashes, pre/post account bytes, two-wallet race, u64-max, first-initializer capture and retained-ledger restart. Missing-signature serialization exceptions must not masquerade as on-chain authorization tests.

## Independently reviewed security boundaries

**Solana custody/first initializer — P0:** `Initialize` accepts `admin: Signer` as the payer for singleton `[b"config"]`, sets `config.admin = admin.key()`, and lets the successful first signer choose mint and scope. There is no pinned deployment-root authorizer in the reviewed on-chain code. This is **source-confirmed first-initializer capture**; the isolated attacker-first validator test is still needed to verify the exact deployed ELF and post-state, and a separately approved hardened implementation must prove attacker-first rejection. `refund` remains available to the depositor, so Solana collateral is *refundable* and cannot simultaneously back independent spendable Holochain claims. Pause authority, SPL authority constraints, upgrade governance and mint authority are separate checks.

**Solana observer provenance/finality — P0 for economics:** A locally verified Ed25519 signature authenticates the signed wire *message* and its required signers. Matching `getTransaction` and `getBlock`, two agreeing provider URLs, finalized RPC flags, parent pointers, loaded ALT addresses and token deltas are still **RPC-reported history**, not a trustless proof of canonical Solana finalized inclusion. Two URLs may be controlled by a common operator. A self-consistent fabricated RPC view can satisfy structural checks. Historical v0 Address Lookup Table accounts/expansion, upgrades and CPI attribution remain outside independent historical authentication. The OBS output's `creditEligible:false` and `independentConsensusVerified:false` must remain fail-closed.

**Holochain/Unyt — P0 for economics:** Published RAVE host-library Rust tests and JavaScript shadow adapters are useful but **not equivalent to actual deployed Unyt DNA, integrity/coordinator zomes and conductor calls**. The intended tagged Unyt application submodule `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf` is not accessible with available credentials. Parked standing can be reversed, disputed or read differently under forks/partitions; independent agreement/journal instances can accept the same claim. Recovery carryover, successor DNA and replaced agreements can replay an obligation unless a globally stable entitlement identity is durably fenced. `init_properties` are conductor-local, not DHT-integrity-visible. `restore_from_dht` requires key continuity, available peers and fork/warrant handling. Holochain 0.7 countersigning is feature-gated and no shipped Unyt conductor feature attestation exists. A real two-conductor, deployed-WASM, multi-agent fork/recovery/migration suite is a **hard unfulfilled condition**, not a skipped test that passes.

**Exact numeric ingress — P0 for economics:** Solana `u64::MAX=18446744073709551615` is beyond signed positive i64 `ZFuel` micro-unit maximum `9223372036854775807`. `2^53+1` base units must remain a string/BigInt in JavaScript. For a six-decimal mint its exact ZFuel whole-unit value is `9007199254.740993`, **not** `9007199254740993`. Decimal scaling that leaves fractional micro-units or overflows must fail, never round/clamp. Node reference tests passed these examples. Duplicate JSON object keys are silently collapsed by `JSON.parse` and `serde_json::Value`: raw untrusted ingress must reject duplicates *before* normalization. The published RAVE Rust suite and production Rhai/MessagePack/JSON path need their own exact-value and duplicate-key executable tests, including negative values and real deployed ingress.

## Readiness matrix / exit evidence

| Gate | Security verdict | Minimum executable exit evidence | Responsible |
| --- | --- | --- | --- |
| **A — Reproducible development baseline** | **FAIL / NOT YET VERIFIED** | Both required GitHub Actions workflows completed SUCCESS on the **identical latest frozen integration SHA**; pinned dependency locks, real Anchor SBPF/IDL build, actual Kit OBS/SEC checkpoint and provenance suites (including the new ledger tamper test), RAVE Rust, signed localnet validator modes and restart; no failing, required-skipped or hidden tests; retained logs/IDL/ELF/witness digests. | **Agent 1** integration; **Agents 2/3/4** own failing code/fixtures; **Agent 5** reviews |
| **B — Non-economic shadow integration** | **HOLD as formal milestone**; isolated localnet/read-only shadow *research* is permissible only under deny-by-default policy | Gate A passed, verified read-only ingestion on same exact signed-wire and finalized block/account fixtures, zero economic outputs and tested `creditEligible:false`, `CREDITING_DISABLED`, `WITHDRAWALS_DISABLED`; explicit source-to-runtime distinction. For a milestone claiming **Unyt** integration, authenticated test DNA/WASM and actual two-conductor zome calls are additionally mandatory. | **Agents 1+3** on-wire replay, **Agent 4** conductor, **Agent 5** independent gate |
| **C — Spendable economic bridge** | **NO-GO / P0 STOP** | Independent finalized inclusion/ALT/program provenance, deployment-root initialize restrictions and approved upgrade/mint authority governance, nonrefundable exclusive custody with exact conservation, irrevocable cross-chain standing, cross-fork/agreement/DNA/global replay fence, authenticated durable withdrawal journal, real two-conductor recovery/replay/partition/migration tests, production numeric/JSON ingress checks and external independent audit; separately authorized economics. | **Agent 2** SOL backing/authorities; **Agent 3** finality/ledger; **Agent 4** Unyt/RAVE; **Agent 1** traceable integration; **independent Agent 5** reviews, never self-approves |

### Immediate owners / runnable blockers

- **Agent 1:** freeze a new exact integration head with source SHAs and both required Actions runs; add `security/test/ledger-corruption-boundary.test.mjs` to required cross-lane suite, never as an optional skip. Preserve executed test counts and JSON-RPC/wire/ELF/IDL hashes.
- **Agent 3:** prove full real-Kit checkpoint regression uses valid in-range restart fixture, all required Ed25519 checks, persists unchanged state on bad input; test corrupted/recomputed journal state, cross-instance replay and fabricated RPC/ALT assumptions. Deny economic credit regardless of provider agreement.
- **Agent 2:** complete real-validator on-chain wrong-signer/wrong-owner and attacker-first initialization tests with exact post-state invariants, concurrent-wallet/nonce, u64 and restart; resolve singleton capture only with separately reviewed authorized-root design.
- **Agent 4:** prove RAVE numeric and duplicate-key ingress with locked published Rust library; obtain exact intended Unyt app source/WASM identity and run the actual compatible conductor multi-agent fork/recovery/migration/countersigning feature checks.
- **Agent 5:** re-review immutable Actions artifacts, fail on any masked test or skip, and maintain **NO-GO** for economic issuance or external withdrawal.

**Restrictions unchanged:** Do not merge to production, issue spendable credit, accept client-authorized finality, sign a payout, or self-approve materially economic changes based on this report.
