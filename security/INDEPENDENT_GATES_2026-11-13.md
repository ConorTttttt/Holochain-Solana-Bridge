# SEC independent gate review — 13 November 2026

**Lane:** Agent 5, PR #33, issues #15/#21. **Decision:** **P0 STOP SHIP for all economic issuance and Solana withdrawals**; development-only experiments may continue. No self-approval, production deployment, minted credit or withdrawal authorization is granted.

## Evidence standard

- **Inspected source:** implementation reviewed on the named specialist branch, not a passing execution.
- **Historical executed CI:** GitHub Actions run on a specific earlier integrated SHA, never proof that today's revised head passes.
- **Executed local JS reference:** independent JavaScript assertions, never Rust RAVE or deployed Unyt.
- **Committed, unexecuted SEC integration test:** tests require the OBS branch overlaid with SEC and installed @solana/kit. Standalone SEC reports a deliberate skip and **must not be counted as green**.
- **Unexecuted local validator:** source-visible executable SOL tests, but no witnessed validator traces for the new scenarios.
- **Blocked deployed DNA:** no verified relevant deployed Unyt conductor/source/agreements or live zome validation.

## Critical findings and release acceptance matrix

### SEC-S2-01 — Critical / P0 — singleton initialization capture

- **Affected:** `programs/deposit_prototype/src/lib.rs`, `Initialize`, and the proposed first-initializer validator regression in SOL PR #35.
- **Preconditions:** fresh config PDA, executable deposit prototype and any funded attacker signer.
- **Reproduction evidence:** direct source inspection: `admin: Signer` pays for and creates globally unique config PDA, no pinned authorized-root constraint; the successful caller chooses `admin`, `mint` and `scope`. `tests/solana/integration.test.mjs` lines 642–687 implements a real attacker-first test, checks captured values, operator initialize/pause denial and attacker pause. **It has NOT successfully run in the latest validator integration**: run 43510726154 stops at `BPF_LOADER_UPGRADEABLE_PROGRAM_ID` import during module loading, before scenarios run.
- **Mitigation:** approved deployment-root signer pinned to reviewed build, authorized mint/scope and PDA manifest commitment, atomic initialization, reviewed upgrade governance. Do not patch a captured deployment as if trusted.
- **Unknowns:** actual signed attacker-first success/rejection transaction and byte-level post-state on a fresh local validator.
- **Acceptance:** run the *existing negative exploit* against old ELF to record vulnerability, then run a separately approved hardened ELF in a fresh validator: attacker-first transaction included with `meta.err != null`, unchanged config/vault; authorized initialization succeeds, wrong mint/scope/racing initialization fail, verified IDL and ELF hash archived.

### SEC-S2-02 — High / P1 (economic escalation P0) — Observer signer structure and transaction attribution

- **Affected:** OBS PR #36 `observer/src/transaction.mjs` and `observer/src/indexer.mjs`.
- **Preconditions:** any serialized legacy/v0/v1 transaction, potentially malformed signature bytes or wrong signer association.
- **Reproduction evidence:** frozen integration 43510726021 OBS job reports **38/45 pass, 7 fail**; six failures short-circuit in `missing signed transaction signatures` and one fixture references an undefined `signature`. OBS head `8306fb11` changes the assumption from JS `Map` to @solana/kit 8.6 address-keyed signature object, locates the first signed static account as transaction ID, and adds asynchronous `verifyWireSignatures` over every required signer. **The revised code has not passed the same integrated CI suite yet**. Independent SEC test `security/test/transaction-provenance-adversarial.test.mjs` commits valid two-signer, corrupt first/second signer, corrupted message, absent signature, wrong ID and unrelated-instruction attacks. This test has not been executed against the integrated SDK.
- **Mitigation:** retain signer-by-address binding; make Ed25519 validation mandatory before any candidate is emitted; reject count/key/signature inconsistency; do not treat a `decodeFinalizedWire` result as authenticated.
- **Unknowns:** re-run of entire actual-kit suite and independent SEC tests on OBS current SHA.
- **Acceptance:** all signature and legacy/v0/v1 tests pass using the locked SDK, zero skipped applicable tests; every mutated signer/message/identity rejected or returns zero candidates, never an economically eligible record.

### SEC-S2-03 — Critical / P0 economic — RPC finality forgery, ALT substitution and false inclusion

- **Affected:** OBS `fetchFinalizedTransaction`, `decodeFinalizedWire`, `verifyDepositCandidates`, `indexFinalizedRange`.
- **Preconditions:** colluding or compromised RPC endpoints, or one self-consistent fabricated provider. v0 ALT resolution depends on RPC-reported loaded addresses.
- **Reproduction evidence:** source confirms `getTransaction`/`getBlock` same-provider structural comparison, `commitment:'finalized'`, and cryptographic verification of signed message bytes. `meta.err`, CPI traces, token deltas and ALT expanded addresses remain RPC-provided assertions rather than proofs of validator consensus. The decoder checks loaded address counts and formats but does not independently replay historical ALT table state. Existing OBS test rejects contradictory block metadata and missing ALTs. New SEC probes model a completely fabricated self-consistent block, contradictory block, unavailable ALT resolution, swapped well-formed ALT keys, wrong vault metadata, failed transaction and unsupported version. **The new probes await integrated execution**.
- **Mitigation:** authenticate finalized block commitment against a reviewed trust model, pin executable/upgrade provenance, resolve ALT addresses against independently verified historical table account data, bind all instruction/CPI/token metadata to the same authenticated block/transaction, and use independent archival/fork retention.
- **Unknowns:** actual chain-finality attestations, historical ALT proofs and fault tolerance against correlated RPC compromise.
- **Acceptance:** an untrusted provider cannot produce economically releasable evidence even with fabricated consistent transaction and block; require independently authenticated source-chain inclusion/ALT resolution for any future credit gate. Current `creditEligible:false` must remain.

### SEC-S2-04 — Critical / P0 economic — refundable collateral is not sole backing

- **Affected:** SOL `refund`, Holochain issuance/withdrawal gate and solvency model.
- **Preconditions:** separately spendable Holochain claims issued before Solana depositor refund is irrevocably disabled.
- **Reproduction evidence:** source explicitly permits depositor refund while active or paused. Existing SEC pure models show `100 refundable + 100 spendable claims > 100 controlled collateral`. The localnet lifecycle previously demonstrated refunds, but no spendable Holochain credit was enabled.
- **Mitigation:** designed, audited irreversible/exclusive claim transition and reserve accounting across all pending settlements; independent source-chain confirmation.
- **Unknowns:** no implementation of nonrefundable collateral or deployed Unyt economic transition.
- **Acceptance:** signed real-source refund-after-credit negative test must reject, while every new issued, refundable, pending and paid liability remains solvent under the exact-unit conservation inequality. Until then **ZERO spendable issuance**.

### SEC-S2-05 — High / P1 — enhanced custody and restart evidence incomplete

- **Affected:** SOL PR #35 local-validator integration, restart harness, upgrade/mint authority analysis.
- **Preconditions:** competing depositors/nonces, partial refunds, maximum u64, state restart, unauthorized mint or upgrade operations.
- **Reproduction evidence:** CI run 43499386297 **passed earlier real localnet deposit/refund** using actual SBPF. Updated source introduces multiple depositor/concurrent deposits, racing duplicate nonce, partial refund, u64 maximum, negative transaction unchanged bytes, and upgrade authority observation. `restart-reconcile.test.mjs` and `restart-validator.sh` compare identical account bytes/genesis after a different local-validator process restarts on the retained ledger. **Those expanded cases have not passed integrated CI** because import fails before tests. Observing upgrade and mint authority is not restricting either.
- **Mitigation:** repair only SDK loader import in SOL lane, run each independent clean-ledger mode, archive real pre/post raw config/vault/receipts/source balances and ProgramData authorities, and review governance. Keep mint authority risk explicit.
- **Unknowns:** actual signatures/slots/meta.err of expanded tests, success of retained-ledger restart, power-loss behavior and source-chain forks.
- **Acceptance:** successful signed transactions with finalized `meta.err=null`, failed transactions with `meta.err != null` and unchanged raw state; exact `sum(active unrefunded receipts)==config.total_active<=vault.amount`; no nonce reuse; same genesis and byte-identical receipts after actual process restart; upgrade and mint authorities independently reviewed.

### SEC-S2-06 — High / P1 (economic escalation P0) — RAVE exact-number semantics unresolved

- **Affected:** published `rave_engine =0.15.0` `UnitMap::try_from`/`ReserveUnits::accepts`, JS/JSON/Rhai/MessagePack boundary.
- **Preconditions:** values above JS `Number.MAX_SAFE_INTEGER` or outside the published API's supported amount representation; JSON numbers converted to JS floating point.
- **Reproduction evidence:** **real published Rust harness** in run 43510726154 completed **7/8**; the assertion `accepts_shape({1:'-9007199254740993',0:'9007199254740993'})` was **false**. The current test collapses `UnitMap` conversion failure and `accepts` shape rejection, so this does NOT identify where rejection happened or prove rounding/truncation. SEC pure JS reference test `security/test/numeric-boundary-reference.test.mjs` demonstrates Number loses exactness for 9007199254740993 while canonical JSON decimal strings + BigInt roundtrip to u64 maximum. **Local Node 22.16.0, 4/4 reference tests passed, zero skipped.** Not a published RAVE or MessagePack execution.
- **Mitigation:** establish documented amount type/scale/range from pinned source; instrument separately conversion vs `ReserveUnits` refusal without weakening production checks; keep integer base units as canonical decimal strings, forbid unsafe JSON numeric inputs, test Rhai/MessagePack roundtrip at u64, i64, 2^53 and chosen precision limits.
- **Unknowns:** precise published UnitMap limit, parsing vs shape cause, whether RAVE supports those values at all; exact deployed agreement conversion behavior.
- **Acceptance:** Rust `--locked` boundary table with documented expected accept/reject and no truncation, discrepancy or fallback; error path explicit and no economic output emitted on unsupported inputs.

### SEC-S2-07 — Critical / P0 economic — partitioned journals and agreement/DNA migration replay

- **Affected:** `holochain/transaction-shadow.mjs`, RAVE reference models, future actual Unyt zomes and signer.
- **Preconditions:** two independent journals, replacement agreement, recovered prior commitment, DNA migration, fork, stale Parked status or crash between reservation and payout.
- **Reproduction evidence:** SEC S1 model tests demonstrate dual-journal and DNA-key counterexamples; RAVE shadow uses per-process in-memory Map, explicitly quarantines all receipts, and has no conductor/network consensus. The actual deployed Unyt DNA/integrity+coordinator source, matching WASM and multi-conductor zome execution have **not been independently verified**. No demonstrated double-spend in production.
- **Mitigation:** durable cross-history/global one-time identifier anchored to immutable Solana receipt identity, chain/program/scope/agreement domain, atomic pending-to-paid transition and irreversible burn/park finality; source-chain fork and Holochain network partition policy.
- **Unknowns:** deployed integrity/coordinator validation, lifecycle authority for Parked, replay in successor DNAs and multiple agreement histories.
- **Acceptance:** verified exact deployed DNA and actual two-conductor adversarial fork/partition, agreement replacement, migration, recovery and crash/restart tests; only a single claim/payout can survive conflicting paths. Keep P0 until actual deployed tests exist.

## Observed CI, evidence and reproducibility

- Frozen integrated source: `24b60e72` on integration PR #37.
- Observer failure: run `43510726021`, OBS job `132179960441` — **38 pass, 7 fail**; OBS branch subsequent fix is not this run's source.
- SOL source build/validator: run `43510726154`, job `132179958788` — **module import failure**, no attacker-first/concurrent/u64/restart execution.
- RAVE: same run, job `132179959342` — **7 pass, 1 failed** large-string acceptance assertion. It is a real failure, not a proved precision flaw.
- Historical Solana localnet: run `43499386297`, job `132140862502` — earlier compiled localnet lifecycle **passed**, not all current new scenarios.
- New independent SEC signed-wire suite **committed, not executed with Kit**; standalone security branch does not contain OBS PR #36. Its intentional skip is a CI-gate failure if included in a purported fully integrated release run.
- New SEC pure JS numeric reference suite: **4/4 PASS** in Node 22.16.0 local, no skips.

Required combined commands:

```sh
cd observer && npm ci && cd ..
node --test observer/test/*.test.mjs security/test/*.test.mjs
# Separately: actual compiled SOL ELF, isolated BRIDGE_TEST_MODE init-capture/u64-max,
# lifecycle and restart-validator.sh against a disposable validator.
bash tests/holochain/rave-engine/verify-crate.sh
cargo +1.95.0 test --locked --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets
# Real conductor/zome gate must remain BLOCKED until source-equivalent deployment is attested.
```

### Independent disposition

**Development-readiness:** source-level threat model and test harnesses can continue under draft PRs, but current enhanced suite is RED; no declaration of a green integration baseline.

**Economic-release approval:** **DENIED / P0 STOP SHIP**. Uncontrolled initialization, refundable collateral, unauthenticated finality, economic replay/recovery across actual deployed Unyt and unreviewed upgrade/mint authority remain open. A green CI build alone would not close these trust assumptions.
