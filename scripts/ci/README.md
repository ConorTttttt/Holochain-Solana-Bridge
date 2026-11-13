# Sprint 0 CI: exact commands, dependency provenance, and gates

Scope: Issue #11 / draft PR #32. **Localnet, disposable test keys/tokens only.** Do not deploy to a public network, create Holochain credit, enable production withdrawals, or upload private keys. Consult `AGENTS.md`, `docs/SPRINTS.md` and `docs/SECURITY_GATES.md`.

## Toolchain and provenance

`scripts/ci/toolchain.env` pins Node 22.16.0, **host Rust 1.95.0**, Anchor CLI/program crates 1.2.2, Solana/Agave CLI 4.1.2, platform-tools v1.57 and SBPF architecture v3. The separate SBPF compiler comes from platform-tools, **not** host rustup. Official third-party Actions are pinned to specific immutable commit SHAs. Anchor CLI installs with `cargo install --git https://github.com/otter-sec/anchor --tag v1.2.2 anchor-cli --locked`; the annotated upstream tag resolves to commit `8d9d1488d9b8af41b266d7513eea2e668adf15a2`. The upstream CLI `Cargo.lock` blob SHA is `44b39bfaae08071f49ba8daf1ee8602b0544704b`; the tag is not a substitute for a trusted binary checksum.

**Why Rust 1.95?** Actual Action run `43492093639` failed during CLI installation because `cargo-platform 0.3.3` requires Rust >=1.91. Run `43492504373` with Rust 1.91 failed at `solana-sbpf 0.23.0/src/aligned_memory.rs:294` calling `Layout::dangling_ptr()`, a host Rust API stabilized in 1.95. The CLI installation and `cargo check` subsequently succeeded with Rust 1.95.0 in run `43496437684`.

**False-green regression discovered:** In run `43496437684`, Anchor CLI exited zero and generated an IDL, but logs reported a mismatch between an auto-generated program keypair and the placeholder source program ID. **No compiled `.so` was captured**. Therefore this run established host compilation and IDL generation, **not** deployable SBPF compilation. The revised check rejects a missing or non-BPF `target/deploy/deposit_prototype.so`, and verifies the IDL address against the synchronized, disposable local program ID. The stricter build requires an independent passing CI run; do not reuse run `43496437684` as proof of SBF compilation.

## Reproduce offline checks

Use Linux/WSL Ubuntu 24.04 with Git, Node and npm:

```bash
node --version
npm --prefix observer test
npm --prefix observer run check
node --test scripts/ci/guard.test.mjs
node scripts/ci/guard.mjs
node scripts/ci/run-cross-lane-tests.mjs
```

On a combined agent snapshot with `observer/package.json` and `tests/solana/package.json`, first run:

```bash
bash scripts/ci/install-node-deps.sh observer
bash scripts/ci/install-node-deps.sh tests/solana
```

These install actual declared packages using `npm ci`. If a committed lockfile is missing, the script resolves a lockfile, records the exact result in `ci-artifacts/` and prints an **UNLOCKED_DEPENDENCIES** warning; the dependency graph is **not** yet reproducible across runs. CI fails if the install fails. The integrated cross-lane runner rejects any skips in present suites (not just failed assertions). Holochain JS fixture checks are not deployed DNA tests.

## Reproduce CLI + Rust host + strict SBPF/IDL build

Start from a **fresh** checkout; the build deliberately refuses reuse of existing local program keypairs. Install prerequisites (Git, curl, rustup, Clang/LLVM utilities with `readelf`, Python 3, Node 22.16, and system build tools) on Ubuntu 24.04:

```bash
source scripts/ci/toolchain.env
rustup toolchain install "$RUST_VERSION" --profile minimal
rustup default "$RUST_VERSION"
export RUSTUP_TOOLCHAIN="$RUST_VERSION"
sh -c "$(curl -fsSL "https://release.anza.xyz/v${SOLANA_VERSION}/install")"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cargo install --git https://github.com/otter-sec/anchor --tag "v$ANCHOR_VERSION" anchor-cli --locked
bash scripts/ci/record.sh tool-versions bash scripts/ci/tool-versions.sh
bash scripts/ci/record.sh prepare-localnet bash scripts/ci/prepare-localnet-program.sh
bash scripts/ci/record.sh cargo-check cargo check --workspace --all-targets
bash scripts/ci/record.sh anchor-build bash scripts/ci/anchor-build.sh
```

`prepare-localnet-program.sh` generates a brand-new **private** program keypair only in ignored `target/deploy/`, synchronizes its **public** program ID into the **ephemeral CI checkout** using `anchor keys sync`, and checks that the tracked modifications only affect public ID declarations. It writes the public ID to `ci-artifacts/`. These temporary tracked-file changes are **never committed** by CI. Never print, commit, archive, upload, or reuse the private keypair. The strict `anchor-build.sh` checks exact tool versions, IDL, a nonempty `target/deploy/deposit_prototype.so` with Linux BPF ELF header, and public ID/IDL consistency. Missing artifacts or wrong keys make the job **red**. The build never deploys, runs `--ignore-keys`, or enables Holochain credit.

The CI Anchor job runs host `cargo check` and the strict Anchor build separately, recording both exit codes even on error; both must succeed. Build logs, versions, IDL, compiled **public** `.so` binary (if any), checksums, and generated Cargo.lock go into GitHub Actions artifacts. No `target/deploy/*-keypair.json`, `target/localnet-secrets/`, validator ledgers, wallet paths, secrets or private RPC URLs can be uploaded.

No reviewed, committed workspace `Cargo.lock` is available on the original main branch as of this document. An auto-generated `Cargo.lock` is recorded as a diagnostic artifact, **not** proof of a byte-for-byte reproducible program binary. The SOL owner (#35) must review/commit a verified lockfile and IDL/account/PDA schema.

## Validator smoke vs. genuine on-chain integration

```bash
bash scripts/ci/record.sh validator-smoke bash scripts/ci/validator-smoke.sh
```

This starts a throwaway local validator bound to 127.0.0.1:8899; checks health, genesis and block height; asserts invalid RPC method is rejected; then terminates it and deletes temporary ledger. **No program is deployed** in this smoke test. On the isolated integration snapshot PR #37 (not main), the SOL-owned `tests/solana/localnet-build.sh` also attempts real localnet-only `anchor test` with disposable classic SPL mint, deposit/refund and adversarial cases. It is **not passing evidence** until that actual job succeeds. Never run it against devnet/mainnet.

## Cross-agent integration and failing contracts

Isolated draft PR #37 overlays snapshots of SOL #35, OBS #36, SEC #33, and RAVE #34 onto CI #32 without editing source branches. In initial real Actions run `43496860124`, SOL layout: 5 passed/1 IDL check skipped (a **failing** gate); SEC adversarial: 5 passed/6 failed (older synchronous fixture assumption vs OBS's async, canonical-PDA validation); SEC solvency 7/7 passed; RAVE shadow 9/9 passed; RAVE recovery model 5/5 passed. Actual `rave_engine 0.15.0` compiled but its Rust **test harness** failed `E0382` (moved `serde_json::Value`). Owners notified on their PRs; no validation was loosened. The integrated tests intentionally remain red until repaired and independently reviewed.

**Open gates:** a strict successful SBPF binary build in CI, full SOL local-validator transaction lifecycle, committed/reviewed root and npm lockfiles, integrated SEC/OBS API compatibility, successful RAVE Rust harness tests, deployed DNA equivalence, and independent economic safety review. **No issuance, mainnet or production withdrawal approval is implied by any green build.**
