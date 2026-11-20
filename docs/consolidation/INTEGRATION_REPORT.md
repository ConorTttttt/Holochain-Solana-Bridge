# Integration report: mainline consolidation, 20 November 2026

**Base:** `main` `e1651fec77f1ed5c5f8e760e486c8757adc5e69c`, re-verified live against GitHub before any change.
**Branch:** `claude/holochain-solana-consolidation-3l2lqm` → draft PR #68 into `main`.
**Result:** one coherent tree. 37 of the 39 pre-existing branch heads are now Git ancestors; the two that are not are explained in §4.

## 1. What the starting state actually was

- **#67 `d0409a1`** was the most complete integration. Its manifest pinned specialist sources: SOL #55 `c071e4c`, OBS #57 `38847cf`, RAVE #65 `7ccee3d`, SEC #53 `da98cc2`. It was integrated by **copying blobs**, not by merging specialist branches.
- **Twelve branch tips** were not contained in any other branch: #67, #62, #48, closed #60, #44, #65, #33, #53, #64, #63, #47 and #42.
- **Newer specialist work missing from #67**, found by three-way file classification:
  - **OBS #59/#62**: nested economic-denial enforcement on rehashed v2 witnesses, pinned proof-kind fields, UTF-8 byte bounds, and the replay-guard regression.
  - **RAVE (#34 → #65)**: four-field literal denial checks in the shadow reviewer, plus an inert duplicate journal. #67 carried **older** 13-Nov frozen copies of `holochain/{shadow-review,transaction-shadow,test-only-adapter}.mjs` and their tests.
  - **SEC #33**: 13 independent-review evidence records, the attestation ADR, `verify-signed-operations.mjs`, `external-checkpoint-reference.test.mjs`, and a revised 6004 review.
  - **SOL #63/#64**: the exact original PR55 evidence ZIP and its verifier. **SOL #47**: the archive producer. **SOL #42**: research ADRs.
  - **RAVE #44**: a competing coordinator fix, the historical install record, and an install workflow (see §3).
- **Three workflows** (`integration-snapshot`, `a0-own-dna-runtime`, `a0-dependency-bootstrap`) could run **only** on PRs into `agent/ci/11-build-pipeline`. That made it impossible to produce same-run evidence for any PR into `main`.

## 2. Integration steps (first-parent history, in order)

| # | Commit | Operation | Conflicts | Resolution |
|---|---|---|---|---|
| 1 | `c06886a` | merge #67 `d0409a1` into main | none (skills byte-identical) | tree == #67 tree |
| 2 | `b904c88` | merge OBS #62 `e70a178` | 4 add/add: `observer/src/demo-witness-v2.mjs`, `observer/src/v2-binding-review.mjs`, `observer/test/demo-outbox.test.mjs`, `observer/test/v2-binding-review.test.mjs` | **theirs**. #67's blobs equal #57's; #62's are strict supersets (6-file security delta only) |
| 3 | `2b10aa0` | merge SEC #53 `da98cc2` | none | tree unchanged; fixtures already identical |
| 4 | `bc43e92` | merge RAVE #65 `7ccee3d` | 11 add/add | see §3 table A |
| 5 | `d1df64b` | merge RAVE #44 `f0c0ec0` | 1 content: `holochain/demo/coordinator/src/lib.rs` | **ours (#65)**, see §3 table B |
| 6 | `b8b5a83` | merge SOL #64 `768f463` | none | adds the original ZIP, review doc and 2 workflows (retired in step 11) |
| 7 | `2db4d41` | merge SOL #63 `02a89b7` | none | adds verifier and epoch-HOLD review |
| 8 | `0f6aa1c` | merge SOL #47 `9d62b8e` | none | adds producer, test, handoff doc and 1 workflow (retired in step 11) |
| 9 | `a77a103` | merge SOL #42 `f2491e0` | none | 2 research ADRs |
| 10 | `45f75fc` | merge SEC #33 `53bc411` | 2 add/add | see §3 table C |
| 11 | `3501e84` | CI consolidation (commit) | — | §5 |
| 12 | `58c42d9` | provenance re-pin (commit) | — | SOURCE_PROVENANCE.md |
| 13 | `8bf0d74` | merge OBS #36 `2931c5f` | 4 add/add (`observer/package.json`, `observer/src/indexer.mjs`, `observer/test/indexer.test.mjs`, `observer/test/ledger.test.mjs`) | **ours**; resulting tree asserted identical to parent (content identical or superseded) |

No test was deleted, skipped or weakened. No assertion was relaxed to make a merge pass.

## 3. Security-relevant conflicts and decisions

### A. RAVE #65 merge (11 add/add, merge base `4da2eee`)

| Path | #67 (ours) | RAVE (theirs) | Chosen | Why | Trust-boundary impact | Proving tests |
|---|---|---|---|---|---|---|
| `holochain/shadow-review.mjs`, `transaction-shadow.mjs`, `test-only-adapter.mjs` | 13-Nov copies: deny `creditEligible` only (plus partial checks) | 14-Nov: require all four literal denials at evidence **and** receipt layer; duplicate diagnostics use a cloned journal | **theirs** | Strictly stronger. OBS `verifySnapshot` / `transaction.mjs` already emit all four literals | Holochain shadow intake now rejects any escalation of `independentConsensusVerified`, `spendableBaseUnits` or `withdrawalAuthorized` | rave-shadow 13, rave-transaction-shadow 9, rave-test-only-adapter 7, rave-provenance-journal 5; same-run handoff in CI |
| `tests/holochain/{shadow-cli,shadow-review,test-only-adapter,transaction-provenance-journal,transaction-shadow}.test.mjs` | fixtures without the three extra denials | fixtures plus new negative tests | **theirs** | supersets | — | as above |
| `tests/holochain/sandbox/probe-verified-unyt-conductor.sh` | redacts only `socket?k=` in 2 logs | redacts token/passphrase/password/secret in **all** retained logs | **theirs** | stronger secret hygiene | logs only; the script itself is not run by this PR | — |
| `.github/workflows/rave-unyt-release.yml` | integration-only trigger patch (pinned `integrationOnlyProvenance`) | original trigger list | **ours** | differs only in triggers; neither list includes `main` or this branch | none | provenance verifier |
| `holochain/demo/dna.yaml` | template, re-written per run by `demo/a0-bind-same-run-dna.mjs` | hard-coded properties from archived SOL run 14118166967 | **ours** | Building with properties from a **different** Solana execution is prohibited. The same-run binder derives them from the run being built | prevents DNA scope being bound to unrelated evidence | a0-bind-same-run-dna tests; same-run job |

### B. Competing coordinator fixes (#44 vs #65; both fork at `c6b60ac`)

```rust
// #44 16b60ea (NOT adopted)
.map_err(|_| wasm_error!(WasmErrorInner::Guest("invalid local audit entry serialization".into())))?;
// #65 f34fc17 (adopted, blob 3feb1b85)
.map_err(|err| wasm_error!(err))?;
```

**Chosen: #65.** It is the blob pinned in the manifest and compiled by the green same-run build at #66 (run 43648980986). It is also what #67's original-artifact inventory describes, and it pairs with #65's `build.sh` fix (call pinned Holonix `rustc` / `cargo` directly; `cargo +1.95.0` exits 101 inside Holonix). #44's `build.sh` lacks that fix.

**Impact:** #44's variant avoids echoing the deserializer error text. `local_records()` is a read-only coordinator function over entries the integrity zome has already validated, and the error reaches only the local caller. Severity is low.

**Independent review required:** RAVE / SEC should decide whether to adopt the redacting variant. Doing so will change the coordinator WASM and hApp hash, but not the DNA hash, which covers integrity zomes only.

### C. SEC #33 merge (2 add/add)

| Path | Chosen | Why |
|---|---|---|
| `security/evidence/2026-11-14-6004-authenticated-ledger-independent-review.md` | **theirs (#33)** | SEC's later revision (+65 / −2): historical-baseline label, corrected conductor-install statement, appended §7 follow-up |
| `security/test/transaction-provenance-adversarial.test.mjs` | **ours (`f16e461`, `integrationOnlyProvenance`)** | SEC's copy mutates the **trailing compact instruction count**, so the wire becomes undecodable and the "invalid Ed25519" assertion is never genuinely reached. The integration patch flips a recent-blockhash byte, which keeps the message decodable and actually exercises Ed25519. The SEC lane has not back-ported it; **the backport remains open** |

## 4. Not merged (explicitly deferred)

### PR #48 `3258cb9` (OBS v1 outbox): PARTIALLY_INCLUDED

- **Included through #52:** commits up to `220d5aa` (12:41 on 14 Nov), including `046f0eb`, `5acc481` and `96be966`. All are present in `observer/src/demo-outbox.mjs`.
- **Superseded:** the v2 proof contract (`37f6101`, `c01f761`, `c14719a`, `a441364`, `3258cb9`). The OBS lane's own #62 decision register adopts a **single strict typed v2** (`AuditObservationV2`). Merging #48 would introduce a second, competing v2 schema.
- **Durable returned ActionHash / terminal HOLD (`63403b8` + test `cafc19e`): NOT included.** `git cherry-pick -x 63403b8` conflicts in `observer/src/demo-outbox.mjs`. Applying only the test (`cafc19e`) on the consolidated outbox gave **156/158**: `not ok 18 … ActionHash contradiction is durable HOLD` and `not ok 46 … restart retains returned ActionHash …`. The consolidated outbox therefore **lacks** this protection.
  - Runtime impact today: none. `client.write` is never reached, because transport is refused and no Holochain write is authorized.
  - It is a **hard precondition before any v2 transport activation**. Owner: OBS. Reviewer: SEC.
- **Path-scoped `uiAmount` (`b29e469`, `3288d11`, `2802d95`): NOT included.**
  - #52's canonicaliser (13:10) accepts any finite non-integer number anywhere.
  - #48's (13:53) keeps generic canonical JSON integer-only and allows fractions **only** at `uiTokenAmount.uiAmount`, rejecting −0.
  - A cherry-pick applies textually but does not restore the generic strictness, so it would be an incomplete port. Owner: OBS. Reviewer: SEC.
- #48's head has **no CI run**.

### PR #60 `b869da9` (closed)

Superseded by #61's `demo/a0-bind-same-run-dna.mjs`, which is included. Its 9 unique commits remain on its branch.

## 5. CI consolidation (`3501e84`)

- **Retargeted** `integration-snapshot.yml`, `a0-own-dna-runtime.yml` and `a0-dependency-bootstrap.yml` to `pull_request: branches: [main, agent/ci/11-build-pipeline]`. No step, gate or assertion changed.
  - The same-run install steps remain `if: ${{ false }}`.
  - A0's install job remains `if: ${{ false }}`.
  - A0's build gate still exits **3** with `BLOCKED_NOT_ACCEPTED`. That is intentional.
- **Retired from `.github/workflows/`** (their blobs remain at the source commits):

  | File | Source | Reason |
  |---|---|---|
  | `agent4-real-build.yml` | #44 | `contents: write`, `persist-credentials: true`; runs `a4-install-readonly.sh` = sandbox install with external Lair (**cell genesis + keystore provisioning**) |
  | `holochain/demo/a4-install-readonly.sh` | #44 | only caller was the workflow above |
  | `sol-pr55-preserve-original.yml` | #64 | `contents: write` + `git push`; its job is complete |
  | `sol-verify-temporary.yml` | #35 → #55 | self-described TEMPORARY; SOL-branch-only triggers; superseded by the integration validator job |
  | `sol-archive-producer-test.yml` | #47 | #47-branch-only trigger; suite moved into shared CI |

- **Coverage added**, all offline and synthetic:
  - Six suites registered in `scripts/ci/run-cross-lane-tests.mjs`: 26 tests. `sol-confirmation-recovery` and `sol-demo-scope` were previously executed by **no** workflow.
  - New `ci.yml` job `preserved-original-evidence`.

## 6. Cross-lane failures investigated

| Observation | First failing command | Root cause | Status in consolidation |
|---|---|---|---|
| Shared CI red at OBS heads #52 `a2338f9` (run 43603678118), #57 `38847cf` (43630245420), #59 `52bd850` (43638549456), #62 `e70a178` (43645338510) | `node scripts/ci/run-cross-lane-tests.mjs` → `CROSS_LANE_SUITE_FAILED: security/test/replay-ledger-adversarial.test.mjs` and `ledger-corruption-boundary.test.mjs`, error `Indexer ledger failed: invalid or authoritative deposit evidence` (reproduced locally at `e70a178`) | The OBS lane branches carry **stale SEC fixtures** (`67aa4fc`, `a2087d3`) that predate OBS #52's stricter ledger. SEC #53 updated them (`945afbe`, `2d48b41`) | **Resolved.** The consolidation carries #53's fixtures and both suites pass. **No OBS protection was relaxed** |
| A0 own-DNA gate red at #54 / #56 / #58 / #60 / #61 / #66 and at this branch | `node demo/a0-runtime-gate.mjs --require-build` → exit 3 | Intentional: five authorization / review blockers (TEST_RESULTS.md) | **BLOCKED by design**; must not be bypassed |
| #61 `integration-snapshot` red at `baa9f16` | job `132589205296` failed on `OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN`, as recorded in `observer/docs/OBS_A3_A4_REPLAY_AND_V2_FREEZE_CANDIDATE_2026-11-14.md` (not re-read from the job log here) | replay-guard opt-in policy | Addressed by #62's Node-test-child opt-in and #66's invocation (#66 run 43648980986 green); both included |

## 7. Invariants re-checked after integration

- **Evidence gate unchanged.** `holochain/evidence-gate.mjs` is byte-identical to `main` (`ffd7a081`), and both functions throw unconditionally.
- **Policy fields unchanged.** `ci-integration-snapshot.json › nonEconomicPolicy` = `{creditEligible:false, independentConsensusVerified:false, spendableBaseUnits:"0", withdrawalAuthorized:false}`, enforced by `verify-integration-provenance.mjs`. `candidate.status` stays `UNVERIFIED_NO_GREEN_CLAIM`.
- **No new path can mutate Holochain.** The remaining install script (`scripts/ci/a0-own-dna-install-readonly.sh`) is reachable only from jobs and steps hard-disabled with `if: ${{ false }}`. `scripts/installation/execute-approved.mjs` requires a verified, independently signed one-use grant and is invoked by no workflow.
- **Historical authorization material unchanged.** `demo/installation/evidence/installation-request.prepared.json` is unchanged, `requestState: CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED`.
- **No secret material added.** The repository guard passes (TEST_RESULTS.md).
