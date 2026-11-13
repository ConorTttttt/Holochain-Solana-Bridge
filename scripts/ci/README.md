# Sprint 0 CI: reproducible commands and evidence

This is **Issue #11**, research-only. Never deploy to mainnet, commit credentials,
transfer real value or enable Holochain credit issuance. See AGENTS.md and
docs/SECURITY_GATES.md.

## Pinned versions

`scripts/ci/toolchain.env` declares Node 22.16.0, Rust 1.89.0,
Solana/Agave CLI 4.1.2, Anchor 1.2.2, platform-tools v1.57, SBPF v3.
The workflow pins GitHub Actions to exact commit SHAs. Prerequisites: Ubuntu
24.04 or compatible Linux/WSL, Git, curl, rustup and build dependencies.

## Exact local smoke checks

From the repository root:

```bash
node --version
npm --prefix observer test
npm --prefix observer run check
node --test scripts/ci/guard.test.mjs
node scripts/ci/guard.mjs
```

The guard's tests include allowed source files (positive) and blocked wallet
paths, generated artifacts and credential patterns (negative). It inspects
Git-tracked filenames and text only, not Git history or binaries. It is a
baseline control **not** a replacement for review or managed secret scanning.

## Rust and Anchor build — verification required

```bash
source scripts/ci/toolchain.env
rustup toolchain install "$RUST_VERSION" --profile minimal
rustup default "$RUST_VERSION"
sh -c "$(curl -fsSL "https://release.anza.xyz/v${SOLANA_VERSION}/install")"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cargo install --git https://github.com/otter-sec/anchor --tag "v$ANCHOR_VERSION" anchor-cli --locked
bash scripts/ci/record.sh tool-versions bash scripts/ci/tool-versions.sh
bash scripts/ci/record.sh cargo-check cargo check --workspace --all-targets
bash scripts/ci/record.sh anchor-build bash scripts/ci/anchor-build.sh
sha256sum target/idl/deposit_prototype.json
```

CI runs both `cargo check` and `anchor build` even if one fails and fails
the job if either fails. Build script checks tool versions and the generated
IDL. It never changes the placeholder program ID, runs `anchor keys sync`,
deploys a program, or passes `--ignore-keys`. If program-keypair validation
or compilation fails, the job must stay RED until SOL #7 corrects it.
Current source has **no committed Cargo.lock**; a dynamically generated
lockfile is archived as evidence, not proof of deterministic builds. SOL #7
must validate compatible toolchains, checked-in dependency resolution, IDL,
PDA/account layout and actual SBF build before declaring the gate passed.

## Local-validator smoke (not deposit/refund tests)

With installed Node and Solana CLI:

```bash
bash scripts/ci/record.sh validator-smoke bash scripts/ci/validator-smoke.sh
```

Starts a disposable validator on 127.0.0.1:8899, checks healthy read-only
RPC and genesis/block height, confirms invalid RPC rejected, stops the process
and deletes the temporary ledger. No wallet is exported, no program deployed,
and no transaction lifecycle exercised. S1 requires SOL-owned tests under
`tests/solana/**` for initialize, deposits, refunds, replay, pause, wrong
signer/accounts, and token balance reconciliation. Those tests do not yet exist.

## Artifact/CI policy and handoffs

PRs and main pushes run observer tests + syntax checks, baseline guard,
Rust/Anchor compilation, validator RPC smoke. Artifacts preserve log files,
tool versions, a generated IDL only if available, generated Cargo.lock and
checksums. **Never upload target/deploy, keypair JSON, ledgers or wallet files.**
Failed installation/build/test jobs remain failed; upload of partial logs is
not a success claim.

SOL #7 supplies compiled IDL, program/account/PDA schema and validator
transaction tests; OBS #8 supplies observer/indexer test commands and schema
without CI modifying validation logic; RAVE #9 supplies a pinned Holochain
conductor/DNA sandbox runner and shadow-only fixtures; SEC #10 reviews
credential patterns, CI supply chain and additional adversarial scenarios.
When RAVE's harness exists, add a required job that installs pinned sandbox
tools, runs its real tests and archives redacted logs; **do not** add a
green skipped placeholder for the absent sandbox. No Holochain credit issuance.

Known unverified gates on this first PR: actual Anchor build/IDL, validator
transaction integration, Holochain sandbox, reproducible byte-for-byte
program build and external economic security. The CI workflow may initially
fail and should not be merged solely because observer/parser tests pass.
