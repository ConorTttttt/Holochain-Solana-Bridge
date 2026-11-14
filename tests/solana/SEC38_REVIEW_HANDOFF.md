# SOL SEC-38 review handoff — 2026-11-14

**SEC state: changes proposed, independently unreviewed.** This SOL-owned
review branch descends directly from the unadopted Claude PR #38 commit
`cca4e9a94b5147efa82ac0106f1f97f75a42251f`. The official SOL PR #35
head `6492260f184e69f86abce02466878c25d666324d` is not modified. Do not
merge this branch or PR #38 into the official SOL lane before explicit Agent 5
approval of SEC-38-1/2/3 and the exact-commit run.

## What must be independently re-reviewed

- **SEC-38-1:** `signed-message.mjs` decodes the signed legacy/v0 message,
  verifies every Ed25519 signature, required signers and order, static key
  identity, message header permissions, blockhash, compiled instruction account
  indices, program IDs, and instruction data. `verify-witness-bundle.mjs`
  reconciles signed bytes with getTransaction JSON, containing getBlock JSON,
  archived attribution and archived logs. Any mismatch is fail-closed.
- **SEC-38-2:** Every finalized signature must have a canonically encoded
  original `signedWireBase64` record. Multiple records must agree byte-for-byte;
  absence, malformed data and contradictions are fatal. The submitted wire must
  match finalized getTransaction AND getBlock bytes.
- **SEC-38-3:** Named tamper mutations assert exact error classes, with an
  untouched positive control in each of lifecycle, init-capture and u64-max.
  `signed-message-fixtures.test.mjs` independently signs (using PUBLIC
  synthetic test seeds) a legacy two-signer, a v0 one-signer and a v0 two-signer
  transaction. Message, signature, signer, program, blockhash, account flags
  and wire attacks have independent class-specific rejection assertions.

**Unsupported:** The local-validator archive includes only legacy single-signer
transactions. Synthetic v0 fixtures have no lookup tables and are NOT on-chain
evidence. The decoder rejects any v0 message using an address lookup table as
`ALT_UNVERIFIED`, because authenticated lookup-account data at the transaction
slot is not present. No v0/ALT on-chain or fork-proof claim is made.

## Reviewed source and tool provenance

- `Cargo.lock` was copied byte-for-byte from combined integration commit
  `6a415018792e79aa7ab2962b9c9f8003a5bcc8bb`, Git blob
  `a1b062209cedf7bb517f5e2945a5572d129b12ac`.
  The root workspace manifest and SOL program Cargo.toml match this source
  exactly. Host `cargo check --locked` is required. The nested Anchor build
  must leave Cargo.lock byte-identical and preserve the tracked source manifest.
- Official `otter-sec/anchor` v1.2.2 is an immutable published release with
  a verified signed annotated tag object
  `7f9c7c83b5652e92ec6d509e02c0ad4554b6624c` pointing to commit
  `8d9d1488d9b8af41b266d7513eea2e668adf15a2`.
  The workflow installs CLI using this exact commit, not a mutable tag name.
  Sources: https://github.com/otter-sec/anchor/releases/tag/v1.2.2 and
  https://api.github.com/repos/otter-sec/anchor/git/tags/7f9c7c83b5652e92ec6d509e02c0ad4554b6624c
- The Anza Solana 4.1.2 remote installation script's fetched SHA-256, the
  installed Solana/Anchor executables, and actual Rust binary SHA-256 are saved
  in public CI evidence. **An observed digest is not a previously vetted
  expected checksum:** installer integrity remains a residual supply-chain
  question pending independently reviewed pinned delivery.
- `anchor keys sync` intentionally rewrites tracked public program ID
  declarations. `tracked-pre-sync.sha256`, `tracked-post-sync.sha256`,
  `anchor-keys-sync.patch`, `anchor-keys-sync-tracked-changes.txt`,
  `build-inputs.sha256` and `cargo-lock.sha256` establish the post-sync
  source used for the ELF/IDL build. The SHA-256 of the post-sync manifest is
  embedded in all transaction and account witness bindings.

## Trust limits

The genesis hash, finalized RPC responses, block inclusion, and ProgramData ELF
are observations from a **disposable local validator through its local RPC**.
They are *not independently authenticated consensus or historical finality*.
A self-consistent forged RPC archive cannot be ruled out by an internally
consistent hash manifest. The executable bytes are tied to the local ELF only;
this does not prove production Solana deployment or governance controls.

The known first-initializer capture is **reproduced but not fixed**, the
collateral is refundable, and upgrade and mint governance is unresolved.
`creditEligible: false`. No main merge, spendable Holochain credit, withdrawal
path, or economic authorization is permitted.

## Required independent gate

Agent 5 must inspect the exact review branch SHA, the complete Rust/Anchor/
three fresh validator modes/restart workflow and uploaded archive (including
per-mode untampered controls and tamper assertions), and post an explicit
independent verdict for each SEC-38-1, SEC-38-2 and SEC-38-3. Only an approved
reviewed source commit can be fast-forward-adopted into PR #35 and handed to
Agent 1 for a new immutable integrated candidate.
