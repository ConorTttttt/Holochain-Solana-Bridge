# RAVE 0.15.0: reproducible execution and shadow compatibility (Issue #9)

Date: 13 November 2026. This is S0 research evidence, **not production-DNA equivalence**. Credit issuance and withdrawal authorization remain disabled. Never use refundable Solana deposits as backing for Unyt credit.

## Published package provenance, verified facts and remaining archive gate

- Official crates.io index line for version `rave_engine =0.15.0`: `https://raw.githubusercontent.com/rust-lang/crates.io-index/master/ra/ve/rave_engine`; publication 2026-10-21T16:44:00Z, `yanked: false`.
- **Registry EXPECTED SHA-256** of `rave_engine-0.15.0.crate`:
  `7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde`.
- Published normalized manifest, independently inspected at `https://docs.rs/crate/rave_engine/0.15.0/source/Cargo.toml`: edition 2021; `hdi ^0.8.1`, `hdk ^0.7.1`, `zfuel ^0.9.1`, `rhai ^1.21.0`, `rmp-serde ^1.3.0`, exact `curve25519-dalek =4.1.3`; native `rlib` is built.
- The source and manifest were inspected via **published docs.rs package pages**. The original package archive was **not downloaded in the present local container**: `curl: (6) Could not resolve host: static.crates.io`. Do not claim the expected checksum has been compared to bytes downloaded locally.
- `tests/holochain/rave-engine/verify-crate.sh` fails closed unless an actual fetched .crate SHA-256 matches the registry checksum; it also extracts the manifest and checks the key dependency requirements. Its shell syntax passed `bash -n`; actual retrieval exits **6 (DNS)**. This is a runnable verification path on a network-enabled runner.
- A separate GitHub Actions integration snapshot **did download and compile** published `rave_engine v0.15.0` successfully under **rustc 1.95.0**; see run `43496911996`, job `132132289841` at `https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43496911996`. Compilation then failed on our *harness test*, **E0382 borrow of moved `amount`** at `src/lib.rs:32`, not in RAVE. PR #34 corrects the harness expression to `permitted(amount.clone())`. The corrected Rust tests have **not yet been run**. CI's ephemeral Cargo.lock is not committed on this RAVE branch, so no claim of fully frozen transitive dependencies.

### Commands with observed results

```text
local$ rustc --version
bash: rustc: command not found
local$ cargo test --manifest-path tests/holochain/rave-engine/Cargo.toml
bash: cargo: command not found                    # exit 127
local$ bash -n tests/holochain/rave-engine/verify-crate.sh
(no output)                                    # exit 0
local$ bash tests/holochain/rave-engine/verify-crate.sh
curl: (6) Could not resolve host: static.crates.io  # exit 6
local$ node --test tests/holochain/*.test.mjs
tests 19; pass 19; fail 0; skipped 0           # exit 0; Node v22.16.0
CI run 43496911996 (earlier integration overlay):
rustc 1.95.0; Compiling rave_engine v0.15.0 (success);
error[E0382]: borrow of moved value amount (harness); exit 101
```

The original 14 offline tests continue passing, with 5 additional tests (three schema/consistency checks and two executable CLI tests). No credit issuance is enabled.

### Run on a Rust/network-enabled developer or CI host

```sh
bash tests/holochain/rave-engine/verify-crate.sh
cd tests/holochain/rave-engine
rustup toolchain install 1.95.0 --profile minimal
cargo +1.95.0 test --all-targets
# Capture: rustc --version, cargo --version, Cargo.lock and SHA-256, stdout/stderr and exit codes.
```

The harness has its own `[workspace]` and is deliberately isolated from the Anchor workspace; do not silently replace `rave_engine = "=0.15.0"` or suppress test failures. One pair of tests directly calls `ReserveUnits::accepts`. Two new smoke tests call the actual exported `rave_engine::prelude::RhaiEngine::execute` with MessagePack-encoded pure Rhai source. One further test uses published `ParkedLinkStanding` status variants. **These newly added Rust executor/status tests are awaiting actual compilation/execution.**

## Published code and economic interfaces (source map)

- `src/lib.rs`: `prelude` reexports the Rhai executor; `src/rhai_engine/mod.rs`: `RhaiEngine::execute(input: &Value, code: Vec<u8>, preset_variables: Option<PresetVariables>) -> ExternResult<RhaiEngineOutput>`. The code argument is a **MessagePack-encoded Rust String**. The executor registers exact-fuel helpers, host functions such as `get_commitment`, `find_run_citing`, `find_accept_or_reject_before_close` and limits operations, string/collection sizes and nesting. Native pure Rhai execution is *not* zome integration.
- `src/reserve.rs`: `ReserveUnits { debit_unit_index, credit_unit_index }.accepts(UnitMap)` permits exactly two units, strictly negative debit and equal/opposite positive credit. This validates an amount *shape*, not settled Solana escrow.
- `src/types/entries/commitment.rs`, `receipt.rs`, `accept.rs`, `reject.rs`, `reclaim.rs`: economic transaction representation and lifecycle, but not independent source-chain consensus; see `src/types/ledger/mod.rs` and `state/` for ledger, fees, reservations, and transitions. Published ledger tests explicitly check reclaim fee retention; these are not bridge solvency proofs.
- `src/types/entries/rave/parked_link/mod.rs`: `ParkedLinkStanding` has `Parked(Box<Transaction>)`, `Unparked`, `NotAParkedLink` and `NotHeld`. The type's `ParkedLink::from_action` / `from_link` conversion interprets link action fields. **The type alone cannot establish authoritative standing under forks, partitions or divergent DHT views**. The authoritative standing query path and delete/validation semantics belong to the exact network coordinator/integrity zomes; source and deployed version are not verified.
- Published public Unyt agreement library `__system_credit_limit_adjustment/execution_code.rhai` calls `find_run_citing(agreement, previous.id, commitment.id)` as an agreement/history-local reserve duplication check. `__system_unit_recovery/execution_code.rhai` remembers recovered commitments in `previous_execution.output.carryover.recovered`; its comments describe once-per-agreement replay checking, not a global durable cross-migration ledger. **These are P0 review hypotheses, not confirmed production exploits**.
- Public HOT bridge `unytco/raindex-orders/bridge-orchestrator/src/signer/service/checks.rs` independently checks `standing(withdrawal)`, matching agreement/executor, amount/recipient, nonces and signed-order history. This is useful architecture evidence, not validation of a new Solana withdrawal signer.

Published 0.15.0 source links:
- `https://docs.rs/crate/rave_engine/0.15.0/source/src/reserve.rs`
- `https://docs.rs/crate/rave_engine/0.15.0/source/src/rhai_engine/mod.rs`
- `https://docs.rs/crate/rave_engine/0.15.0/source/src/types/entries/rave/parked_link/mod.rs`
- `https://docs.rs/crate/rave_engine/0.15.0/source/src/types/ledger/mod.rs`

## Observer PR #36 evidence contract and executable shadow reader

OBS PR #36 remains an independent unmerged branch. It adds to schema `solana-receipt-observation-v1`: four independent account digest strings (receipt/config/vault/mint); `mintSupplyBaseUnits`, `activeVaultBaseUnits`, `activeLiabilitiesBaseUnits`; `configBump` and `receiptBump`; `commitmentRequested: 'finalized'`; `transactionVerified: false`; and `evidenceTrust: 'untrusted_rpc_snapshot'`. Four accounts (receipt/config/vault/mint) are read, canonical PDA constraints are claimed, but no creating transaction or independent finality proof exists yet.

`holochain/shadow-review.mjs` now **requires** these fields, checks exact string decimal u64 amounts, the explicit trust denial fields and digests, rejects same-slot contradictory config/vault/mint bytes, mismatched target bindings, stale/refund-rollback observations and cross-DNA/agreement/epoch identity reuse **inside one in-memory journal**. Later-slot changes to vault/config/mint are allowed as merely observational drift. Every output always has `creditEligible: false`, `spendableBaseUnits: "0"`, `withdrawalAuthorized: false`. Even a `quarantined` verdict does **not** validate source correctness, replay uniqueness or economic settlement.

Run a single **read-only** CLI invocation with an OBS JSON object on standard input and an independently supplied target-binding JSON file (`genesisHash, program, mint, holochainScope, dnaHash, agreementHash, deploymentEpoch`):

```sh
node holochain/shadow-cli.mjs /path/to/target-binding.json < /path/to/observer-output.json
# prints a non-economic JSON diagnostic
# exit 0 = quarantined observation only; exit 2 = invalid/rejected
node --test tests/holochain/*.test.mjs
```

No conductor, RAVE agreement, economic proof or Holochain value issue API is contacted. **The CLI creates a fresh in-memory Map on every invocation.** It cannot detect replay across processes, crashes or competing nodes, and must never be represented as a real anti-double-spend registry.

## Exact outstanding production-DNA gate

No exact deployed Unyt DNA and integrity/coordinator WASM build hashes, source commit, validation callbacks, zome orders, `ParkedLinkStanding` coordinator host implementation, or conductor test cluster were available and verified. Consequently no test here establishes all of:

1. fork/partition consistency of two apparently valid commitment histories and parked status;
2. validated ledger conservation on real RAVE transaction receipts across DNA/agent forks;
3. global uniqueness of recovered commitments after agreement replacement, new recovery agent or migration epoch;
4. crash-consistent agreement execution, DHT publication and external payout with replays;
5. independent Solana transaction finality, nonrefundable custody or any redeemable collateral obligation;
6. deterministic match between the published `0.15.0` package, the deployed Unyt DNA and smart-agreement bytecode.

**Stop:** no spendable Holochain value, Holochain balance adjustments or actual Solana withdrawal authorization. The old `holochain/evidence-gate.mjs` is unchanged. OBS/SEC/CI must independently verify the remaining gates, and the project maintainer must approve any economic boundary change.
