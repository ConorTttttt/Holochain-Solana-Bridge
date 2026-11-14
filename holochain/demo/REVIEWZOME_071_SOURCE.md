# Agent 4 — ReviewZome / Holochain 0.7.1 source audit (14 November 2026)

**Scope:** PR #44 controlled *own* audit DNA, `holochain/demo/{integrity,coordinator,ham-adapter}` and its read-only build path. This is a source audit, **not** a Rust/WASM compile report, runtime write approval, SEC signoff or Unyt coordinator review.

## Version authority and sources

- Manifest target: `hdk = "=0.7.1"`, `hdi = "=0.8.1"`, native `holochain_client = "=0.9.1"`, `holo_hash = "=0.7.1"`.
- Pinned external source: `unytco/ham@fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`; its `LairCredentials::Node` and `CapGrantOptIn::Withheld` code was inspected at that immutable ref.
- **Actual resolved versions UNKNOWN:** `holochain/demo/Cargo.lock` and `holochain/demo/ham-adapter/Cargo.lock` are missing. A manifest is not a resolved dependency graph. Generate/review both on a Rust 1.95.0 networked runner before asserting resolved 0.7.1 types.
- Reviewed installed Holochain skill `1.0.0-rc.2`, `references/architecture.md`, `references/patterns.md`, `references/source-chain.md`, `references/workflows/review-zome.md`; checked public Holochain 0.7 documentation:
  - https://developer.holochain.org/resources/upgrade/upgrade-holochain-0.7/
  - https://docs.rs/hdk/0.7.1/hdk/
  - https://docs.rs/hdi/0.8.1/hdi/
  - https://developer.holochain.org/build/dnas/
  - https://developer.holochain.org/build/cell-introspection/

## ReviewZome findings

### Source errors corrected in this PR

1. **BLOCK / Rust trait derivation:** `AuditObservation` is cloned and compared by coordinator; `#[hdk_entry_helper]` provides Serde/Debug, **not** the requested `Clone` and `PartialEq` traits. Added explicit derives. Added explicit Serialize/Deserialize derives for `#[hdk_entry_types]` enum.
2. **BLOCK / HDK 0.7 source-chain filter:** `UnitEntryTypes::AuditObservation.into()` inside `EntryType::App(...)` used the wrong conversion form. Use fallible `UnitEntryTypes::AuditObservation.try_into()?` directly in `ChainQueryFilter::entry_type`; match the pinned skill's source-chain examples.
3. **BLOCK / HDI typed operation:** `Op::flattened` must resolve both EntryTypes and LinkTypes. Declared a reserved unused `LinkTypes::Forbidden` and used explicit `op.flattened::<EntryTypes, LinkTypes>()?`. All creation/deletion of links remains invalid in the integrity validator, and no coordinator endpoint emits links.
4. **WARN / ambiguous local replay:** `get_observation` previously picked the first match silently. It now refuses multiple same-author local records for a source ID rather than acknowledging an ambiguous conflict as one successful write. This is deliberately **not** global deduplication/fork or hostile rollback protection.
5. **WARN / build provenance:** build script now fails for either absent/untracked lockfile, missing HC 0.7.1, and example scope/seed; compiles both WASM and native signing adapter `--locked`; archives SHA-256 and invokes `hc dna hash` for the *actual* DNA identifier. **Not executed** on a suitable runner.

### Current BLOCK gates (not corrected or demonstrated)

- **Toolchain**: no `cargo`, `rustc`, `nix`, `hc`, Holochain conductor, or external Lair in the local execution sandbox. Neither dependency-resolution lock exists. `cargo +1.95.0` and pinned Holonix builds must happen in trusted networked CI under a same-commit SHA; collect full logs and build provenance.
- **Scope**: checked-in network seed is a deliberately unbuildable placeholder; genesis/program/mint/scope are synthetic examples, not a demonstrated matching disposable validator identity. No guesswork or automatic promotion to real OBS evidence.
- **Tests**: no Sweettest or deployed zome integration, actual app and `CellId`, read-only authenticated zome probe, external Lair zome write, signed ActionHash, readback, restart or real negatives. Existing Node schema suite 36/36 is mock only.
- **Admission**: both WASM and HAM remain `test_only_fixture` and deposit-only. OBS PR #48 at `220d5aa314c5b154608af24dea8b0af5c1ed6053` has a source-owned `solana-observation-demo-v1` projection, but its authenticated live-Kit delivery/receipts and independent SEC review are incomplete. It is **not** authorized by matching JSON shape or setting `evidenceOrigin='observer_reviewed_outbox'`.
- **SEC**: Agent 5 has NOT approved an exact immutable write tuple (source, WASM, DNA, installed app ID, `CellId`, agent/Lair signer, zome/function, canonical ABI and evidence trust). No mutating call may be exercised before that approval.

### PASS — source-level boundaries only

- Integrity and coordinator are separate; integrity uses deterministic `dna_info()` and no network/time reads; `validate` forbids update/delete/link ops.
- No balance/credit/spend/withdraw/RAVE/coordinator-grant APIs. Audit entries preserve `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false` in root, source, proof and signed readback.
- HAM exact node signer and `CapGrantOptIn::Withheld`; explicit app/role/cell/DNA/agent/ABI checks, sanitized error classes. Code does not call released Unyt `transactor`.
- No global source-chain duplicate prevention, two-independent-conductor agreement or economic authorization claimed.

## Exact runner and handoff

On immutable Agent 4 commit + verified disposable source scope, Agent 1/runner generates and **reviews/commits** both Cargo locks (separate commits and refreshed exact SHA), then runs:

```sh
cargo +1.95.0 generate-lockfile --manifest-path holochain/demo/Cargo.toml
cargo +1.95.0 generate-lockfile --manifest-path holochain/demo/ham-adapter/Cargo.toml
# Review diff / checksums, commit locks, rerun on that immutable HEAD:
node --test tests/holochain/demo/demo-abi.test.mjs
nix develop 'github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da' --command bash holochain/demo/build.sh
```

Archive full command exit codes, CI run URL, exact HEAD, both lock digests, Rust/hc versions, both WASM and both bundle SHA-256 values, `hc dna hash`, signed identity snapshots and sanitized logs. For a **read-only** probe, use the existing `ham-adapter -- preflight` against a separately installed disposable audit app and external Lair. An actual `record_observation` call is a distinct, currently blocked approval step.

**Unyt B2 remains blocked:** `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf` source-to-released-WASM equivalence, published coordinator ABI/capability and allowed caller/deployed identity remain unverified. Gate C remains NO-GO.
