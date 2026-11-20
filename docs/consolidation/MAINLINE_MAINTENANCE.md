# Mainline maintenance

**Goal:** after #68, keep `main` as the single development baseline. Specialist work lands in small PRs against `main` instead of long stacked chains of integration branches.

Repository settings below are **recommendations**. None were changed by this consolidation: branch protection, rulesets, secret scanning and CODEOWNERS enforcement require the repository owner.

## 1. What went wrong, and the rule that prevents it

| Observed (Nov 13–14) | Rule from now on |
|---|---|
| 36 PRs, 0 merged; 31 targeted other feature branches; PR-base chains up to 7 levels deep (#64→#55→#50→#43→#40→#38→#35→main) plus a 14-PR integration ancestry chain under #67 | Every PR targets **`main`**. Stacking is allowed only for at most 2 PRs, and only when the lower PR is ready for review |
| Integration branches **copied** specialist blobs, so ancestry did not show what was included | Specialist work reaches `main` by **merge of its PR**. Integration-only patches are allowed only with a `ci-integration-snapshot.json › integrationOnlyPatches` entry and an owning-lane follow-up |
| Lane branches tested against stale cross-lane fixtures (OBS #52–#62 red because SEC fixtures lagged) | A PR that changes a cross-lane contract updates the dependent fixtures **in the same PR**, or lands a reviewed contract PR first (AGENTS.md "two coordinated PRs") |
| Same-run integration could only run on PRs into `agent/ci/11-build-pipeline` | Required workflows trigger on `pull_request` into `main` (done in #68) |
| Branch-only workflows with `contents: write` and install steps | No workflow on `main` may write contents, install a Holochain app, provision a keystore or call a zome (see §5) |
| Every PR and review under one GitHub login | Distinct GitHub identities (or GitHub App identities) per lane and for SEC, so that "independent review" is checkable |

## 2. Branch protection for `main` (owner action)

Recommended ruleset on `main`:

- **Require a pull request before merging.**
  - 1 approving review for non-critical paths.
  - **2** for critical paths: §3 CODEOWNERS, one of which must be SEC.
  - Dismiss stale approvals on new commits.
  - Require approval of the most recent push by someone other than its author.
- **Require status checks to pass, strictly up to date with `main`:**
  - `Sprint 0 CI (fail-closed)` (7 jobs): `Observer unit tests and syntax`, `Reviewed committed dependency lockfiles (required)`, `Commit secret and generated-file guard`, `Available SOL layout, SEC and RAVE fixture tests (no on-chain claims)`, `Required Rust host and Anchor SBF compilation`, `Ephemeral Solana validator RPC smoke (no contract tests)`, `Preserved original PR55 Solana evidence (read-only, non-economic)`.
  - `S0 cross-agent integration snapshot (NOT production)` (4 jobs): `Real local-validator Anchor lifecycle (SOL runner; disposable only)`, `RAVE 0.15.0 real crate tests (NOT deployed DNA)`, `Required SOL layout / SEC adversarial / RAVE shadow fixtures (real SDK)`, `Same-run SOL/OBS-bound real Holochain 0.7.1 build and admin-only install`. That last job name pre-dates this work; its install steps are hard-disabled.
  - `Immutable A0 source and missing-lock evidence (audit-only)`.
  - `original-evidence` (installation preparation; path-filtered, so mark required only if the owner accepts path filters on required checks).
- **Do NOT require** `Own Holochain 0.7.1 locked build (PR/dispatch; source-gated, NO ZOME CALL)`. It fails **by design** with `BLOCKED_NOT_ACCEPTED` until independent authorization exists. Keep it visible as the authorization indicator; never edit it to pass.
- **Block force pushes and deletions** on `main`.
- **Require linear history: no.** Merge commits preserve specialist ancestry; use "Create a merge commit" for integration PRs.
- **Do not allow bypass** for agents or apps. Restrict who can push to `main` to the maintainer; agents never push to `main` (AGENTS.md rule 6).
- **Auto-merge disabled**; draft PRs can never be merged.

Also enable:

- **Secret scanning and push protection.** CI's `scripts/ci/guard.mjs` is a baseline only.
- **Dependabot alerts** (alerts only; no auto-update PRs for pinned toolchains).
- A rule that `.github/workflows/**` changes require CI + SEC approval.

## 3. Code ownership (proposed `.github/CODEOWNERS`, not committed)

It is not committed because today every lane uses the same login, so it would add no protection. Commit it once distinct identities exist:

```
/programs/                     @<sol-owner>        @<sec-reviewer>
/Anchor.toml /Cargo.toml /Cargo.lock /rust-toolchain.toml  @<sol-owner> @<sec-reviewer>
/tests/solana/                 @<sol-owner>
/observer/                     @<obs-owner>        @<sec-reviewer>
/holochain/evidence-gate.mjs   @<maintainer>       @<sec-reviewer>
/holochain/                    @<rave-owner>
/tests/holochain/              @<rave-owner>
/security/ /docs/SECURITY_GATES.md  @<sec-reviewer>
/.github/workflows/ /scripts/ /tests/integration/ /ci-integration-snapshot.json  @<ci-owner> @<sec-reviewer>
/demo/installation/ /scripts/installation/  @<ci-owner> @<sec-reviewer> @<maintainer>
```

## 4. How each lane lands changes from now on

The common loop:

1. Create the issue.
2. Branch `agent/<lane>/<issue>-<slug>` **from current `main`**.
3. Open a PR into `main`.
4. Keep shared CI and same-run integration green **at the PR head**.
5. Get review.
6. Merge.

When a PR changes a pinned specialist file, it updates its `fileProvenance` entry in the **same** PR: blob = the new committed blob, `sourceCommit` = the PR head. `verify-integration-provenance.mjs` fails otherwise. This is intentional: it forces a visible provenance diff.

| Lane | Additional obligations |
|---|---|
| **SOL** | `anchor build` and the four isolated validator modes must pass in the same-run job. Never reuse IDL / ELF hashes across disposable program IDs. Any change to account layout, PDAs, authorities or arithmetic needs SEC review and an OBS contract update in the same PR. Never regenerate committed original evidence |
| **OBS** | Run `npm --prefix observer test` and the cross-lane runner. Keep the four denial literals at every layer. Changing the v2 ABI requires A4 (RAVE) ratification first. Review the integration port of #48's durable-ActionHash and `uiAmount` fixes (`98db651`, INTEGRATION_REPORT §4) and either adopt it into the OBS lane or replace it, before any transport work |
| **RAVE** | Locked native and WASM builds must pass in the same-run job. A change to integrity zomes changes the DNA hash; state it in the PR. `evidence-gate.mjs` is maintainer-only. No install / genesis / zome-call workflow (see §5) |
| **SEC** | Review PRs. Do not author the economic changes you approve. Fixture changes that track another lane land with, or immediately after, that lane's PR. Back-port `f16e461` (INTEGRATION_REPORT §3C) |
| **CI** | Workflows trigger on PRs into `main`. Never convert an intentional denial into a pass. Retire branch-only workflows rather than accumulating them. Same-run evidence is per-SHA; never cite an older run as current |

### Do / don't

- **Do** rebase or merge `main` into your PR branch when it falls behind. **Don't** branch from another lane's unmerged PR unless the two are a declared contract pair.
- **Do** keep evidence documents append-only: add a dated file or section. **Don't** edit historical evidence to match a new run.
- **Do** record exact commands, versions and run IDs in the PR. **Don't** claim a build, test or review that did not run at that SHA.

## 5. Security interlocks that maintenance must preserve

- `holochain/evidence-gate.mjs` throws for credit and withdrawal (rule 1; maintainer-only).
- `ci-integration-snapshot.json › nonEconomicPolicy` = all four denials; `candidate.status` = `UNVERIFIED_NO_GREEN_CLAIM`.
- Same-run install steps are `if: ${{ false }}`, A0's install job is `if: ${{ false }}`, and the A0 build gate refuses with exit 3.
- `scripts/installation/execute-approved.mjs` is invoked by no workflow. It needs an admin-owned policy, an independently held Ed25519 authority and a one-use broker redemption.
- `rave-unyt-release.yml` (since `b6b0711`): `workflow_dispatch` is **removed** and `actual-non-economic-conductor-probe` is **hard-disabled** (`if: ${{ false }}`). `scripts/ci/workflow-install-gates.test.mjs`, run in shared CI, refuses any workflow step that can install or start a conductor, install an app or call a mutating zome without exactly `if: ${{ false }}`. It also refuses re-added dispatch, schedule, `pull_request` or `workflow_call` triggers on that file.
  - **Residual (owner action, checked 2026-11-20):** all seven historical branches named in its `push` trigger carry their **own, older** copies of the file, with the probe **enabled** and `workflow_dispatch` present. Those branches are `agent/rave/9-rave-validation` `e34e0f8`, `integration/s0/11-all-agent-snapshot` and `…/2026-11-14-agent1-candidate` `6a50081`, `…/2026-11-14-sol38-review-pending` `6a41501`, `integration/demo/2026-11-14-a1-rave5-required-review` `a51e335`, `…/a1-a0-evidence-gated` `101e6ec`, and `…/a1-bootstrap-source-v2` `b737976`.
    - A push to any of them runs that branch's old probe.
    - Once this file exists on `main`, a dispatch with `--ref <historical branch>` may also run the old copy, because GitHub executes the workflow file at the dispatched ref.
    - **Before or at the merge of #68**, disable the workflow in *Settings → Actions* (or `gh workflow disable rave-unyt-release.yml`), and delete or lock those seven branches once their PRs are closed.
    - This session cannot change repository settings or delete branches.
  - Re-enabling the probe requires a reviewed PR with RAVE + SEC approval and an exact-call authorization path, for example a GitHub Environment with required reviewers who are not the author.
  - Neither this consolidation nor its follow-ups ran it.

## 6. Dependency locking (current state, verified by CI at the PR SHA)

| Lock | SHA-256 (reviewed) | Enforced by |
|---|---|---|
| `Cargo.lock` | `9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5` | `verify-integration-provenance.mjs`, dependency-provenance job |
| `observer/package-lock.json` | `87578ffa1a3f0d1f0102f58ac649e25cd2a9d2902889bc946213fb2f136f0f62` | same |
| `tests/solana/package-lock.json` | `24ad69597db242528c87a98d8bc2299574e09eb52e77e026281db01e1c9889c6` | same |
| `tests/holochain/rave-engine/Cargo.lock` | `8f9ee713af6e6f05fbc84c04fb72ccf8fdbe35eb031e98c1eaa82ce2ab3eab8c` | same |
| `holochain/demo/Cargo.lock` | `c5774a18ba821005d80e51c7bf1663062817ce06e585a2bc2245e09da3b4d6c6` | A0 bootstrap + same-run `--locked` build |
| `holochain/demo/ham-adapter/Cargo.lock` | `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` | same |

Toolchains are pinned in-repo:

- Rust 1.95.0 (`rust-toolchain.toml`).
- Node 22.16.0, Solana/Agave 4.1.2, Anchor 1.2.2 and platform-tools v1.57 (`scripts/ci/toolchain.env`).
- Holonix `a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da`, HAM `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`.
- Actions pinned by commit SHA.

**Pinning gap closed (`8b22ac4`, SEC review requested):** shared `ci.yml` (`anchor-compile`, `validator-smoke`) used to run `sh -c "$(curl -fsSL https://release.anza.xyz/v${SOLANA_VERSION}/install)"`, which was version-pinned only. It now runs `scripts/ci/install-agave.sh`, which:
- downloads the exact upstream archive over HTTPS (TLS ≥ 1.2);
- verifies `AGAVE_ARCHIVE_SHA256=5991d027a686eb419a709a479178b33eb83501e8a2bfbf599a81a286bfcbf770` (`scripts/ci/toolchain.env`) **before** extraction;
- rejects archive paths outside `solana-release/`;
- checks `solana --version`;
- records archive and executable digests.

This is the same digest the same-run `integration-snapshot.yml` job uses. It was re-verified on 2026-11-20 by an independent download (218,318,551 bytes). This resolves the point SEC raised in #38.
