# Agent 4 — first genuine Rust 1.95.0 locked build evidence (2026-11-14)

**Scope:** ONLY own audit-only Holochain demo DNA, PR #44; no economic or released Unyt mutation. This is an append-only engineering evidence note. It is NOT a statement that the DNA was installed or a signed audit write approved.

## Original dependency provenance and locked graph

- Original resolver **Actions artifact 14126981827** from run 43627399999, source `b7379764f9ba7b20c2e72898df73e181c8ec2380`, ZIP SHA-256 `160f9e9d7dd142af6e4cd8e949a4529eec22bcc4db2b8ead5e0f77852cdad5d5`.
- Original native lock SHA-256 `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` (102,990 bytes; 414 packages; Git blob `6a2ef82e2187cc388e9fa30c94a0791c8ba6d574`). Source directly pins `unytco/ham@fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`.
- Reviewed native `Cargo.lock` committed to A4 branch at `734f3a8c4b006454eed962a6229773b4affceb9f` after actual Rust 1.95.0 Cargo **full `metadata --locked` for both workspaces** and **`cargo tree --locked` for both**, all passed. No regenerated transitive dependency graph was adopted.
- Original WASM lock SHA-256 `85ce7ffafbdf158148a62c64d87fb582b6fe06ffa164e774006c2bdd9afa9751`. Its reviewed one-line **root edge** correction references the already locked `holochain_serialized_bytes = 0.0.57` crate; no new package checksum or Git source. New lock SHA-256 `c5774a18ba821005d80e51c7bf1663062817ce06e585a2bc2245e09da3b4d6c6` (Git blob `caf6a2e7d7f649bc0a4f9dd9c2a736bfd113d7f9`). Modified manifest pins `=0.0.57`. Explicit original-blob-to-review-patch check is in the CI workflow.
- Workflow SHA `5177e1e7c8f60c3e047493ca7c3e0cb9a9a2c908`, run [43645302418](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43645302418), artifact **14134181637** (full metadata, trees, build logs, hashes). Runner first compiled the actual native HAM binary successfully:
  `581ba3fc0285ac57006b739973f913b7c0e3dc54ec846db9f150ed35796ac71a`
  for `ham-adapter/target/release/solana-audit-ham-adapter`.
- The **first actual WASM compiler failure** was integrity `#[hdk_entry_helper]` macro `error[E0433]: cannot find holochain_serialized_bytes in the crate root`; 10 companion `E0277` macro trait errors; Rust compiler exit 101. Not a synthetic/metadata result. Fixed at A4 commits `8a328fb48c0fc2478b4c4cf4c5477f899e673c03` (manifest), `25d0664cbb2e34fc2c3c7e7726022fddcae22f25` (reviewed WASM lock), `e5f525ec8072cbb36255265a6dde125cf0eb0d83` (strict rerun gate).
- Real corrected source build run [43646262316](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43646262316). Do **not** report its compilation, hash or packaging as successful without the actual job result and artifacts.

## Source and installation are different gates

The checked-in `dna.yaml` binds only to the independent inspected **archived stopped SOL PR #55** domain (`c071e4c98e7b2dd04a18374f3792c0a90ce4b284`): genesis `BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv`, program `387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1`, mint `3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig`, scope `85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7`. A1's integration source and scope are DIFFERENT. Never silently relabel this archived DNA as same-run or override template source. Preserve new run's actual four authenticated properties, source digest, independent binary/DNA/hApp/lock hashes and full installed CellId for A5.

The `a4-install-readonly.sh` harness is a **new, unexecuted** external-Lair proposal, not an install proof. It never mutates a zome or grants capability. Only actual 0.7.1 installed Admin API identity + HAM Node Lair signed `get_contract` + wrong app/agent/DNA and absent-Lair tests can establish its target runtime tuple. The producer-owned Observer v2 canonical byte vector and A5 independent permission have NOT been frozen: **do not implement or activate a mutating v2 route**.

Always: `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. Unyt source-equivalence B2 and economic gate C remain **NO-GO**.
