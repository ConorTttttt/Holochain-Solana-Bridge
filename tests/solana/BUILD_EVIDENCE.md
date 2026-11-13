# Sprint 0 / Issue #7 — actual execution evidence (2026-11-13)

Branch: `agent/sol/7-anchor-build`. This is an **honest partial result**, not
completion of the SBPF build acceptance gate.

## Executed in the available sandbox

Environment checks and observed outputs:

```text
$ rustc -V
bash: rustc: command not found
$ cargo -V
bash: cargo: command not found
$ anchor --version
bash: anchor: command not found
$ solana --version
bash: solana: command not found
$ node --version
v22.16.0
$ npm --version
10.9.2
$ git --version
git version 2.47.3
$ git ls-remote https://github.com/ConorTttttt/Holochain-Solana-Bridge.git HEAD
fatal: unable to access 'https://github.com/ConorTttttt/Holochain-Solana-Bridge.git/':
Could not resolve host: github.com
```

GitHub source inspection and file edits used the linked GitHub connector, NOT
a successful git clone or local checkout.

```text
$ node --check /mnt/data/sol_sprint0/tests/solana/integration.test.mjs
(exit 0; syntax only; Node did not load test dependencies)
$ node --test /mnt/data/sol_sprint0/tests/solana/layout.test.mjs
TAP version 13
1..5
# tests 5
# pass 4
# fail 0
# skipped 1
```

The layout test above ran against a separately copied, source-matched
`observer/src/decode.mjs` in an isolated scratch directory. Its fifth check,
which reads the original Rust source, was explicitly **SKIPPED** because the
Rust file was not available as a checkout. Therefore this result verifies
offline fixture/decoder compatibility only; it does **not** independently
verify source, on-chain layout, or an actual generated IDL. The integration
test was syntax-checked but **NOT RUN**.

## NOT RUN / NOT VERIFIED

- `anchor build`, `cargo check`/Rust compilation, SBPF artifact: **NOT RUN**.
- `anchor keys sync` with an actual disposable program keypair: **NOT RUN**.
- Generated IDL at `target/idl/deposit_prototype.json`: **ABSENT/NOT VERIFIED**.
- `solana-test-validator` and `anchor test`: **NOT RUN**.
- On-chain initialization, deposits, refunds, failure tests, deploy/upgrade
  control, account layouts, PDA checks: **NOT EXECUTED**.
- No `Cargo.lock` or npm `package-lock.json` was generated; full
  dependency-graph reproducibility cannot yet be asserted.

## Source audit notes (not substitute for running Anchor)

- The Rust workspace already pins `anchor-lang = =1.2.2` and
  `anchor-spl = =1.2.2`; Anchor CLI 1.2.2 and Solana 4.1.2/platform-tools
  v1.57 are upstream-recommended. Host Rust 1.89.0 is pinned in this PR
  **without executing that compiler**.
- Source-derived sizes: BridgeConfig 114 bytes, DepositReceipt 218 bytes,
  including 8-byte Anchor discriminator. Refer to OBS handoff for offsets,
  seeds and derived discriminators. The observer expects those same sizes.
- Classic SPL `Token` program type is used rather than a Token-2022 interface;
  source/vault/destination have token mint/authority constraints.
- `total_active` uses checked u64 add/sub, the SPL transfers are
  `TransferChecked`, and a receipt PDA includes depositor + u64-LE nonce.
  These properties are **source inspection**, not a tested compiler/runtime
  guarantee.
- First-initialize front-running remains an acknowledged configuration
  capture risk: any first signer can initialize the unique config PDA.
  No deployment/public-operator authorization scheme was invented in Sprint
  0; require separate review before any public network.
- The allowed test mint's mint authority is not revoked; freeze authority
  is explicitly required to be absent. Do not infer fixed supply.
- The localnet program ID is a placeholder until `anchor keys sync`.
  No generated IDL is published or claimed verified.
- Refunds and `creditEligible: false` remain unchanged; Holochain issuance
  and production withdrawals are not added.

## Next verification gate for SOL / CI / OBS

On a host with Rust/AVM/Solana installed, run the exact localnet commands in
`tests/solana/README.md` and capture unabridged stdout/stderr, lockfiles,
built binary/IDL hashes, positive and negative test results, public program
address and localnet genesis. OBS must compare generated IDL and live
serialized accounts to `tests/solana/OBSERVER_HANDOFF.md` before declaring
its decoder verified. Independent SEC reviewer must inspect any change to
economic authority, custody or refund semantics.
