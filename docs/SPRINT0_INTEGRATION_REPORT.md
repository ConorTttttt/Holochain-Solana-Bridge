# Sprint 0 integration report — execution checkpoint (13 November 2026)

**Gate verdict: BLOCKED / DRAFT / NOT FOR MAIN.** This report distinguishes observed GitHub Actions results from work that is merely coded or expected to run. Source of truth is CI logs and downloadable public build artifacts, not PR descriptions. There is no production bridge.

## Verified combined execution — completed frozen candidate

**PASS on frozen source commit `6e431e8f9d60f858e79a44793ad65bb0f5bd7911`**: [GitHub Actions run 43504917484](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43504917484) finished with **all three combined jobs successful** (real disposable SOL validator, cross-lane real SDK and actual published RAVE Rust tests). This is the first complete *executable* combined S0 success, not a byte-reproducible release and not approval to issue economic credit.

- SOL: real SBPF + generated IDL, 7/7 exact layout & PDA seed tests, **6/6 local-validator transaction tests**, zero failures/skips; actual local test-token deposit/refund, unauthorized and duplicate operation rejection, active/refunded vault-liability checks.
- SEC: 16/16 adversarial and 7/7 solvency-model tests. RAVE: 12/12 shadow JS, 5/5 attack-model JS and 5/5 genuine published-crate Rust tests. Each suite had zero skips.
- Combined SOL executable SHA256 **`b64595ed6d678ea9fc608b52eafea6f54edc7fdf1e01ef52cd1a150e14ffd45c`**, generated IDL SHA256 **`a40b2584762e9b8f7deb866ef17c23f9844fc957046062d6e547f9ff31a9acb3`**, disposable public program ID **`C4QbizbKeyGvjrsKg3jKVRwTVPhtc7NNS94KAZx1tfA1`**. Public no-key artifact: [integration-localnet-evidence-NO-KEYS](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43504917484/artifacts/14075973129).
- Published `rave_engine=0.15.0` crate archive SHA256 **`7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde`** was independently checked in the newer `57ed7b3` candidate's RAVE job; real harness **5/5 pass** in Actions 43505857690.

**Gates still blocked in that earlier run:** this green snapshot used CI-generated lockfile resolution, not source-committed reviewed locks. Commit `57ed7b34c0f902b90780b3216f24578609132f7b` adds stricter committed-source provenance, actual public account fixture upload, generated-IDL contract verifier, and live OBS-to-Holochain quarantine test. The corresponding runs [43505857598](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43505857598) and [43505857690](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43505857690) have now completed: **43505857690 succeeded with all three jobs**, including **2/2 new real local-validator account-fixture -> Observer canonical verification -> RAVE quarantine/refund-transition tests** (0 failed/skipped), full generated-IDL contract and RAVE 5/5 Rust tests; **43505857598 failed only its newly required provenance job** because its source commit lacked the four tracked locks, while all its other five jobs passed. Subsequent integration commit `39d5a40bad4e12d99bb2a8f595389c273d8f007f` now tracks all four correctly hashed lockfiles and the required provenance job **passed** in Actions 43507244384; its full compiler/validator suites were still in progress at this report revision. The new `--locked` Cargo check/RAVE test changes require further independent CI completion.

### Second genuine validator + Observer handoff snapshot (integrated run)

**GitHub Actions 43505857690, exact source `57ed7b34c0f902b90780b3216f24578609132f7b`** completed **SUCCESS** for all three required integration jobs and published all four public active/refunded receipt fixtures, including two-receipt accounting cases. Its generated SBPF SHA256 was **`311440cab7605156dd4312840509a1bf203f883f161dcc2e825483e0754354d1`**, generated Anchor IDL SHA256 **`f3d5d0450dd63ee9d5abd5b7eefcaba59f82d69f0a7af07f0f3160542c6da3cb`**, local disposable program ID **`3is7Xo84UkRpZR1aMiGynpAF2zvh3uWKYApUaQhvQ2G5`**. The public, no-secret artifact [integration-localnet-evidence-NO-KEYS](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43505857690/artifacts/14076617277) was downloaded and verified directly. This is a separate disposable run from the earlier `6e431e8` snapshot (different program IDs explain different compiled binary hashes).

| Real four-account state | Slot | Nonce | Deposited amount | Vault balance | Active liabilities | Refunded? |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| After deposit | **33** | 42017 | 250000 | 250000 | 250000 | no |
| After refund | **67** | 42017 | 250000 | 0 | 0 | yes |

Deposit signature: `5hpG33sm4AhDiMhVnASCZJkcsSxETx1cmoQjiCXPUvEkbwGqjS8pJhPAGFX52i4zjAFLf555kwFNfF5BiV7agXiS`.

Refund signature: `122Zvf4Vunqo7NKCpMf71rwdGEkVoayqC6ZQWf4fbCUtSNzzBmCyaoCPSWVsEj8aJsm9mFEeZD1DcHLabFmatBRa`.

Receipt PDA `2uCuUTD66U29ec73nbzVgV4Eys7ywD5cbt4x7WighQJv`, config PDA `EpazE9t8n9m7jBNFZD1VR2y17JfLBBdYCxeSnpgVjTF`, vault PDA `4QQ132CdVNwaKymNvmUoo1oeWGbHSsKmdVgPRcW2CpqY`, mint `xjCwaaU5cwmX7RzHuX9frztJGHQ5J1c9y4NAPSVrAG6`. Two additional five-account multi-receipt snapshots occurred at slots **103** and **136** (the shadow verifier's single-receipt four-account contract is intentionally not called on a five-account bundle). These values are RPC-reported local-validator evidence; **not independent consensus or Holochain settlement proof**.

### Captured real public transaction and account evidence

From the independently [successful SOL local-validator run 43499386297](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297/artifacts/14073462857) (source `bc4c907`, not the newer combined source), actual localnet public evidence was downloaded and decoded directly:

| Step | Finalized RPC observation slot | Receipt nonce | Receipt amount (base units) | Vault (base units) | Active liability | Refunded flag |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| After deposit | **33** | 42017 | 250000 | 250000 | 250000 | false |
| After refund | **67** | 42017 | 250000 | 0 | 0 | true |

Deposit signature: `5n2zYM3uEhP4EGLHRJWT8f2wYaR55TC1z3gygcevZe47jkrN4Nd3kgACYL9abv1jN96qkMg9AFLSrCAsUWMkE5eQ`.

Refund signature: `67rG62EX4xiDnCb6uqfmZyZwuwsFNbfnoSbuRPs2FP4gSfhE6KNRRTuBxUkvkCHAyeaA9bTKVZ4uNNwWoJsRPdC9`.

Chain genesis `FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8`; local program `FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG`; receipt `BdR4H8M6pYafRkmEM57ydhH4yGKw2q1KokyvUkxLZ2VH`; config PDA `8cgyh99E7fmUyAFshwss8ZQZacpxWTyCm1ApFJFC7999`; vault `FsTLDdsAHYtbFCRXk1Px6mi47t1tYQadF42qQP5DWebT`; mint `7t6r6MTjf6RBMoLtkPmEpK9RkG3fdw28JoimYP61hKy9`. These are *disposable local validator* public IDs, **not** mainnet assets or a chain-independent proof of finality. The mint supply remained 1,000,000 base units in both four-account snapshots. The archive contains public account bytes but no private keys.

**Reproducible build nuance:** every localnet run deliberately generates a fresh disposable program ID, which is embedded in program bytes and IDL; consequently binary/IDL SHA256 values are expected to differ across independent runs even with identical Rust source/dependency graph. True byte-for-byte comparison requires holding the public program-ID input fixed without committing, publishing or reusing private signing material. The Git-tracked lock/provenance gate is required regardless.

### Newer specialist heads outside this frozen S0 snapshot

At follow-up review, SOL advanced to `e16c7245f8c309fefa03916bc3a9449e1ab2e565` (three isolated validator scenarios including initialize capture and full-u64), OBS to `55180ca377c85b015004bb3e869f6262b9f5a607` (new untrusted finalized transaction/indexer and durable single-writer checkpoint APIs), RAVE to `35c2165569b900c69b3f02d02abb0eb4baf502f2` (test-only shadow adapter), and SEC to `36bf8836d63556a69da5dd211babb3892034143a` (additional adversarial tests). **These new commits are NOT covered by green integrated commit `6e431e8`** and require a distinct frozen candidate after owners certify their changes. This is intentional to avoid cancelling/rebuilding previously frozen expensive runs. Source owners were contacted on PRs #33–#36 to review locks and new interfaces.

## Frozen source inputs and ownership

| Lane | Existing PR | Source branch | Checked specialist commit |
| --- | --- | --- | --- |
| CI | #32 | `agent/ci/11-build-pipeline` | `f54146671a6f204e8d7ab860244e4089f43f3dd1` (latest overlaid code; original passing 6e431e8 used earlier `ab0d9a9...` code) |
| SOL | #35 | `agent/sol/7-anchor-build` | `37b35301bf3f6a3773b3c0b27e01370715f67b74` |
| OBS | #36 | `agent/obs/8-observer-validation` | `56e379187fa29b3a662203e99b06ae01069cabb3` |
| RAVE | #34 | `agent/rave/9-rave-validation` | `cacd7932e7700b157a5e2f8077a034970b8de2f3` |
| SEC | #33 | `agent/sec/10-threat-model` | `29d64efd3ae3f8b92dc03d76c2e8af602f22904f` |

The integration candidate is PR #37, branch `integration/s0/11-all-agent-snapshot`. The checkout of each new run is pinned by `github.event.pull_request.head.sha`; retrieve the exact source SHA from its `ci-artifacts/source-commit.sha` artifact. These specialist SHA values are overlay source versions, **not** signatures, merge approvals, or a claim that the branches were merged. Base CI source was first `ecc0b4b...`, then `ab0d9a9...` in the earlier green S0 build; this checkpoint overlays current CI `f54146671a6f204e8d7ab860244e4089f43f3dd1` as described in `ci-integration-snapshot.json`. `af8e09319f88f013fc9a30892173b4a7d7514349` is the most recent integration implementation candidate before this report-only correction; its `--locked` compilation workflows were in progress at this checkpoint.

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

**Lock gate update:** Since the older evidence runs, all four authentic lockfiles have been **committed to the integration candidate**, and `Cargo.lock` was also committed to CI PR #32. The mandatory source-provenance job has now **passed** on integration Actions 43507244384: every lock is Git-tracked and its SHA-256 matches the reviewed artifact hash. CI now explicitly runs `cargo check --locked`; the integration crate harness runs `cargo test --locked`, and CI's Observer/SOL dependency installation uses `npm ci`. **Remaining limitations:** SOL's own `tests/solana/localnet-build.sh` still invokes `npm install` (requested source-owner change); SOL/OBS/RAVE source branches have not independently adopted and approved their lockfiles; and deterministic repeatable SBPF bytes are not possible when ephemeral public program ID intentionally varies. Approved source-owner commits, strict localnet `npm ci`, supply-chain install checksum reviews and rerun evidence remain open.

## Required test matrix (real completed evidence vs blocked)

| Check | Evidence | Measured outcome |
| --- | --- | --- |
| SOL disposable validator lifecycle, older source | Actions 43499386297 | **PASS**, 6/6 transaction tests |
| SOL localnet, newer integrated source | Actions 43504917484 (replacing the cancelled 43503058360 candidate) | **PASS**, 6/6 real transactions plus 7/7 generated-IDL layout; previous candidate was cancelled |
| SOL layout on real generated IDL | Actions 43499276656 | **PASS**, 7/7 in compile job; its end-to-end lifecycle failed |
| SOL layout when downloaded IDL missing | Actions 43503058360, cross-lane job | **FAIL required gate**: 6 pass, 1 skipped |
| Observer with real `@solana/kit` | Completed integrated cross-lane runs | **PASS**, 20/20 unit tests; 5 synthetic IDL contract tests are not real-IDL proof |
| Security observer-backed adversarial | Actions 43503058360 | **PASS**, 16/16 |
| Security solvency-model | Actions 43503058360 | **PASS**, 7/7 (model only) |
| RAVE JS quarantine & replay/attack models | Actions 43503058360 | **PASS**, shadow 12/12 and attack 5/5 (offline only) |
| RAVE published 0.15.0 Rust harness | Actions 43503058360 | **PASS**, 5/5 (host-only crate) |
| Full S0 combined test workflow (before new provenance/evidence replay gates) | Actions 43504917484, source 6e431e8 | **PASS**: all three jobs succeeded; no required test skips; reproducibility remains unapproved |
| Real validator account bytes -> canonical OBS -> RAVE shadow | Actions 43505857690 / code `57ed7b34` | **PASS**: 2/2 true local-validator fixture tests, 0 skipped; no economic credit |
| Reviewed lockfile provenance | Integrated Actions 43507244384 | **PASS** all four Git-tracked lock SHA256 checks; separate source-owner branch adoption remains open |
| Unyt deployed DNA, parked-link recovery, source-finality attestation | Not executed | **NOT TESTED; economic P0 stop** |

Earlier error signatures: Anchor CLI failed under Rust 1.89 / 1.91 due `cargo-platform` and `solana-sbpf::Layout::dangling_ptr`; resolved compiler pin is Rust 1.95.0. CI run **43502640348** failed *before compilation*: `anchor keys sync` reserialized `Anchor.toml` beyond the public ID and the integrity guard correctly rejected it. CI PR #32 now performs exact public-ID substitution and preserves the source guard. Intermediate PR37 runs against `00f9bc29f17e77e5feda524bd9ed8cfeaadd1f7e` were **cancelled**, not passes.

## Remaining security limitations

Refundable SOL collateral is **never** spendable Holochain credit. Preserve `creditEligible: false`, `CREDITING_DISABLED`, `WITHDRAWALS_DISABLED`, read-only RPC evidence and host-only shadow review. No trusted finalized transaction inclusion/transaction-version-v1 indexer, two-independent-trust consensus proof, durable replay journal, parked-link fork/recovery/migration settlement proof, independent upgrade governance, deployed Unyt DNA, on-chain withdrawal authorization or production redemption exists. Conservation requirement remains `B >= F + H + W + O` with liabilities counted exactly once. No real funds, mainnet, production custody or credit issuance.

## Next-owner handoff / Sprint 1 readiness

**Decision: READY FOR NON-ECONOMIC SPRINT 1 DEVELOPMENT ONLY; NOT READY FOR ECONOMIC SETTLEMENT OR S0 EXIT SIGN-OFF.** SOL should commit reviewed root/SOL locks and rerun enhanced real validator coverage; OBS should commit npm lock and ship finalized transaction + block evidence with explicit trust and durable checkpoints; RAVE should commit its crate lock and consume OBS observations in shadow only; SEC should attack refund-after-observation, false finality, replay across restarts/agreement migration, signer/authority substitution and review new fixture paths independently. CI owns frozen-sha runners, downloaded genuine IDLs, provenance checks, logs and reviewed artifact hash table. Sprint 1 pipeline target: `Solana deposit -> finalized transaction evidence (untrusted until independently verified) -> Holochain quarantine record -> reconciliation`. Never enable economic side effects.
