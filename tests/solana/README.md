# SOL Sprint 0: strictly localnet build and test runner

This folder is intentionally localnet-only. Never direct it at devnet/mainnet,
use real tokens, enable Holochain credit, or commit wallet/program keypairs.

**Verified:** real Rust/SBPF compilation, generated localnet IDL, legacy
`solana-test-validator` deployment and deposit/refund/negative tests **PASSED**
in CI run [43499386297](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297).
Exact binary/IDL hashes, account bytes, public signatures and outstanding risks:
[`VERIFIED_LOCALNET.md`](VERIFIED_LOCALNET.md).

**Sprint 1 continuation (not yet CI-verified):** `integration.test.mjs` now
includes actual `getTransaction().meta.err` verification with
`skipPreflight: true`, two depositor wallets, concurrent nonce attempts,
partial refunds, failed SPL CPI atomic rollback, token-program and authority
substitution, and loader/upgrade-authority inspection. The runner executes
three isolated fresh-validator modes: `lifecycle`, `init-capture` and
`u64-max`. The attack test deliberately demonstrates that the *first
initializer can seize the administrator, mint and Holochain scope*. Read
[`SPRINT1_SECURITY_ASSESSMENT.md`](SPRINT1_SECURITY_ASSESSMENT.md) before
interpreting test results. **These new tests have not yet been shown to pass
in GitHub Actions; the historic pass below applies only to its exact
older SHA.**

## Verified localnet toolchain (transitive lockfiles still pending)

- Host Rust `1.95.0` from `rust-toolchain.toml` (IDL builds may use a
  separate nightly selected by Anchor/AVM). Rust 1.91 fails installing Anchor CLI 1.2.2
  because `solana-sbpf 0.23.0` invokes `Layout::dangling_ptr`, stable in 1.95.
- Anchor CLI, `anchor-lang`, `anchor-spl` = `1.2.2`.
- Solana CLI `4.1.2` from `Anchor.toml`.
- Recommended Solana platform-tools `v1.57`, SBPF architecture `v3`.
- Node.js >=20.18, dependencies at exact versions in this directory's
  `package.json` (a lockfile is not yet available; do not claim a fully
  reproducible dependency tree).

Official upstream compatibility reference:
https://www.anchor-lang.com/docs/updates/release-notes/1-2-2

## Build on a fresh isolated development host

First install Rust via rustup, Solana 4.1.2, and Anchor 1.2.2 via AVM
(see upstream install instructions). Verify versions with actual commands:

```sh
rustc -V
cargo -V
solana --version
anchor --version
avm solana resolve
avm platform-tools resolve
```

**Preferred fully exercised command**, from a fresh isolated checkout with the
pinned tools installed:

```sh
bash tests/solana/localnet-build.sh
```

The script refuses pre-existing program/payer keypairs, generates disposable
local signing material in ignored `target/`, syncs public program IDs,
compiles the SBPF ELF/IDL, hashes both, installs Node dependencies and runs
both the offline layout check and **real** `anchor test --validator legacy`
on a fresh local validator. It fails if any required command or test fails.

Manual commands below are a reference only and must retain localnet
restrictions. Work on the feature branch. The commands below
generate disposable *local* private material outside version control and must
not print key material to build logs:

```sh
umask 077
mkdir -p target/deploy
test ! -e target/deploy/deposit_prototype-keypair.json
solana-keygen new --no-bip39-passphrase \
  -o target/deploy/deposit_prototype-keypair.json >/dev/null 2>&1
anchor keys sync
solana config set --url localhost
anchor build
# Inspect target/idl/deposit_prototype.json and target/deploy/deposit_prototype.so.
# Record SHA-256 of compiled artifact and generated IDL, never private keys.
sha256sum target/deploy/deposit_prototype.so target/idl/deposit_prototype.json
```

The placeholder ID on main is not a deployed program ID. The key sync edits
`declare_id!` and `Anchor.toml` *locally*. Share the synchronized **public**
program ID with OBS; never commit the private key. Do not deploy to a public
cluster. For a local validator, `Anchor.toml` already sets Localnet:

```sh
cd tests/solana
npm install
npm test                    # offline observer/layout checks
cd ../..
anchor test                 # starts fresh local validator, builds, deploys,
                            # then runs npm run test:integration
```

The integration test refuses the placeholder program ID, checks that the
program is executable and config is absent on a fresh ledger, and connects
**only** to `http://127.0.0.1:8899`. If the validator is not available,
the test must fail rather than simulate a pass. No genesis hash alone proves
localhost; run in a network-isolated local-validator environment.

Alternatively start `solana-test-validator --reset` in another terminal,
then use `anchor deploy --provider.cluster localnet` and
`cd tests/solana && npm run test:integration`. Do not run the test after
a previously initialized ledger. Test keypairs are generated in RAM and funded
with local-validator airdrops; the mint has **no freeze authority** and is
a disposable classic SPL token.

## Actual executed validator assertions (run 43499386297: PASS)

Positive: initialize, PDA bumps/authority, deposit exact base units,
receipt/balance/total_active reconciliation, pause, refund while paused.

Negative: freeze-enabled mint at initialization, repeated initialize,
duplicate nonce, wrong depositor, wrong source token owner, wrong mint,
wrong refund destination, non-admin pause, deposit while paused, double
refund and reusing a nonce after refund. Failed transfers must roll back.

**Remaining work:** pin reviewed generated `Cargo.lock` and
`tests/solana/package-lock.json` after dependency resolution; run OBS
PR #36's v2 actual SDK/`isNative` decoder against the real binary/IDL and
recorded account bytes in combined CI; independently review first-init
front-running, unrestricted mint authority for disposable test tokens, and
upgrade authority. Existing **historically passing** tests do not cover simultaneous receipt
creation; that scenario is now implemented but awaits a new CI execution.
Ledger-preserving validator restarts, forks, full validator failure recovery
and production collateral/credit issuance remain unverified (issuance is
intentionally disabled).
