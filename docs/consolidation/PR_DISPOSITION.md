# PR disposition

**Nothing here closes, merges or modifies any existing PR or branch.** These are recommendations. Act on them only **after #68 has merged into `main`** and the owning lane has confirmed.

Branches should be kept. They are the original provenance record, and every included head below is a Git ancestor of #68, so deleting a branch loses nothing from history. Branch deletion is still the owners' decision.

Classes: INCLUDED_IN_CONSOLIDATION · PARTIALLY_INCLUDED · REQUIRES_INDEPENDENT_REVIEW · STILL_ACTIVE · SUPERSEDED · HISTORICAL_RESEARCH · BLOCKED. A PR can carry a primary class plus a qualifier.

"Incorporated how" refers to merge commits on `claude/holochain-solana-consolidation-3l2lqm` (INTEGRATION_REPORT.md §2). "Ancestor" means `git merge-base --is-ancestor <PR head> <#68 head>` holds.

## Summary

- **36** PRs reviewed: 35 open drafts plus closed #60.
- **34** PR heads are Git ancestors of #68: every PR except #48 and the closed #60.
  - Content-wise, 33 of these are fully included.
  - #44 is PARTIALLY_INCLUDED by deliberate exclusion: its install workflow and script, plus its coordinator variant.
- **1** partially incorporated without ancestry (#48): its early commits reached #68 through #52. Its two later fixes (durable returned ActionHash with terminal HOLD, and path-scoped `uiAmount`) were **ported** by the integration in `98db651` (2026-11-20). They are pending OBS + SEC review.
- **1** closed and superseded (#60).
- **Fully or partially incorporated: 35 of 36.**

## Specialist / foundation PRs

| PR | Primary class | Incorporated how | Remaining unmerged changes | Recommendation (after #68 merges) |
|---|---|---|---|---|
| #32 CI foundation | INCLUDED_IN_CONSOLIDATION | ancestor via #67 merge `c06886a` | none | close as superseded by #68 |
| #33 SEC threat model | INCLUDED_IN_CONSOLIDATION | merged `45f75fc` | `security/test/transaction-provenance-adversarial.test.mjs`: #68 keeps integration fix `f16e461`. SEC should back-port it or record acceptance | SEC confirms, then close |
| #34 RAVE foundation | INCLUDED_IN_CONSOLIDATION | ancestor via #65 merge `bc43e92` | none | close |
| #35 SOL foundation | INCLUDED_IN_CONSOLIDATION | ancestor via #64 merge `b8b5a83` | none (superseded by #38→#55) | close |
| #36 OBS foundation | INCLUDED_IN_CONSOLIDATION | merged `8bf0d74` (tree unchanged) | none | close |
| #38 SOL independent review | SUPERSEDED (included) | ancestor | none. The SEC review "CHANGES REQUIRED" items were addressed by #40/#43/#50; independent re-approval is still absent | close after SEC confirms remediation |
| #40 SEC-38 re-review | SUPERSEDED (included) | ancestor | none | close |
| #42 Custody ADR | HISTORICAL_RESEARCH (included) | merged `a77a103` | none (docs only; NOT implemented) | close; ADR stays as research record |
| #43 SEC-38 flags | SUPERSEDED (included) | ancestor | none | close |
| #44 RAVE audit DNA + HAM | **PARTIALLY_INCLUDED** + REQUIRES_INDEPENDENT_REVIEW | merged `d1df64b` (ancestor) | **Not adopted:** coordinator variant `16b60ea` (redacting error); `.github/workflows/agent4-real-build.yml`; `holochain/demo/a4-install-readonly.sh` (retired in `3501e84`). Historical A4 run 43647150236 performed a disposable external-Lair sandbox install; SEC should review whether that was authorized | RAVE/SEC decide the coordinator variant; SEC reviews the historical install; then close |
| #47 Archive producer | HISTORICAL_RESEARCH (included) | merged `0f6aa1c` | its branch-only workflow (retired; suite now in shared CI) | close |
| #48 OBS v1 outbox | **INCLUDED_BY_PORT** (fixes) + REQUIRES_INDEPENDENT_REVIEW | commits ≤ `220d5aa` via #52; fixes `63403b8`/`cafc19e` and `b29e469`/`3288d11`/`2802d95` **re-implemented** on the Kit v2 outbox in `98db651` (not cherry-picked; blob-pinned as integration-only provenance); **not an ancestor** | v2-proof-contract `37f6101` / `c01f761` / `c14719a` / `a441364` / `3258cb9` (superseded by #62's typed v2) | **Keep open until OBS reviews the port** (and SEC reviews it as security-critical). If OBS accepts it, close #48 as superseded; if OBS rejects it, OBS lands its own port and the integration patch is reverted |
| #50 SOL SEC-38-3/4 | SUPERSEDED (included) | ancestor | none | close |
| #52 OBS Kit outbox | INCLUDED_IN_CONSOLIDATION | ancestor via #62 merge `b904c88` | none | close |
| #53 SEC fixture sync | INCLUDED_IN_CONSOLIDATION | merged `2b10aa0` | none | close |
| #55 SOL source domain | INCLUDED_IN_CONSOLIDATION | ancestor via #64 | none | close |
| #57 OBS v2 ABI review | INCLUDED_IN_CONSOLIDATION | ancestor via #62 | none | close |
| #59 OBS nested denials | INCLUDED_IN_CONSOLIDATION | ancestor via #62 | none (**new versus #67**) | close |
| #62 OBS replay guard | INCLUDED_IN_CONSOLIDATION | merged `b904c88` | none (**new versus #67**). The v2 ABI is a *candidate*, not frozen | close; ABI ratification continues in a new issue |
| #63 SOL archive verifier | INCLUDED_IN_CONSOLIDATION | merged `2db4d41` | none | close |
| #64 SOL original ZIP | INCLUDED_IN_CONSOLIDATION | merged `b8b5a83` | preserve workflow retired (job complete) | close |
| #65 RAVE compile fixes | INCLUDED_IN_CONSOLIDATION | merged `bc43e92` | none | close |

## Integration / demo PRs (all ancestors via #67)

| PR | Primary class | Notes | Recommendation |
|---|---|---|---|
| #37, #39 | SUPERSEDED | S0 snapshots | close |
| #41, #45, #46, #49 | SUPERSEDED | demo staging and rehearsal chain | close |
| #51, #54, #56, #58 | SUPERSEDED | A0 / A1 preflight chain | close |
| #61 | SUPERSEDED | same-run source binding before compile fixes | close |
| #66 | SUPERSEDED (included) | historical green same-run baseline; evidence cited as HISTORICAL in TEST_RESULTS.md | close after #68 merges |
| #67 | SUPERSEDED (included) | installation-preparation baseline; historical request preserved | close after #68 merges |
| #60 (closed) | SUPERSEDED | not merged; replaced by #61 | no action |

## Blocked items (not PRs)

These are BLOCKED independent of any PR. None can be unblocked by merging code.

- **Installation** of the audit DNA and any signed audit write: no independently authorized exact request exists.
- **v2 transport activation:** the ABI is not ratified, and #48's durable-ActionHash port (`98db651`) awaits OBS + SEC review.
- **Deployment-epoch identity and complete produced-slot history:** HOLD (SOL #63 / #64 reviews).
- **Economic gate C:** NO-GO.

## Recommended merge / close order

1. Human review of #68 (SOL, OBS, RAVE, SEC owners plus a distinct security reviewer). Decide the open items in INTEGRATION_REPORT §3 B/C and §4.
2. Before **2026-11-28 22:37 UTC**, the **owner** makes the durable copy of the original #66 artifacts and records it (DEMO_READINESS.md §5, `demo/installation/preservation/README.md`). The download, verification and restore tooling is in this PR and has been exercised; only the owner-authorized storage step is missing.
3. Owner disables `rave-unyt-release.yml` in *Settings → Actions*, or locks its seven historical branches (MAINLINE_MAINTENANCE.md §5), **before** the file reaches `main`.
4. Merge #68 into `main` with a merge commit (not squash), so every specialist head stays reachable from `main`. Only an independent reviewer approves it, never the author.
5. Open the follow-up PRs against `main`:
   1. OBS review of the #48 port (`98db651`); OBS back-ports it to its own lane or replaces it.
   2. SEC back-port of `f16e461`.
   3. RAVE / SEC coordinator decision.
6. Close superseded **integration/demo** PRs: #37, #39, #41, #45, #46, #49, #51, #54, #56, #58, #61, then #66 and #67.
7. Close **specialist** PRs once each owner confirms: #32, #34, #35, #36, #38, #40, #43, #50, #52, #53, #55, #57, #59, #62, #63, #64, #65, #42, #47.
8. Then #33 (after the SEC back-port decision), #44 (after the RAVE / SEC decisions) and #48 (after OBS accepts or replaces the port).
9. Retarget any still-active work so it branches from the new `main`, using the rules in MAINLINE_MAINTENANCE.md.
