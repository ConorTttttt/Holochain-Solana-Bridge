# SEC-38-3/4 source remediation — candidate; independent re-review REQUIRED

This branch is based on the immutable [SOL #43 commit](https://github.com/ConorTttttt/Holochain-Solana-Bridge/commit/f9d65f1935f679d0052e19bc23960d5b2461452d), with no custody program or economic behavior changes.

## Exact source and trust boundary

- Builder-requested instruction flags remain distinct from signed-message-effective flags. Fee-payer writable elevation and cross-instruction privilege union remain enforced. No builder intent is claimed cryptographically authenticated by signed bytes.
- Bridge Anchor instructions use the generated Anchor IDL; only exact supported Tokenkeg classic SPL Token MintTo (7) / SetAuthority (6) single-authority ABIs use the separate SPL schema. Unknown programs, variants and Token-2022 are not accepted.
- Signed legacy/v0-without-ALT fixtures continue to pass; v0 ALT references and unproven loaded addresses fail closed.
- Missing original containing-block fields, files, RPC null results and missing entries return `WITNESS_BLOCK_MISSING`. Invalid JSON is not mislabeled as an absent block.
- Real archive tampering with signed bytes (fee payer or index) must fail `SIGNATURE_INVALID`; malformed required-signature header fails `SIGNATURE_COUNT`; deliberately re-signed synthetic structurally invalid indices fail `WIRE_PROGRAM_INDEX` or `WIRE_ACCOUNT_INDEX`. Different first failing invariants are **intentionally** distinct error classes.
- Additional strict negative cases cover duplicate requested and effective instruction claims, contradictory duplicate requested metadata, missing parsed/base64 block data, and contradictory block execution metadata. Each case pins its expected rejection reason; each scenario retains an untouched PASS control.

## Toolchain supply chain and provenance

- The temporary SOL workflow no longer executes the downloaded `release.anza.xyz` shell installer. It downloads the exact vendor `v4.1.2` Linux tarball and checks its SHA-256 **before extraction or executing binaries**.
- Pinned expected tarball SHA-256: `5991d027a686eb419a709a479178b33eb83501e8a2bfbf599a81a286bfcbf770`. Source: [Anza GitHub v4.1.2 release API](https://api.github.com/repos/anza-xyz/agave/releases/tags/v4.1.2), asset `solana-release-x86_64-unknown-linux-gnu.tar.bz2`, published 2026-07-10. This is publisher-reported metadata, not an external independent audit; Agent 5 must verify trusted upstream provenance separately.
- Rust 1.95.0, Anchor v1.2.2 exact source target `8d9d1488d9b8af41b266d7513eea2e668adf15a2`, tracked root `Cargo.lock`, post-`anchor keys sync` tracked file checksums and patch, generated IDL/ELF bytes and deployed ProgramData bytes/upgrade authority remain captured by the unchanged lifecycle/build harness. Added ProgramData address and observed upgrade authority to each verifier run log.
- CI must still run at the *new immutable branch SHA* and artifact ZIP must be independently downloaded and hashed. No prior passing SHA is treated as proof for this edit.

## Still unresolved — explicit economic NO-GO

Selected blocks are NOT complete `getBlocks` plus every produced-slot `getBlock` history. PR #47 has mock-tested producer only; no independently operated two-provider original history, authenticated external checkpoint, hostile-host rollback immunity, or Solana consensus-finality proof exists. The custody configuration remains attacker-first-initializable; deposits remain refundable; upgrade/mint authority governance remains unproven. No spendable Holochain credit, Solana withdrawal, public deployment, main merge or automatic adoption into SOL #35. Preserve all four literal denial fields and request independent Agent 5 SEC-38-1/2/3/4 re-review at exact new SHA.
