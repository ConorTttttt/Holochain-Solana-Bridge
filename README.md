# Solana → Holochain bridge: audit-only research baseline

> **Status (consolidation, 2026-11-20): AUDIT-ONLY PROOF OF CONCEPT. Not a bridge. Not audited. Not production-ready.**
> Localnet and disposable classic-SPL tokens only. There is no Holochain credit, no settlement, no Solana withdrawal, no redemption and no mainnet asset. **No Holochain installation or signed audit write is authorized.**
> Every observation carries `creditEligible: false`, `independentConsensusVerified: false`, `spendableBaseUnits: "0"`, `withdrawalAuthorized: false`.

This repository records **what a Solana deposit looked like to an RPC observer**, and proves that the evidence can be bound to an exact build of an audit-only Holochain DNA. It deliberately stops there:

- A refundable Solana deposit is **not** collateral.
- A finalized RPC observation is **not** independent economic consensus.
- A successful Holochain write, if one were ever authorized, would **not** prove settled Solana collateral.

Consolidation records are in [`docs/consolidation/`](docs/consolidation/):

| Document | Contents |
|---|---|
| [Integration report](docs/consolidation/INTEGRATION_REPORT.md) | what was merged, how conflicts were resolved |
| [Test results](docs/consolidation/TEST_RESULTS.md) | exact SHA, commands, counts, Actions run IDs |
| [Demo readiness](docs/consolidation/DEMO_READINESS.md) | build readiness vs. authorized runtime readiness |
| [Source provenance](docs/consolidation/SOURCE_PROVENANCE.md) | source of truth per subsystem, blob hashes |
| [PR inventory](docs/consolidation/PR_INVENTORY.md), [Branch inventory](docs/consolidation/BRANCH_INVENTORY.md), [PR disposition](docs/consolidation/PR_DISPOSITION.md) | every PR and branch, what happens to each |
| [Mainline maintenance](docs/consolidation/MAINLINE_MAINTENANCE.md) | how to keep `main` the single baseline |

## Architecture

```
 SOL  Anchor 1.2.2 program (programs/deposit_prototype)        disposable localnet validator, classic SPL, one mint
      config PDA ["config"] · vault PDA ["vault", mint] · receipt PDA ["deposit", depositor, nonce_le]
      deposit(nonce, recipient_core, amount) / refund()  →  signed legacy transactions, finalized blocks, 4-account snapshots
                │
 OBS  observer/  (Node >=20, CI 22.16.0; @solana/kit 8.6.0 SDK-backed)
      finalized getMultipleAccounts snapshot · receipt/PDA re-derivation · Ed25519 signed-wire verification
      exact u64 BigInt arithmetic · durable single-writer ledger · indexer · replay / corruption / source-substitution refusals
      Kit v2 reviewed witness (nested denials, UTF-8 bounds) → durable outbox: state "pending", explicit NO-ACK
                │   (untrusted evidence; transport to Holochain NOT authorized)
 RAVE holochain/
      evidence-gate.mjs: issueHolochainCredit / authorizeSolanaWithdrawal ALWAYS THROW
      shadow-review / transaction-shadow: quarantine-only intake, four literal denials
      demo/: audit-only DNA (integrity + coordinator zomes, HDK 0.7.1 / HDI 0.8.1) + native HAM adapter
             dna.yaml properties are written per run from THAT run's Solana evidence (demo/a0-bind-same-run-dna.mjs)
                │
 CI   .github/workflows/integration-snapshot.yml: ONE run at ONE SHA
      Solana lifecycle → Observer → locked native HAM + WASM build → source-bound DNA/hApp pack → hashes
      ── install / genesis / Lair / capability grant / zome call steps are `if: ${{ false }}` ──
                │
 AUTH demo/installation + scripts/installation: prepares an exact installation REQUEST,
      verifies independently signed one-use grants (tests use synthetic keys only). No authority exists in this repo.
```

## Current state

Status vocabulary: COMPLETED · TESTED (at the consolidation SHA) · REVIEW PENDING · AUTHORIZED · BLOCKED · NOT IMPLEMENTED. Details are in [DEMO_READINESS.md](docs/consolidation/DEMO_READINESS.md).

| Area | Status |
|---|---|
| Solana program, validator lifecycle, adversarial negatives | COMPLETED · TESTED · REVIEW PENDING |
| Original signed PR55 Solana evidence (exact ZIP) | COMPLETED · TESTED (offline re-verification) |
| Observer verification, ledger, indexer, v2 witness | COMPLETED · TESTED · REVIEW PENDING (v2 ABI not frozen) |
| RAVE shadow reviewer | COMPLETED · TESTED |
| Native HAM + WASM compilation, source-bound DNA/hApp packaging | COMPLETED · TESTED in same-run CI (see TEST_RESULTS.md) |
| Installation request preparation / grant verification | COMPLETED · TESTED (synthetic keys) · **not AUTHORIZED** |
| DNA installation, signed audit write, v2 transport | **BLOCKED** |
| Deployment-epoch identity, complete slot history | **BLOCKED / HOLD** |
| Credit, settlement, withdrawal, redemption, mainnet | **NOT IMPLEMENTED · BLOCKED** (Gate C NO-GO) |

## Development setup

Pinned toolchain: Rust **1.95.0** (`rust-toolchain.toml`), Node **22.16.0**, Solana/Agave **4.1.2**, Anchor **1.2.2**, platform-tools **v1.57** (`scripts/ci/toolchain.env`), Holochain **0.7.1** via Holonix `a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da`, HAM `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`. Lockfiles are committed and their reviewed SHA-256 values are enforced in CI ([MAINLINE_MAINTENANCE.md §6](docs/consolidation/MAINLINE_MAINTENANCE.md)).

### Offline suites (Node only)

```bash
npm --prefix observer ci && npm --prefix observer test && npm --prefix observer run check
```

```bash
npm --prefix tests/solana ci
```

```bash
node scripts/ci/run-cross-lane-tests.mjs
```

```bash
node --test demo/installation/*.test.mjs demo/a0-mutation-boundary.test.mjs demo/a0-runtime-gate.test.mjs
```

```bash
node scripts/ci/verify-integration-provenance.mjs
```

```bash
node scripts/ci/guard.mjs
```

`run-cross-lane-tests.mjs` runs in *integrated* mode and fails on **any** skip. Locally, one `sol-layout` subtest skips until a real `anchor build` has produced `target/idl/deposit_prototype.json`, so the local exit code is 1. In CI the IDL comes from the real Anchor job and the suite must pass with zero skips.

### Localnet (disposable only)

The authoritative procedure is the SOL-owned script that CI runs: [`tests/solana/localnet-build.sh`](tests/solana/localnet-build.sh). It covers the build, a disposable program key, deploy, four isolated `anchor test` modes, signed-witness and tamper verifiers, and a restart/reconcile check. See [`tests/solana/README.md`](tests/solana/README.md) and [`tests/solana/VERIFIED_LOCALNET.md`](tests/solana/VERIFIED_LOCALNET.md). Never point any of it at devnet, testnet or mainnet. Never commit keypairs. [`docs/LOCALNET.md`](docs/LOCALNET.md) is the original manual guide, kept for history.

### Holochain build (compile and package only)

See [`holochain/demo/README.md`](holochain/demo/README.md) and [`holochain/demo/build.sh`](holochain/demo/build.sh). Inside the pinned Holonix shell it requires rustc/cargo 1.95.0, verifies both locks, then runs `cargo build --locked` for the native HAM and the two WASMs and `hc dna pack` / `hc app pack`. Building is not approval. **Do not install the bundle**: installation needs an independently authorized exact request ([`demo/installation/RUNBOOK.md`](demo/installation/RUNBOOK.md)).

### Observer evidence

[`observer/docs/`](observer/docs/) covers transaction evidence v1, signed-wire replay, the reviewed witness v2 and the v2 ABI freeze candidate. Read-only CLI against **your own localnet**:

```bash
node observer/src/cli.mjs --rpc http://127.0.0.1:8899 --genesis <LOCALNET_GENESIS_HASH> \
  --program <PROGRAM_ID> --receipt <RECEIPT_PDA> --config <CONFIG_PDA> --vault <VAULT_PDA> \
  --mint <DISPOSABLE_MINT> --scope <64_HEX_HOLOCHAIN_SCOPE>
```

Two RPC endpoints are not a light client, and RPC output is never permission to mint.

## Integration CI

| Workflow | Runs on PRs into `main` | Purpose |
|---|---|---|
| `ci.yml` "Sprint 0 CI (fail-closed)" | always | observer, lockfiles, secret guard, cross-lane offline suites, Anchor host+SBF compile, validator smoke, preserved PR55 evidence |
| `integration-snapshot.yml` | always | the same-run pipeline (4 jobs). Install steps hard-disabled |
| `a0-own-dna-runtime.yml` | always | A0 static readiness (passes) + build gate that **intentionally fails** with `BLOCKED_NOT_ACCEPTED` until authorization exists |
| `a0-dependency-bootstrap.yml` | `holochain/demo/**` changes | lock-preservation review proposal |
| `installation-preparation.yml` | installation paths | re-verifies the ORIGINAL #66 artifacts; prepares an unapproved request; synthetic authorization refusals |
| `rave-unyt-release.yml` | dispatch / historical branches only | third-party Unyt release proof. Contains a disposable conductor-install job; **not run by the consolidation** |

A red A0 build gate is the expected, honest state. Do not "fix" it by weakening the gate.

## Security status and gates

- [`docs/SECURITY_GATES.md`](docs/SECURITY_GATES.md)
- [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md)
- [`security/evidence/`](security/evidence/): independent SEC reviews
- Gate A0: BLOCKED
- B1 / B2: BLOCKED
- C (economics): NO-GO

Outstanding independent reviews and open items are listed in the consolidation PR and in [INTEGRATION_REPORT.md §3–4](docs/consolidation/INTEGRATION_REPORT.md).

## Contributing (agents and humans)

- Follow [`AGENTS.md`](AGENTS.md) (immutable rules, lanes) and [MAINLINE_MAINTENANCE.md](docs/consolidation/MAINLINE_MAINTENANCE.md).
- Branch from **current `main`** and open PRs **into `main`**. Keep shared and same-run CI green at your PR head. Update `ci-integration-snapshot.json` provenance in the same PR when you change a pinned file.
- Never weaken a security gate, never cite an older run as current evidence, and never enable credit, withdrawals or mainnet.
- Planning documents are [`docs/SPRINTS.md`](docs/SPRINTS.md) and [`docs/START_AGENTS.md`](docs/START_AGENTS.md); their status lines describe the plan as written on 13–14 November.

## Code map

```
programs/deposit_prototype/   Anchor program (SOL)
tests/solana/                 validator lifecycle, witness/tamper verifiers, PR55 verifier, archive producer (SOL)
observer/                     verification, ledger, indexer, v2 witness/outbox (OBS)
holochain/                    evidence gate, shadow reviewer (RAVE); holochain/demo audit DNA + HAM adapter
tests/holochain/              RAVE suites, rave-engine host harness, sandbox inspection scripts
security/                     threat model, adversarial tests, independent evidence (SEC)
demo/                         same-run binding, A0 gate, preauthorization runner; demo/installation request/grant tooling
scripts/ci/, .github/         CI (provenance verifier, cross-lane runner, guard, workflows)
docs/                         sprints, gates, ADRs, consolidation records
```

## Design references

- [Anchor token transfer checked](https://www.anchor-lang.com/docs/tokens/basics/transfer-tokens)
- [Solana versioned transactions](https://solana.com/docs/core/transactions/versioned-transactions)
- [Solana token and authority semantics](https://solana.com/docs/tokens)
- [Unyt RAVE crate 0.15.0](https://crates.io/crates/rave_engine/0.15.0)
- [Unyt HOT bridge orchestration](https://github.com/unytco/raindex-orders)

Do not port HOT Raindex/EVM authorization code to Solana. Nothing here claims Raindex runs on Solana.
