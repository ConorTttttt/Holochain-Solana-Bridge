# SOL Sprint 0: strictly localnet build and test runner

This folder is intentionally localnet-only. Never direct it at devnet/mainnet,
use real tokens, enable Holochain credit, or commit wallet/program keypairs.

## Proposed pinned toolchain (NOT independently build-verified)

- Host Rust `1.89.0` from `rust-toolchain.toml` (IDL builds may use a
  separate nightly selected by Anchor/AVM).
- Anchor CLI, `anchor-lang`, `anchor-spl` = `1.2.2`.
- Solana CLI `=4.1.2` from `Anchor.toml`.
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

From the repository root, work on the feature branch. The commands below
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

## Expected assertions (all validator cases currently NOT RUN)

Positive: initialize, PDA bumps/authority, deposit exact base units,
receipt/balance/total_active reconciliation, pause, refund while paused.

Negative: freeze-enabled mint at initialization, repeated initialize,
duplicate nonce, wrong depositor, wrong source token owner, wrong mint,
wrong refund destination, non-admin pause, deposit while paused, double
refund and reusing a nonce after refund. Failed transfers must roll back.

**Remaining work:** run `anchor build` and actual validator tests; capture
the exact logs/version stdout; pin generated `Cargo.lock` and
`tests/solana/package-lock.json` after dependency resolution; compare
generated IDL with `OBSERVER_HANDOFF.md`; independently review first-init
front-running, unrestricted mint authority for disposable test tokens, and
upgrade authority. The tests do not yet cover concurrent receipt creation,
restarts, fork/rollback, or full validator failure recovery.
