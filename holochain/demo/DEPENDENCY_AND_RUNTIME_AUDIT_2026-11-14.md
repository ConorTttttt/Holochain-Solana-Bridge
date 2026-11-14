# Agent 4 — original dependency and source archive audit, 2026-11-14

**Status: PARTIAL / UNBUILT / UNINSTALLED / NO AUTHORIZED WRITE.** Evidence was checked outside the source-owned CI runner. This report is not a Rust compiler pass, a full transitive supply-chain audit, independent Solana consensus, Agent 5 security approval or Holochain authorization.

## Immutable inputs and actual commands

- A4 pre-review source HEAD: `c465501621731a1f2cea3a47d0113cef6cd9cae8` (PR #44). No non-Holochain-owned source was altered.
- A1 bootstrap source: `b7379764f9ba7b20c2e72898df73e181c8ec2380` (PR #56), Actions run `43627399999`, successful **resolution-only** job `132546266546`.
- Downloaded original bootstrap artifact: ID `14126981827`, ZIP SHA-256 `160f9e9d7dd142af6e4cd8e949a4529eec22bcc4db2b8ead5e0f77852cdad5d5`; verified against Actions uploader digest. It contains the two original `Cargo.lock` proposals, `cargo metadata --no-deps` outputs, Cargo version, Rust version, provenance and resolver stdout.
- Original runner: `rustc 1.95.0 (59807616e 2026-04-14)`, `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`; `cargo generate-lockfile` resolved 125 registry packages plus two workspace packages for WASM, and 412 registry packages, immutable HAM Git package plus native root for HAM.
- The local review parsed both original lockfiles with Python `tomllib`, verified lock format 4, unique exact package triples, SHA-256 shape for each crates.io registry checksum, only the ordinary crates.io registry, no unrecognized Git sources, and exact `unytco/ham@fbb4b6eb8a79a507e9453b709ed00f15c5618fb4` as the sole native Git dependency. **This is structural/provenance review, NOT registry-crate byte re-download, advisory/license clearance, MSRV proof or a successful compiler build.**
- `holochain/demo/Cargo.lock` already committed in A4 HEAD: Git blob `6a0a3da541a6c1333d56367994725e64b2e295a4`; **byte-identical to A1 proposal**, SHA-256 `85ce7ffafbdf158148a62c64d87fb582b6fe06ffa164e774006c2bdd9afa9751` (30,522 bytes; 127 packages).
- Native `holochain/demo/ham-adapter/Cargo.lock` original proposal: Git-blob digest of the downloaded bytes `6a2ef82e2187cc388e9fa30c94a0791c8ba6d574`, SHA-256 `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` (102,990 bytes; 414 packages). **Not committed to this A4 branch in this report.** A4 has since added a standalone `[workspace]` to the native manifest (current Git blob `c821812ff1de2adab47634c35e689d5b32a5c303` versus A1's copied `7bdd4ba154549b9d6803aa34af74d7dc06b40bf5`); the actual native locked graph still requires `cargo +1.95.0 tree --locked --manifest-path holochain/demo/ham-adapter/Cargo.toml` **at a committed native lock and exact candidate SHA**.
- The original metadata files have `resolve:null` because bootstrap used `cargo metadata --no-deps`; the lockfiles record package versions but those metadata files do not independently prove a transitive compiled graph.
- Duplicate transitive version families exist (e.g. native `getrandom` 0.2/0.3/0.4, `syn` 1/2/3, `base64` 0.22/0.23), so the exact Rust 1.95.0 native and WASM `--locked` builds remain obligatory before treating this graph as compatible.

## Original SOL #55 source, independent archive check

- Original SOL commit: `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`, original Actions run `43604140724`, artifact `14118166967`, archive ZIP SHA-256 **`33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018`** (matches uploader). Re-read `localnet-evidence/demo-source-domain.json` from the original downloaded ZIP; verified **280/280** archive manifest entries relative to `localnet-evidence/`, none failed.
- Actual source: `genesisHash=BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv`, `program=387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1`, `mint=3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig`, initialized `holochainScope=85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7`. This matches current A4 `dna.yaml`; it is not the historical all-07 example.
- Independently rehashed original IDL `d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007` and ELF `13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647`. Manifest evidence is an **archived stopped disposable validator**, not source-chain consensus authentication; original history remains incomplete and collateral was refundable.

## Exact current CI block (do not count skipped stages)

- A1 same-SHA `b7379764...` run `43627400018`, build job `132546342739`: **FAILURE** before tool installation, `node demo/a0-runtime-gate.mjs --out ci-artifacts/a0-runtime-readiness.json --require-build` exited **3** with `a0:"BLOCKED_NOT_ACCEPTED"`. It reported missing **both** committed locks in its **own distinct immutable integration tree**, an unverified source domain in the A0 gate, no v2 security decision, no installed identity/write authorization and incomplete history. These statements are about A1's integration checkout, not a claim that A4's independently updated DNA source still has placeholders.
- Same run `132546266609` source/refusal tests: success; Nix install and `--locked` compile skipped in failing build job; install job `132546418209` **skipped**. Its failure artifact `14127220327` ZIP SHA-256 `4aba32ab7a1b9c619269b7421dc15549ff088ae37f3c21993e902af1d6e4664a`.
- This local review environment has `git` and Node 22 but **no `cargo`, `rustc`, `nix`, `hc`, conductor or external Lair** and cannot reach GitHub from the local shell. No Rust compile, trusted `hc dna pack` / `hc app pack`, DNA hash, install, HAM signed read-only probe, restart readback, compiler error or ActionHash occurred here.

## Next unfulfilled gates

Commit the **exact reviewed native lock bytes** to A4, verify both locks `--locked` without rewriting, build native HAM + integrity/coordinator WASM using Rust 1.95.0 and pinned Holochain 0.7.1, then package/hash own bundles. Have Agent 1 adopt the **new A4 SHA and source-owned Git blobs** before executing its own same-SHA build/install and retain job IDs, original logs and digests. A real install and signed read-only identity probe require the actual disposable conductor and external Lair. Before any Holochain mutating call, obtain independent approval of the exact approved tuple; there is **no** approval for `record_observation`, `record_observation_v2`, capability grants or a published Unyt coordinator call.

A3's v2 envelope and A4's review-only v2 shape are still incompatible; do not silently compress the original signed wire or containing block into labels, reinterpret canonical digests or activate a caller-provided provenance flag. v1 remains `test_only_fixture` only; no genuine authorized signed delivery is claimed.

`creditEligible:false` · `independentConsensusVerified:false` · `spendableBaseUnits:"0"` · `withdrawalAuthorized:false`.

**Gate C: NO-GO.**

## Direct original signed-wire checks (local audit, not a live replay)

After the report above was first committed, a local Python `cryptography` Ed25519 audit decoded the *original* SOL #55 `getTransaction-base64` archives for initialize, deposit and refund. The script parsed Solana shortvec signatures, legacy static message account keys, compiled instructions and complete message bytes; verified **every archived Ed25519 signer signature**, checked the first wire signature against the source-domain manifest, bound the compiled target program and exact original slot, and found the signed initialized 32-byte scope inside the initialize instruction data. For each event, the complete byte-identical signed wire occurred **exactly once** in its separately archived original `getBlock-base64` containing block, with `meta.err:null`.

| Original event | Slot | Signed-wire SHA-256 | Result |
|---|---:|---|---|
| initialize | 10 | `2640a5817923ab6b89c704b7f61017416c9894b7b990e3e0d34f4142f6d715a4` | Ed25519 PASS, exact block inclusion once |
| deposit | 42 | `7dd4f34251059c1c13f01c29087ac1e619111a4bc65910de62210c9a77ba02bc` | Ed25519 PASS, exact block inclusion once |
| refund | 75 | `bc402e98ec949aab6f19ef63e01eabee62f7d17237d03f5838decdc140986d71` | Ed25519 PASS, exact block inclusion once |

These are **three selected archived signed wires**, NOT exhaustive produced-slot history, a validator replay, independent consensus or economic authorization. Source-owned A2 verifier and A3 Kit admission remain separate gates.
