# S0 SOL: verified local-validator build and deposit/refund execution — 2026-11-13

**Status:** REAL SBPF COMPILATION + LOCALNET DEPLOYMENT + TRANSACTION TESTS **PASSED**.
This is **only** a disposable, isolated classic SPL Token development prototype. Deposits
remain refundable. No spendable Holochain credit, withdrawals, mainnet assets,
production governance or authenticated cross-chain finality is implemented.

## Unmodified Rust contract and exact source/runner

- PR: https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/35
- Successful GitHub Actions run: https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297
- Executed SOL branch commit: `bc4c907a4fc8e0ef5af073c06285ad248225f017`
- Public-only artifact bundle (binary, IDL, signatures, account bytes, logs):
  https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297/artifacts/14073462857
- Before running, the CI worker generated a disposable program keypair **under
  ignored `target/deploy`**, generated a wallet under ignored
  `target/localnet-secrets`, then ran `anchor keys sync`. Private material
  was never committed, printed or uploaded. The program's Rust deposit/refund
  implementation remains unchanged.

### Actual toolchains

```text
rustc 1.95.0 (59807616e 2026-04-14)
cargo 1.95.0 (f2d3ce0bd 2026-03-21)
solana-cli 4.1.2 (src:182084b8; feat:c763ae0a, client:Agave)
anchor-cli 1.2.2
Node.js v22.16.0
Anchor platform-tools v1.57, SBPF architecture v3
```

The last two versions were selected explicitly in the executed build command;
the Rust/CLI/Node stdout values are preserved in the workflow logs.

### Executed commands in the passing CI run

```sh
cargo check --workspace --all-targets
bash tests/solana/localnet-build.sh
# localnet-build.sh generates isolated keypairs and executes:
anchor keys sync
NO_DNA=1 anchor build --tools-version v1.57 --arch v3
npm --prefix tests/solana install --no-audit --no-fund
npm --prefix tests/solana test
NO_DNA=1 anchor test --skip-build --validator legacy --provider.cluster localnet --provider.wallet "$ANCHOR_WALLET"
```

A synchronized generated IDL, ELF/SBPF binary and live local-validator
deployment were produced. The script asserted the localnet public ID matched
the IDL's `address`, Rust `declare_id!` and `Anchor.toml` and refused the
repository's placeholder program ID.

```text
PASS: IDL, Rust source, Anchor.toml and localnet public program ID match
# Offline layout tests: 7 total; 6 pass, 0 fail, 1 skip
# Localnet integration: 6 pass, 0 fail, 0 skip (five nested lifecycle assertions)
LOCALNET BUILD AND TRANSACTION TESTS PASSED
```

**Only skip:** OBS PR #36's `isNative` decoder branch is not merged into the
SOL branch. Baseline v1 layout assertions ran; when the OBS-v2 marker file
`observer/src/pda.mjs` is present, the new `isNative` COption parsing and
noncanonical native-option test **must** run (not silently skip). CI must
re-run this combined check with the actual OBS branch before promotion.

### Public localnet identity and artifact hashes

- Localnet genesis `FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8`.
- Disposable program ID `FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG`.
- `target/deploy/deposit_prototype.so`: 221624 bytes, ELF64/eBPF,
  SHA-256 `ddbc9a56d1d7d2d0edc55153f099ed016dc6a26b30057b7bd8703c8ac7dd9dd5`.
- `target/idl/deposit_prototype.json`: SHA-256
  `a81ccda8b91e90d1522cc922bac88aecae71e872d4b22ead9196ccceaf9d41f9`.
- The account discriminators in the actual generated IDL are
  `BridgeConfig=28ce33e9f628b255` and `DepositReceipt=40af18b78a6d464e`.
- Source-derived/IDL-confirmed account sizes including discriminator:
  `BridgeConfig=114` and `DepositReceipt=218`.
- Classic SPL vault account size `165` bytes and mint size `82` bytes.
  Only the legacy SPL Token program is permitted.
- On a **fresh** run, generated public program ID and hashes will change.
  The above evidence is tied specifically to GitHub run 43499386297.

### Real on-chain positive and negative tests

The passing Node test invoked the actual deployed Anchor program and SPL token
program using `Connection('http://127.0.0.1:8899')`.

- Negative: initialize with a freeze-enabled mint and repeated initialize
  both fail without leaving a new config.
- Positive: initialize config PDA + mint-bound vault PDA; config is
  depositor/admin-bound and vault token owner/authority is the config PDA.
- Positive: deposit exactly 250000 base units and emit a nonce-keyed receipt,
  reconcile source/vault/aggregate totals.
- Negative: duplicate depositor+nonce, wrong depositor, incorrect SPL source
  owner, wrong mint, wrong refund destination/signature, non-admin pause,
  zero amount, zero recipient core, and max-u64 amount beyond funded balance
  all fail with no state mutation. Failed receipts remain absent.
- Positive: admin pause halts deposits but **does not prevent refunds**;
  one refund reduces liabilities and vault balance by 250000.
- Negative: second refund, nonce reuse after refund, and deposit while paused
  all fail; active balances remain coherent.
- Boundary: the maximum unsigned-u64 nonce `18446744073709551615` creates
  and refunds a separate 1-base-unit receipt; aggregate returns to zero.

### Actual account snapshots, byte-level reconciliation

Two public fixture files are in the CI artifact:
`target/localnet-evidence/active-receipt.json` and
`target/localnet-evidence/refunded-receipt.json`. Each includes localnet
genesis, public tx signature, finalized-slot RPC context and base64-encoded
receipt/config/vault/mint account data. **These are RPC state reports, not
independent consensus proof.**

| Public-field observation | Active receipt (slot 33) | Refunded receipt (slot 67) |
|---|---:|---:|
| DepositReceipt serialized length | 218 | 218 |
| Nonce (u64 LE at 200) | 42017 | 42017 |
| Amount (u64 LE at 208) | 250000 | 250000 |
| Refunded (u8 at 216) | 0 | 1 |
| BridgeConfig.total_active (u64 LE at 105) | 250000 | 0 |
| Vault SPL amount (u64 LE at 64) | 250000 | 0 |
| Vault isNative COption | 0 | 0 |
| Vault SPL state | 1 (initialized) | 1 (initialized) |

Independent offline byte-diff of exported public account bytes found the
receipt changed **only byte 216** and the mint's entire 82-byte account data
was identical at both snapshots. After refund, the receipt ID remains
consumed, and only the refunded flag changes. This snapshot is not a proof
of finality to Holochain; the economic credit gate remains disabled.

### Remaining non-M0 / production blockers

- OBS branch v2's actual `@solana/kit` PDA and `isNative` contract must be
  re-tested on a fully combined CI checkout; one conditional test remains
  intentionally skipped on this standalone SOL branch.
- The release must pin/commit reviewed `Cargo.lock` and npm lockfiles for
  fully reproducible transitive dependencies. The genuine CI Rust build run
  43496437684 archived generated `Cargo.lock`, but it was not committed.
- First-signer configuration initialization/front-running, upgrade authority,
  collateral source trust, transactional inclusion/rollback, network forks,
  and production signer/custody governance remain independent security gates.
- No production Holochain value or Solana withdrawal paths were enabled.
- Program ID is ephemeral and localnet-only. A new proof must be generated for
  a new keypair/compile/deployment; the signed keypair files are never shared.

**Review and merge remain human-controlled. Independent SEC review is required
for economic-state changes; this PR did not modify economic program logic.**
