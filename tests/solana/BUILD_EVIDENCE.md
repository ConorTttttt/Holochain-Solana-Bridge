# Sprint 0 / Issue #7 — actual Anchor SBPF and localnet evidence

**Status:** Genuine compile, disposable-localnet deployment and deposit/refund
lifecycle **PASSED** in GitHub Actions run
[43499386297](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297)
at 2026-11-13 20:23 UTC, using branch head
`bc4c907a4fc8e0ef5af073c06285ad248225f017`. This establishes a
**localnet-only** executable prototype, not a production bridge or
cross-chain economic-finality guarantee.

## Real execution and exact toolchain

Workflow: `.github/workflows/sol-verify-temporary.yml` (SOL-owned temporary
test runner; CI owns the permanent workflow).
No JavaScript simulation is cited as validator evidence.

- Ubuntu 24.04 GitHub Actions runner; Node `22.16.0`, npm `10.9.2`.
- Host Rust `rustc 1.95.0`, Cargo `1.95.0`; required because locked Anchor
  CLI's `solana-sbpf 0.23.0` uses `Layout::dangling_ptr` and
  `cargo-platform 0.3.3` requires a newer Rust than 1.89.
- Anchor CLI `1.2.2` installed from pinned upstream tag, Solana CLI
  `4.1.2`, SBPF platform-tools `v1.57`, `--arch v3`.
- `cargo check --workspace --all-targets` — **PASS**.
- Create fresh disposable program and payer keypairs **only under ignored
  `target/`**; `anchor keys sync` — **PASS**.
- `NO_DNA=1 anchor build --tools-version v1.57 --arch v3` — **PASS**.
  Nonempty compiled SBPF binary verified as actual eBPF ELF (machine 247),
  and generated IDL matched the ephemeral source/program keypair ID.
- `npm --prefix tests/solana install --no-audit --no-fund` — **PASS**.
- `npm --prefix tests/solana test` — **6 passed, 0 failed, 1 skipped**;
  the skip is OBS PR #36's `isNative` decoder test because its code is
  still separate from SOL's `main`-based PR.
- `NO_DNA=1 anchor test --skip-build --validator legacy` — **PASS**:
  actual test-validator starts and deploys the built executable; the
  deposit/refund localnet suite reports **6 passed, 0 failed, 0 skipped**,
  including mint freeze rejection, config init, deposit, adversarial
  failures, admin pausing, one refund, replay rejection and u64-max nonce.
- End-of-script marker: `LOCALNET BUILD AND TRANSACTION TESTS PASSED`.

[Download the archived public-only CI artifacts](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297/artifacts/14073462857).
The artifact includes unabridged `cargo-check.log`, `localnet-build.log`,
`versions.log`, the generated IDL, ELF binary, public program ID and the
active/refunded **real validator account-byte snapshots**. No signing keys,
wallet material or local-validator ledger are uploaded. SHA-256 of the ZIP
archive as reported by GitHub Actions is
`24179fbd628de82fe0ced5b3df421cb1e81a3e03d4f94adaf84c5cdb2766de8d`.

## Exact successful-run public artifacts

| Item | Value |
|---|---|
| Disposable localnet program ID | `FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG` |
| Generated `idl/deposit_prototype.json` | 13,002 bytes, SHA-256 `a81ccda8b91e90d1522cc922bac88aecae71e872d4b22ead9196ccceaf9d41f9` |
| Compiled `deploy/deposit_prototype.so` | 221,624 bytes, SHA-256 `ddbc9a56d1d7d2d0edc55153f099ed016dc6a26b30057b7bd8703c8ac7dd9dd5` |
| Validator genesis hash | `FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8` |
| Active snapshot | slot 33, `localnet-evidence/active-receipt.json` |
| Refunded snapshot | slot 67, `localnet-evidence/refunded-receipt.json` |

These hashes are specific to the **one disposable CI run**. Re-running
`anchor keys sync` creates another public program ID and typically new hashes.
Neither private program key nor developer wallet keypair was published.

## On-chain Borsh / PDA / custody evidence

The IDL discriminator and field-order checks passed against the generated
IDL. The archived accounts additionally contain exact sizes and serialized
bytes:

| Account | Public address | Size | Actual recorded values |
|---|---|---:|---|
| BridgeConfig | `8cgyh99E7fmUyAFshwss8ZQZacpxWTyCm1ApFJFC7999` | 114 | config PDA bump 255; active `total_active=250000, paused=false`; after refund `total_active=0, paused=true` |
| DepositReceipt | `BdR4H8M6pYafRkmEM57ydhH4yGKw2q1KokyvUkxLZ2VH` | 218 | receipt PDA bump 248; nonce 42017; amount 250000; refunded false → true |
| SPL vault | `FsTLDdsAHYtbFCRXk1Px6mi47t1tYQadF42qQP5DWebT` | 165 | vault PDA bump 254; SPL token authority = config PDA; amount 250000 → 0; no native/delegate/close authority |
| Allowed SPL mint | `7t6r6MTjf6RBMoLtkPmEpK9RkG3fdw28JoimYP61hKy9` | 82 | classic SPL Token mint, no freeze authority |

Both BridgeConfig and DepositReceipt are owned by the deployed program;
the vault and mint are owned by the classic SPL Token program. Using the
fixture's actual program ID and recorded depositor/mint/nonce bytes, the
canonical `SHA256(seeds || bump || programID || "ProgramDerivedAddress")`
derivation independently reproduced all three addresses and bumps (config
255, vault 254, receipt 248). These are **actual localnet RPC fixtures**,
not arbitrary hand-filled Borsh fixtures.

Relevant on-chain transaction signatures are recorded in both JSON snapshots.
The snapshots use a *single local RPC* with `finalized` commitment and are
**not independent consensus proofs**.

## Continued hardening (newer than the passing run)

The subsequent SOL test-only commit
`32c17fb8bc604edf345d294501299f9e0479eb36` adds cross-checks of live
validator bytes against the Observer decoder, byte-for-byte account-state
rollback assertions after rejected transactions, wrong-vault substitution,
two simultaneously active receipts, and partial-refund conservation. Its
**new tests are pending their own Actions run**; the successful run above
must not be misrepresented as execution of those additional assertions.

## Outstanding security / reproducibility gates

- Full OBS PR #36 integrated native COption / verified-IDL handoff remains
  separate; pending cross-branch integration workflow, not the completed
  localnet run.
- Cargo and npm dependency lockfiles were resolved ephemerally but not
  human-reviewed/committed; **byte-for-byte reproducibility is open**.
- Validator race/crash tests, program-upgrade governance, independently
  authenticated Solana finality, trustless custody and Holochain economic
  safety have **not** been demonstrated.
- First-initialize config capture remains a public-deployment risk.
- Refunds remain enabled; Holochain `creditEligible: false` remains mandatory.
  No public network deployment, real-value deposit, issuance or withdrawal
  authorization is permitted by this localnet result.
