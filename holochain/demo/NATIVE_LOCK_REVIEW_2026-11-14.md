# A4 original native HAM Cargo graph review — 2026-11-14

**State: offline candidate reviewed; native lock NOT committed; no Cargo metadata/tree/build/install pass yet.** This document is evidence, not approval of a zome write.

## Exact original provenance

- PR #44 source before these review-only changes: `990bd4e4d67d0f5f4ab8851ee1397be3ca62f20a`. All edits belong to `holochain/demo/**`.
- A1 source of resolution: `b7379764f9ba7b20c2e72898df73e181c8ec2380`, run [43627399999](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627399999), **actual successful resolution-only** job `132546266546`.
- Original artifact `14126981827`: ZIP SHA-256 `160f9e9d7dd142af6e4cd8e949a4529eec22bcc4db2b8ead5e0f77852cdad5d5`, independently rehashed from the downloaded bytes, equal to the uploader log digest.
- Proposed WASM `Cargo.lock`: SHA-256 `85ce7ffafbdf158148a62c64d87fb582b6fe06ffa164e774006c2bdd9afa9751`; 30,522 bytes, 127 packages, **already committed** on PR #44.
- Proposed native `ham-adapter/Cargo.lock`: SHA-256 `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399`; Git blob digest `6a2ef82e2187cc388e9fa30c94a0791c8ba6d574`; 102,990 bytes, 414 packages; **not yet committed**. The artifact generated it using an isolated copy of the old native package manifest.
- Original runner: `rustc 1.95.0 (59807616e 2026-04-14)`; `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`.
- Pinned HAM `unytco/ham@fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`; native `holochain_client = =0.9.1`, `holo_hash = =0.7.1`. There is precisely one Git source, pinned to HAM, and 412 crates.io packages with SHA-256 checksum fields.

## Standalone manifest change and verification limits

A4's current native manifest blob is `c821812ff1de2adab47634c35e689d5b32a5c303`. Compared with the A1 bootstrap manifest `7bdd4ba154549b9d6803aa34af74d7dc06b40bf5`, the change is a standalone `[workspace] resolver = "2"` stanza. The direct dependency table and `[package]` declaration are identical. In the original bootstrap, the native package was copied **outside** the inherited root workspace, so its root identity and dependency table are the same as under the current standalone manifest. This is evidence that the candidate is plausible, **not** a Cargo resolver proof that it is unchanged.

The local offline check parsed the *original* unmodified lock bytes with Python `tomllib`, confirmed Cargo format 4, one native root with all seven expected direct dependencies, one HAM Git package at the exact reviewed SHA, 412 checksummed crates.io packages, absence of other Git sources, unique package tuples, required pinned versions, and resolvable references. The new `verify-native-lock.py` makes these fail-closed checks reproducible on the actual branch. Its offline result against the original proposal is:

```text
NATIVE_LOCK_STRUCTURAL_REVIEW_OK SHA256=08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399 packages=414
```

**Crucial limitation:** the artifact's original `cargo metadata --no-deps` had `resolve:null`; no exact-head `cargo metadata` with full resolution, `cargo tree --locked`, compiler invocation, registry byte audit, security advisories or license clearance has yet been executed. Offline SHA-256 matches are not independent package provenance.

## Required next work on a networked Rust 1.95.0/Holonix runner

1. Obtain the **original ZIP** artifact 14126981827 and verify its exact ZIP SHA-256 before extracting.
2. Compare current `ham-adapter/Cargo.toml` with the root manifest description above; reject any newly added dependencies or changed revision until independently reviewed.
3. Transfer the candidate **exact original bytes** into `holochain/demo/ham-adapter/Cargo.lock` without hand-editing, run `python3 holochain/demo/verify-native-lock.py`, and review the SHA-256 against `08347c32...`. Commit the lockfile on **Agent 4's branch only**, with reviewer-visible provenance.
4. Run `bash holochain/demo/bootstrap-locks.sh verify`; this now requires full `cargo +1.95.0 metadata --locked` on both workspaces **and** two independent locked `cargo tree` runs. Record full stdout/stderr and first failing command. Do **not** use `generate` on the existing WASM lock.
5. Execute the pinned Holochain 0.7.1 `bash holochain/demo/build.sh` on that exact committed SHA. This requires actual native HAM and two WASM compilation passes before DNA/hApp pack; record both WASM, native HAM, bundle and lock hashes, and **actual** `hc dna hash`.
6. Source-domain policy: v1 `dna.yaml` is pinned to the **archived stopped** SOL #55 source `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`. It is not the integrated validator source. Prefer an immutable, reauthenticated integrated source manifest and build a **new source-specific DNA** from the same compiled reusable WASMs; preserve the old YAML and its source evidence as a separate build identity.
7. Only after genuine installation identify the installed app, full ordered `(DNA hash, agent)` CellId and external Lair signer through read-only HAM preflight. Do **not** call a mutating zome without independent SEC approval of the exact source, locks, binaries, signer, installed identity, function and canonical input bytes.

A1's separate integration run [43627400018](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627400018) had build job `132546342739` **FAILURE** at the source readiness gate (exit 3, `BLOCKED_NOT_ACCEPTED`), before installing Rust/Nix; source/refusal job `132546266609` passed; install job `132546418209` was **SKIPPED**. Its source checkout is not the same as this updated A4 branch.

A3 #52 `observer/src/demo-witness-v2.mjs` retains original wire and full containing block and uses `HSC/observer-authenticated-audit-witness/v2` as its witness-digest domain. A4's draft v2 has different fields and uses `HSC/solana-audit-demo-v2/source-to-dna` for a distinct *destination-bound* digest. They are not interchangeable; no full real canonical vector / independent approved authenticated delivery interface has been frozen. **Do not activate `record_observation_v2` merely because an inbound `observer_reviewed_outbox` label or checksum is present.**

## Security and acceptance

```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

A0 installation is blocked. B1 complete historical coverage, B2 published-Unyt equivalence and C economic authorization remain NO-GO. A native dependency review neither authorizes v2 nor permits a published Unyt coordinator call, a capability grant, a spendable issuance or withdrawal.
