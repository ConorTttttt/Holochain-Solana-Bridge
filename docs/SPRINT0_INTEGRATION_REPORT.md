# Sprint 0 integration report — execution checkpoint (13 November 2026)

**Gate verdict: BLOCKED / DRAFT / NOT FOR MAIN.** This report distinguishes observed GitHub Actions results from work that is merely coded or expected to run. Source of truth is CI logs and downloadable public build artifacts, not PR descriptions. There is no production bridge.

## Frozen source inputs and ownership

| Lane | Existing PR | Source branch | Checked specialist commit |
| --- | --- | --- | --- |
| CI | #32 | `agent/ci/11-build-pipeline` | `ab0d9a9205b3c669894bbc78a02e9af289f95b10` |
| SOL | #35 | `agent/sol/7-anchor-build` | `37b35301bf3f6a3773b3c0b27e01370715f67b74` |
| OBS | #36 | `agent/obs/8-observer-validation` | `56e379187fa29b3a662203e99b06ae01069cabb3` |
| RAVE | #34 | `agent/rave/9-rave-validation` | `cacd7932e7700b157a5e2f8077a034970b8de2f3` |
| SEC | #33 | `agent/sec/10-threat-model` | `29d64efd3ae3f8b92dc03d76c2e8af602f22904f` |

The integration candidate is PR #37, branch `integration/s0/11-all-agent-snapshot`. The checkout of each new run is pinned by `github.event.pull_request.head.sha`; retrieve the exact source SHA from its `ci-artifacts/source-commit.sha` artifact. These specialist SHA values are overlay source versions, **not** signatures, merge approvals, or a claim that the branches were merged. Base CI source was previously `ecc0b4b...`; this checkpoint overlays later CI commits as described in `ci-integration-snapshot.json`.

## Verified toolchain, builds and local-validator evidence

- Pinned host: Rust **1.95.0**, Anchor CLI/program **1.2.2**, Solana CLI/test-validator **4.1.2**, SBPF platform-tools **v1.57**, SBPF architecture **v3**, Node.js **22.16.0**.
- Real integration compile artifact: Actions **43499276656**, eBPF ELF **221,624 bytes**, SHA-256 `0a07b91b039de5098c0ab6b048f66831750f589f3bcdc28aa4a5adf7a809b066`; IDL SHA-256 `966ae71537239dc3008a123e0a94a2a3052016598f609ed2ac32cf92845f37ad`. Its real lifecycle subsequently **failed** under the older SOL ATA fixture; compiler success alone is not an end-to-end pass.
- Separately **PASSED** on actual disposable local validator: SOL Actions **43499386297**, source commit `bc4c907a4fc8e0ef5af073c06285ad248225f017`. Real binary SHA-256 `ddbc9a56d1d7d2d0edc55153f099ed016dc6a26b30057b7bd8703c8ac7dd9dd5`, IDL SHA-256 `a81ccda8b91e90d1522cc922bac88aecae71e872d4b22ead9196ccceaf9d41f9`. **6 passed / 0 failed / 0 skipped** actual localnet transaction tests; generated-IDL layout **6 passed / 1 OBS-only skipped** because OBS branch was absent. Local-only program ID `FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG`. Real public ledger signatures, observed slots, PDA bumps and four account bytes are in Actions artifact **14073462857** for that run; do not substitute invented signatures or slots.
- Later SOL source at `37b3530...` adds multi-receipt and stronger rollback/IDL assertions after the passing run. **Its complete newer assertions have not been certified by that older run.** Re-run required.
- Genuine RAVE published crate execution in integration Actions **43503058360**: **5 passed / 0 failed** Rust tests, pinned `rave_engine=0.15.0`, not deployed DNA. The job recorded lock SHA-256 `e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001`.

## Dependency approval vs source reproducibility

Approved observed generated lockfile SHA-256 values (all from real GitHub Actions artifacts, not fabricated):
| Scope | Lock | SHA-256 |
| --- | --- | --- |
| Workspace | `Cargo.lock` | `9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5` |
| Observer | `observer/package-lock.json` | `87578ffa1a3f0d1f0102f58ac649e25cd2a9d2902889bc946213fb2f136f0f62` |
| SOL Node | `tests/solana/package-lock.json` | `24ad69597db242528c87a98d8bc2299574e09eb52e77e026281db01e1c9889c6` |
| RAVE Rust | `tests/holochain/rave-engine/Cargo.lock` | `e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001` |

**Open hard blocker:** None of the four locks are source-tracked at this checkpoint. The new `scripts/ci/verify-source-locks.sh` and required provenance job reject missing, untracked or digest-drifting lockfiles. Test jobs continue separately for diagnostic evidence; a passing generated-hash comparison **does not** establish Git-tracked input provenance, `npm ci` across a clean checkout, offline installation or byte-for-byte reproducible binary output. SOL/OBS/RAVE must inspect and commit their own authentic resolved lockfiles. Root Cargo ownership: SOL with CI review.

## Required test matrix (real completed evidence vs blocked)

| Check | Evidence | Measured outcome |
| --- | --- | --- |
| SOL disposable validator lifecycle, older source | Actions 43499386297 | **PASS**, 6/6 transaction tests |
| SOL localnet, newer integrated source | Actions 43503058360 | **CANCELLED**; not a pass |
| SOL layout on real generated IDL | Actions 43499276656 | **PASS**, 7/7 in compile job; its end-to-end lifecycle failed |
| SOL layout when downloaded IDL missing | Actions 43503058360, cross-lane job | **FAIL required gate**: 6 pass, 1 skipped |
| Observer with real `@solana/kit` | Completed integrated cross-lane runs | **PASS**, 20/20 unit tests; 5 synthetic IDL contract tests are not real-IDL proof |
| Security observer-backed adversarial | Actions 43503058360 | **PASS**, 16/16 |
| Security solvency-model | Actions 43503058360 | **PASS**, 7/7 (model only) |
| RAVE JS quarantine & replay/attack models | Actions 43503058360 | **PASS**, shadow 12/12 and attack 5/5 (offline only) |
| RAVE published 0.15.0 Rust harness | Actions 43503058360 | **PASS**, 5/5 (host-only crate) |
| Full S0 integrated workflow | Latest snapshot runs | **NOT YET VERIFIED GREEN**; compiler/validator cancellations and missing-IDL skip observed |
| Real validator account bytes -> canonical OBS -> RAVE shadow | New CI integration check in this PR | **UNVERIFIED PENDING RUN**; never credited as passing before CI evidence |
| Reviewed lockfile provenance | New required CI job | **BLOCKED** until all source owners commit locks |
| Unyt deployed DNA, parked-link recovery, source-finality attestation | Not executed | **NOT TESTED; economic P0 stop** |

Earlier error signatures: Anchor CLI failed under Rust 1.89 / 1.91 due `cargo-platform` and `solana-sbpf::Layout::dangling_ptr`; resolved compiler pin is Rust 1.95.0. CI run **43502640348** failed *before compilation*: `anchor keys sync` reserialized `Anchor.toml` beyond the public ID and the integrity guard correctly rejected it. CI PR #32 now performs exact public-ID substitution and preserves the source guard. Intermediate PR37 runs against `00f9bc29f17e77e5feda524bd9ed8cfeaadd1f7e` were **cancelled**, not passes.

## Remaining security limitations

Refundable SOL collateral is **never** spendable Holochain credit. Preserve `creditEligible: false`, `CREDITING_DISABLED`, `WITHDRAWALS_DISABLED`, read-only RPC evidence and host-only shadow review. No trusted finalized transaction inclusion/transaction-version-v1 indexer, two-independent-trust consensus proof, durable replay journal, parked-link fork/recovery/migration settlement proof, independent upgrade governance, deployed Unyt DNA, on-chain withdrawal authorization or production redemption exists. Conservation requirement remains `B >= F + H + W + O` with liabilities counted exactly once. No real funds, mainnet, production custody or credit issuance.

## Next-owner handoff / Sprint 1 readiness

**Decision: READY FOR NON-ECONOMIC SPRINT 1 DEVELOPMENT ONLY; NOT READY FOR ECONOMIC SETTLEMENT OR S0 EXIT SIGN-OFF.** SOL should commit reviewed root/SOL locks and rerun enhanced real validator coverage; OBS should commit npm lock and ship finalized transaction + block evidence with explicit trust and durable checkpoints; RAVE should commit its crate lock and consume OBS observations in shadow only; SEC should attack refund-after-observation, false finality, replay across restarts/agreement migration, signer/authority substitution and review new fixture paths independently. CI owns frozen-sha runners, downloaded genuine IDLs, provenance checks, logs and reviewed artifact hash table. Sprint 1 pipeline target: `Solana deposit -> finalized transaction evidence (untrusted until independently verified) -> Holochain quarantine record -> reconciliation`. Never enable economic side effects.
