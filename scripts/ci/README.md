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

## Verified upstream dependency graph and evidence (13 November 2026)

The `otter-sec/anchor` tag `v1.2.2` has upstream locked Cargo graph SHA `44b39bfaae08071f49ba8daf1ee8602b0544704b`. It explicitly contains:

- `anchor-cli 1.2.2 -> cargo_metadata 0.23.1 -> cargo-platform 0.3.3`; the last crate rejects host Rust 1.89 (requires >=1.91).
- `anchor-cli 1.2.2 -> solana-sbpf 0.23.0` (direct). `solana-sbpf/src/aligned_memory.rs:294` calls `core::alloc::Layout::dangling_ptr()`. Rust upstream `core/src/alloc/layout.rs` has `#[stable(feature = "alloc_layout_extra", since = "1.95.0")]` on this method. A 1.91 host fails `E0599`; host **1.95.0** is necessary for this exact installed graph.
- The SBPF target compiler comes from Solana `platform-tools v1.57`, not from host `rustup`. Anchor 1.2.2 official release notes recommend Solana CLI **4.1.2**, platform-tools **v1.57**, SBPF architecture **v3**. No Anchor or Solana version changes are needed.

Evidence: failing original runs [43492093639](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43492093639), [43492504373](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43492504373); **actual Rust 1.95 CLI install/host check PASS** in run [43496437684](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43496437684).

**Real compiled program:** independent integration run [43499276656](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499276656) created `target/deploy/deposit_prototype.so` (221624 bytes), SHA256 `0a07b91b039de5098c0ab6b048f66831750f589f3bcdc28aa4a5adf7a809b066`, confirmed with `readelf -h` as **ELF64 Linux BPF**. Generated Anchor IDL SHA256 `966ae71537239dc3008a123e0a94a2a3052016598f609ed2ac32cf92845f37ad`, whose public address matched disposable key source and TOML. **SOL Borsh/IDL layout 7/7 PASS with real IDL**. Download actual logs, IDL and executable from [artifact 14074120871](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499276656/artifacts/14074120871).

**Real on-chain transaction test:** independent SOL workflow [43499386297](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297) compiled a second SBPF/IDL and passed 6/6 actual local-validator transaction assertions (0 fail/skip), artifact [14073462857](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297/artifacts/14073462857). Its standalone layout suite had 6 passed and 1 **explicit skip** for unmerged Observer-v2; do **not** count as full integrated layout coverage.

**Cross-agent results:** integrated dependency-backed OBS unit checks **20/20 PASS**; SEC adversarial **16/16 PASS**, SEC solvency **7/7 PASS**, RAVE shadow **9/9 PASS**, RAVE replay model **5/5 PASS**. A newer RAVE 0.15.0 Rust harness compiled with its real published dependencies and ran **5/5 PASS** (run [43501475103](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43501475103)), but that job correctly failed its old lock digest. The *only* generated RAVE Cargo.lock change was the new direct `rmp-serde` dependency, matching source `=1.3.0`; the lock integrity expected digest was updated to the newly checked `e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001`. No checks were disabled.

**Integrated failures corrected but awaiting another whole-workflow pass:** snapshot PR #37 previously failed `Provided owner is not allowed` after accidentally creating the same ATA twice; current SOL #35 correctly supplies a fresh `Keypair.generate()` for a distinct refund destination, now carried into the integration-only snapshot. The separate offline cross-lane job skipped the required generated-IDL check, correctly marking the job red; the integration workflow now downloads *real* IDL from the local-validator build job (no synthetic IDL), and its strict test aggregator still fails if IDL is missing or any test skips. Both PRs remain drafts until latest combined Actions runs actually complete.

### Fail-closed lock graph manifest

`scripts/ci/check-lock-digest.sh` records and validates these actual lockfile digests:
- Root `Cargo.lock`: `9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5`
- Observer `package-lock.json`: `87578ffa1a3f0d1f0102f58ac649e25cd2a9d2902889bc946213fb2f136f0f62`
- SOL `tests/solana/package-lock.json`: `24ad69597db242528c87a98d8bc2299574e09eb52e77e026281db01e1c9889c6`
- RAVE harness `Cargo.lock` (5-test source): `e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001`.

The validator, Rust host, Observer and RAVE CI lanes reject a changed graph even if compilation itself succeeds. Raw lockfile bytes and logs are retained in Actions artifacts. **This is strict graph drift detection, NOT a substitute for separately committed and reviewed lockfiles** in the root workspace and source-owned OBS/SOL/RAVE paths. No offline/byte-for-byte reproducible build or integrated green suite is claimed until those gates independently pass. IDL/.so hashes vary with each fresh local program ID. Do not check in generated wallet keys or upload them. No deployed Unyt DNA or production economic functions are exercised.
