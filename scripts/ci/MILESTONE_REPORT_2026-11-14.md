# Agent 1 — source-pinned S0 integration acceptance report (14 November 2026 UTC)

**Decision: P0 RED / DRAFT / non-economic only.** A new source-pinned candidate is prepared, but this document is **not** a passing CI or runtime attestation. Never merge to `main`, enable spendable Holochain credit, authorize withdrawals or deploy production assets. All required suites and their original on-chain witnesses must pass for one **exact immutable commit**, with no required skips.

## Reconciled source heads — verified GitHub refs

| Lane | PR | Exact upstream SHA | Imported changes |
|---|---:|---|---|
| CI | [#32](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/32) | `ce0fe43dbaab4c709a521197693e52b2ea7176ef` | CI workflow provenance gating and cross-agent integration; joined as a commit parent |
| SOL | [#35](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/35) | `6fb7529619050a7c251acc055d7cb6f4b8e69b35` | Source-owned complete signed base64 transaction/block capture, unexpected rejection diagnostics, stronger bundle verifier |
| OBS | [#36](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/36) | `94361778d08a3cfd5358d5d3de1af5a1c0318835` | Source-owned authenticated signer export, new validator-witness replay entry point and negative regressions |
| RAVE | [#34](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/34) | `17a3623917311fd3ccbe338293f1cd8ce4cb3c7c` | Actual 0.7.1 conductor probe, verified artifact inspection and real conductor evidence |
| SEC | [#33](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/33) | `a42096495934f42c86f09c36fa0bdc9b48f362e9` | Independent 6004/ledger/consensus threat re-review |

Exact **file-level** Git blob SHAs are in [ci-integration-snapshot.json](../../ci-integration-snapshot.json) and checked by `node scripts/ci/verify-integration-provenance.mjs`; importing selected paths rather than PR-wide merges avoids replacing unrelated specialists. Original integration parent `aa2502da3f9bcd0cdd07763725ad6618a8006919` and old CI source parent are preserved. The candidate's Git commit is its immutable identity; its creation does not prove that CI passed.

The SOL source now owns complete base64 `getBlock` capture, so the old CI-only `tests/solana/integration.test.mjs` overlay is **replaced** with the source-owned file. OBS's second-signer test error regex and SEC's tamper-byte fixture are still explicitly marked CI-only test corrections, not falsely attributed to source. `sol-verify-temporary.yml` is intentionally not imported: it is a specialist branch-specific temporary workflow. The RAVE workflow body remains source-derived, with a CI-only integration-branch push trigger to obtain exact-candidate conductor evidence.

## Immutable historical results — never relabel as candidate results

| Exact commit / run | Measured evidence | Conclusion |
|---|---|---|
| `cd4ab8dd61ec7353b330ba4a55f1d0ac5f5a9bf0` · [shared 43529253015](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43529253015) | 6/6 CI jobs including real Rust/Anchor/SBPF, real SDK OBS and offline safety tests | **PASS for shared CI only** |
| Same `cd4ab8dd` · [integration 43529253005](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43529253005) | SOL `Custom 6004` and missing all three signed transaction archives; published RAVE Rust 12/12 | **FAIL combined acceptance** |
| `e511e953c41df333c5203de51bd0ad1eb50abcc5` · [integration 43534400698](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43534400698) | Real lifecycle failed `Custom 6004`, witness verifier failed ENOENT for `sprint1-lifecycle-transactions.json`; RAVE Rust succeeded | **FAIL** |
| `6fb7529619050a7c251acc055d7cb6f4b8e69b35` · [SOL 43534619890](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43534619890) | First five lifecycle subtests succeed, sixth independent-wallet test fails `Custom 6004`; isolated init/u64 not executed | **FAIL (latest SOL source)** |
| `ce0fe43dbaab4c709a521197693e52b2ea7176ef` · [shared 43534638668](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43534638668) | Six shared CI jobs | **PASS for CI source only** |
| `17a3623917311fd3ccbe338293f1cd8ce4cb3c7c` · [RAVE 43537089670](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43537089670) | 5/5: minisign/SHA release, RAVE host Rust, Holonix hApp/DNA/WASM, disposable **real Holochain 0.7.1 conductor install/restart and app/cell matching**, inert JS shadow | **PASS for RAVE lane only; no zome call** |

The older real local-validator [partial artifact 14087460958](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43529253005/artifacts/14087460958) contained 24 public-only files, disposable program ID `B8WpDXUeH96FiWYmhqwpF3Hf4MKNagM5XpZJtaVuPvF`, IDL SHA-256 `ea6f78383e6fa9148a560f628fb7648bacede90388a4951c1f158f71c2b2cf83`, ELF SHA-256 `8162421ae2dd56927510d381bbe6c70ce760750e6d53ce2f02683ef106439928`; it lacks complete signed transaction/block archives. Its current-run program/genesis/IDL/ELF hashes **cannot** be reused to validate another disposable build. The SOL-source [partial artifact 14089775376](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43534619890/artifacts/14089775376) had 18 retained files, ZIP SHA-256 `a360760a7e47df769667c0d13490f94cd0b1089f4fe5ae2a211950e98ef7ed3f`; this is diagnostic, not full evidence. RAVE exact-head [conductor artifact 14090421689](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43537089670/artifacts/14090421689) ZIP SHA-256 `b228f0d9a0ea3793740a02d8f14dde579e9e59041b474b36a254f76bd3d9ce45`, independently retained in Actions (14-day retention). Local source SHA/provenance cannot be inferred from ZIP digests alone; preserve both.

## Toolchain and graph locks

Node **22.16.0**; host Rust **1.95.0**; Solana CLI **4.1.2**; Anchor CLI **1.2.2**; SBPF platform-tools **v1.57**, arch **v3**; Observer pinned `@solana/kit 8.6.0`. Published RAVE `rave_engine 0.15.0`, Unyt Sandbox **0.117.0**, actual disposable Holochain **0.7.1**. Four pinned lock SHA-256 digests (workspace Cargo, OBS npm, SOL npm, RAVE Cargo) are frozen in the manifest and verified directly from checked-out bytes. Do not upgrade SDK or toolchains in this integration repair without separate specialist review.

## Acceptance matrix — required at the same exact source SHA

| Required execution / artifact | Status at candidate creation |
|---|---|
| 1. Host Rust, genuine Anchor/SBPF and generated matching IDL | **PENDING new candidate** (previously verified elsewhere) |
| 2. Full real-Kit OBS tests including new validator-witness rejection | **PENDING** (55/55 was older commit) |
| 3. All 25 declared cross-lane offline suites and SEC regressions | **PENDING**; zero skips permitted |
| 4. Three isolated real validator lifecycle modes | **BLOCKED by repeated `Custom 6004`** |
| 5. Retained validator ledger process restart/recovery | **BLOCKED downstream of SOL lifecycle** |
| 6. Same-run SOL signed witness-bundle verifier for all modes | **BLOCKED — missing original complete archives** |
| 7. Complete raw signed `getTransaction`/`getBlock` OBS replay | **BLOCKED on SOL original bytes** |
| 8. Durable OBS checkpoint/ledger reopen/replay/conflict on genuine full history | **BLOCKED on gap-free validator archive and authenticated ledger** |
| 9. Active/refunded/contradictory inert shadow | **OFFLINE-ONLY tested previously; candidate pending; no economic state** |
| 10. Published pinned RAVE Rust | **PENDING candidate** (separate RAVE lane green) |
| 11. Publisher-signed Unyt release, WASM inspection, actual disposable conductor | **PENDING candidate** (separate RAVE source 5/5 green, real cell, no zome calls) |
| 12. Secret, source lock, source blob, archive retention/provenance guards | **PENDING candidate**; newly explicit blob/lock guard |

The SOL CI producer already uploads approved public `unexpected-onchain-*.json` diagnostics under `if: always()`, plus actual IDL, ELF, `*.rpc.json`, separate scenario snapshots/manifests and restart logs **only if written**. Do not claim it uploaded missing files. Require genesis, exact source SHA, disposable program ID, ELF/IDL SHA-256, confirmed included signature, instruction program/account metas, `meta.err`, logs and original base64 JSON-RPC. Distinguish true failure artifacts from a successful witness set. Never archive keypair files, keystore, ledger secrets, Lair socket tokens or transient auth. Current RAVE 0.7.1 conductor test must also preserve redaction of `socket?k=` secrets.

## Independent risks and milestones

**A — reproducible real-validator baseline:** BLOCKED by independent-wallet `Custom 6004`, incomplete 3-mode lifecycle, missing source-authenticated archives, exact-candidate jobs not yet run.

**B1 — real validator → Observer → inert shadow:** BLOCKED. A successful test-only account-state path and signed *synthetic* wire suites do not prove actual signed Solana deposit provenance or gap-free finalized backfill.

**B2 — source-equivalent Unyt zome integration:** BLOCKED **despite** now verified real Holochain 0.7.1 conductor app/cell installation and restart. No approved coordinator zome call, public source/WASM equivalence or two-agent consensus/fork/migration proof.

**C — economically authorized bridge:** STRICT **NO-GO**. First-initializer capture, revocable/refundable deposit collateral, mint/upgrade trust, Solana finality claimed via potentially colluding RPC endpoints, unkeyed locally mutable durable ledger, cross-DNA replay, parked/fork/partition/recovery, source/WASM equivalence, exact u64→i64 conversion and independent authorization are unresolved.

The source-controlled candidate must keep `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false` throughout; no main merge, withdrawals, Holochain issuance or production deployment.

## Specialist handoffs

**SOL #35:** Attribute 6004 by *invoked program ID*, signature, full account metas and program logs; preserve public failure diagnostics before thrown assertions; run first-initializer and u64-max in separate clean ledger modes even when lifecycle fails; prove validator retention restart; archive all original base64 blocks and txs with same-run signatures/program/genesis/ELF/IDL.

**OBS #36:** Reconcile `observer/test/indexer.test.mjs` second-signer diagnostic source fix; consume SOL full signed original witnesses with `replay-validator-witness.mjs`; exercise every signature including unrelated failed block entries, complete getBlocks ranges, persisted ledger reopen and conflict/replay; distinguish consensus from RPC assertions.

**RAVE #34:** Preserve passing actual conductor proof and local identity assertions, keep all artifacts secret-redacted; no B2 until approved read-only source-equivalent coordinator call, 2-conductor finality and recovery negative tests.

**SEC #33:** Backport decodable signature-negative fixture, independently verify on-chain 6004 attribution and immutable off-host checkpoint trust; no self-approval of economic authority.

**CI #32/#37:** New pinned candidate must execute the 6-job shared CI, 3-job validator integration and 5-job RAVE workflow **at the same SHA**. A passing job at a different source SHA cannot be silently inherited.
