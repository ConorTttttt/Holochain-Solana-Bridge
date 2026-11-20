# Pull request inventory

Generated 2026-11-20 from live GitHub state, the local Git object graph, and all 386 recorded GitHub Actions runs.
The consolidation commit evaluated is `8bf0d7411a05380e76284db2356d1555ab97f636` on `claude/holochain-solana-consolidation-3l2lqm` (PR #68).

- **Changed files / commits** are computed as `git diff --name-only $(merge-base <base tip> <head>) <head>`, the same set GitHub shows.
- **CI at head** lists the latest run of each workflow whose `head_sha` equals the PR head exactly. A run at an earlier commit of the same branch is **not** listed as head evidence.
- **Ancestor of #68** is `git merge-base --is-ancestor <head> 8bf0d74`.
- Reviews were queried for every PR. Only #38 has a formal review: a COMMENT from the SEC role with **CHANGES REQUIRED**. No PR has an APPROVE. Every PR and review is authored by one GitHub login, so independent approval cannot be established on GitHub today (see MAINLINE_MAINTENANCE.md).
- All 35 open PRs are drafts. #60 is closed and unmerged. No PR has been merged into `main`.

| PR | Lane | State | Head → base | Head SHA | Files / commits | CI at head | Ancestor of #68 | Disposition |
|---|---|---|---|---|---|---|---|---|
| #67 | CI | open, draft | `agent/ci/20-install-authorization-package` → `agent/ci/20-same-run-audit-runtime` | `d0409a1` | 22 / 6 | ✅ Install-prep [43653393623](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43653393623)<br>✅ Shared CI [43653393621](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43653393621) | yes | **INCLUDED_IN_CONSOLIDATION**<br>SUPERSEDED by #68 once merged |
| #66 | CI | open, draft | `agent/ci/20-same-run-audit-runtime` → `agent/ci/11-build-pipeline` | `03b567a` | 209 / 103 | ✅ Shared CI [43648981038](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648981038)<br>✅ A0 bootstrap [43648981024](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648981024)<br>❌ A0 gate [43648980995](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648980995)<br>✅ Same-run integration [43648980986](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648980986) | yes | **INCLUDED_IN_CONSOLIDATION**<br>SUPERSEDED by #67/#68 |
| #65 | RAVE | open, draft | `agent/rave/18-coordinator-deserialization-error` → `agent/rave/10-controlled-audit-dna-ham-review` | `7ccee3d` | 3 / 2 | none at head | yes | **INCLUDED_IN_CONSOLIDATION** |
| #64 | SOL | open, draft | `agent/sol/12-19-original-evidence-preservation-20261114` → `agent/sol/12-demo-source-domain-handoff-20261114` | `768f463` | 3 / 4 | none at head | yes | **INCLUDED_IN_CONSOLIDATION** |
| #63 | SOL | open, draft | `agent/sol/55-source-archive-epoch-review-20261114` → `agent/sol/12-demo-source-domain-handoff-20261114` | `02a89b7` | 2 / 3 | none at head | yes | **INCLUDED_IN_CONSOLIDATION** |
| #62 | OBS | open, draft | `agent/obs/2026-11-14-pr61-replay-guard-v2-freeze` → `agent/obs/2026-11-14-v2-nested-denial-hardening` | `e70a178` | 4 / 4 | ❌ Shared CI [43645338510](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43645338510) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #61 | CI | open, draft | `integration/demo/2026-11-14-a1-source-domain-obsv2` → `agent/ci/11-build-pipeline` | `baa9f16` | 201 / 101 | ✅ Shared CI [43645044071](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43645044071)<br>❌ A0 gate [43645044029](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43645044029)<br>✅ A0 bootstrap [43645044016](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43645044016)<br>❌ Same-run integration [43645043998](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43645043998) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #60 | CI | closed, draft | `integration/demo/2026-11-14-a1-obs57-source-bound-candidate` → `agent/ci/11-build-pipeline` | `b869da9` | 202 / 102 | ✅ A0 bootstrap [43640351489](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43640351489)<br>❌ A0 gate [43640351467](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43640351467)<br>❌ Same-run integration [43640351458](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43640351458)<br>✅ Shared CI [43640351454](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43640351454) | **no** | **SUPERSEDED**<br>already CLOSED; NOT merged |
| #59 | OBS | open, draft | `agent/obs/2026-11-14-v2-nested-denial-hardening` → `agent/obs/2026-11-14-v2-abi-kit-admission-freeze` | `52bd850` | 2 / 4 | ❌ Shared CI [43638549456](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43638549456) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #58 | CI | open, draft | `integration/demo/2026-11-14-a1-preauthorization-stages` → `agent/ci/11-build-pipeline` | `2bc6887` | 188 / 93 | ✅ Same-run integration [43630610615](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43630610615)<br>❌ A0 gate [43630610512](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43630610512)<br>✅ A0 bootstrap [43630610510](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43630610510)<br>✅ Shared CI [43630610501](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43630610501) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #57 | OBS | open, draft | `agent/obs/2026-11-14-v2-abi-kit-admission-freeze` → `agent/obs/2026-11-14-kit-v2-outbox-review` | `38847cf` | 9 / 16 | ❌ Shared CI [43630245420](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43630245420) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #56 | CI | open, draft | `integration/demo/2026-11-14-a1-bootstrap-source-v2` → `agent/ci/11-build-pipeline` | `b737976` | 186 / 90 | ✅ RAVE release [43627396101](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627396101)<br>✅ Shared CI [43627400062](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627400062)<br>❌ A0 gate [43627400018](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627400018)<br>✅ A0 bootstrap [43627399999](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627399999)<br>✅ Same-run integration [43627399927](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43627399927) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #55 | SOL | open, draft | `agent/sol/12-demo-source-domain-handoff-20261114` → `agent/sol/sec38-3-4-remediation-20261114` | `c071e4c` | 10 / 14 | ✅ SOL temp [43604140724](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43604140724) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #54 | CI | open, draft | `agent/ci/16-a0-build-pr-preflight-20261114` → `agent/ci/11-build-pipeline` | `093a745` | 122 / 83 | ✅ Shared CI [43603110404](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43603110404)<br>❌ A0 gate [43603110341](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43603110341)<br>✅ Same-run integration [43603110303](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43603110303) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #53 | SEC | open, draft | `agent/sec/2026-11-14-ledger-fixture-obs52-sync` → `agent/obs/2026-11-14-kit-v2-outbox-review` | `da98cc2` | 2 / 2 | ✅ Shared CI [43602667565](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43602667565) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #52 | OBS | open, draft | `agent/obs/2026-11-14-kit-v2-outbox-review` → `integration/demo/2026-11-14-a1-rave5-required-review` | `a2338f9` | 33 / 10 | ❌ Shared CI [43603678118](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43603678118) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #51 | CI | open, draft | `integration/demo/2026-11-14-a1-a0-evidence-gated` → `agent/ci/11-build-pipeline` | `101e6ec` | 120 / 78 | ✅ RAVE release [43599996880](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43599996880)<br>✅ Shared CI [43600000639](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43600000639)<br>✅ A0 gate [43600000629](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43600000629)<br>✅ Same-run integration [43600000619](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43600000619) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #50 | SOL | open, draft | `agent/sol/sec38-3-4-remediation-20261114` → `agent/sol/sec38-attribution-review-20261114` | `640714a` | 8 / 5 | ✅ SOL temp [43599879389](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43599879389) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #49 | CI | open, draft | `integration/demo/2026-11-14-a1-rave5-required-review` → `agent/ci/11-build-pipeline` | `a51e335` | 112 / 68 | ✅ RAVE release [43594648110](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594648110)<br>✅ Shared CI [43594685075](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594685075)<br>✅ Same-run integration [43594685052](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594685052) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #48 | OBS | open, draft | `agent/obs/2026-11-14-audit-outbox-review` → `agent/obs/8-observer-validation` | `3258cb9` | 10 / 28 | none at head | **no** | **PARTIALLY_INCLUDED**<br>REQUIRES_INDEPENDENT_REVIEW / STILL_ACTIVE (OBS port) |
| #47 | SOL | open, draft | `agent/sol/obs-archive-producer-20261114` → `agent/sol/sec38-attribution-review-20261114` | `9d62b8e` | 4 / 7 | ✅ SOL archive mock [43594708420](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594708420) | yes | **HISTORICAL_RESEARCH**<br>INCLUDED (merged; mock tests in shared CI) |
| #46 | CI | open, draft | `integration/demo/2026-11-14-obs-replay-reviewed-source` → `agent/ci/11-build-pipeline` | `bc7c802` | 112 / 67 | ✅ Same-run integration [43593366067](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43593366067)<br>✅ Shared CI [43593366000](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43593366000) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #45 | CI | open, draft | `integration/demo/2026-11-14-audit-contract-staging` → `agent/ci/11-build-pipeline` | `80f79e6` | 110 / 66 | ❌ Same-run integration [43590812095](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43590812095)<br>✅ Shared CI [43590812005](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43590812005) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #44 | RAVE | open, draft | `agent/rave/10-controlled-audit-dna-ham-review` → `agent/rave/9-rave-validation` | `f0c0ec0` | 33 / 58 | none at head | yes | **PARTIALLY_INCLUDED**<br>REQUIRES_INDEPENDENT_REVIEW |
| #43 | SOL | open, draft | `agent/sol/sec38-attribution-review-20261114` → `agent/sol/sec38-hardening-20261114` | `f9d65f1` | 6 / 10 | ✅ SOL temp [43592157300](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43592157300) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #42 | SOL | open, draft | `agent/sol/research-custody-adr-20261114` → `agent/sol/7-anchor-build` | `f2491e0` | 2 / 3 | none at head | yes | **HISTORICAL_RESEARCH**<br>INCLUDED (docs only) |
| #41 | CI | open, draft | `integration/demo/2026-11-14-real-witness-rehearsal` → `agent/ci/11-build-pipeline` | `4a95ee9` | 107 / 58 | ❌ Same-run integration [43589670597](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43589670597)<br>✅ Shared CI [43589670572](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43589670572) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #40 | SOL | open, draft | `agent/sol/sec38-hardening-20261114` → `claude/solana-independent-fix` | `b4d7763` | 10 / 16 | ❌ SOL temp [43584777333](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43584777333) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #39 | CI | open, draft | `integration/s0/2026-11-14-sol38-review-pending` → `agent/ci/11-build-pipeline` | `6a41501` | 106 / 56 | ✅ RAVE release [43579629000](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43579629000)<br>❌ Same-run integration [43579674933](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43579674933)<br>✅ Shared CI [43579674896](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43579674896) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #38 | SOL | open, draft | `claude/solana-independent-fix` → `agent/sol/7-anchor-build` | `cca4e9a` | 5 / 1 | ✅ SOL temp [43577100529](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43577100529) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #37 | CI | open, draft | `integration/s0/11-all-agent-snapshot` → `agent/ci/11-build-pipeline` | `6a50081` | 103 / 55 | ✅ RAVE release [43573385895](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43573385895)<br>✅ Shared CI [43573389481](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43573389481)<br>❌ Same-run integration [43573389478](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43573389478) | yes | **SUPERSEDED**<br>INCLUDED (ancestor) |
| #36 | OBS | open, draft | `agent/obs/8-observer-validation` → `main` | `2931c5f` | 39 / 94 | none at head | yes | **INCLUDED_IN_CONSOLIDATION** |
| #35 | SOL | open, draft | `agent/sol/7-anchor-build` → `main` | `6492260` | 19 / 76 | ✅ SOL temp [43575385452](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43575385452) | yes | **INCLUDED_IN_CONSOLIDATION**<br>SUPERSEDED by #38→#55 |
| #34 | RAVE | open, draft | `agent/rave/9-rave-validation` → `main` | `e34e0f8` | 39 / 84 | ✅ RAVE release [43583914753](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43583914753) | yes | **INCLUDED_IN_CONSOLIDATION** |
| #33 | SEC | open, draft | `agent/sec/10-threat-model` → `main` | `53bc411` | 36 / 54 | none at head | yes | **INCLUDED_IN_CONSOLIDATION** |
| #32 | CI | open, draft | `agent/ci/11-build-pipeline` → `main` | `ce0fe43` | 124 / 37 | ✅ Shared CI [43534638668](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43534638668) | yes | **INCLUDED_IN_CONSOLIDATION**<br>SUPERSEDED by the #54..#67 extensions |

## Per-PR detail

### #67 — [CI #20] Independently verify original builds and prepare authenticated installation authorization

- **Source:** `agent/ci/20-install-authorization-package` @ `d0409a1d85bc377139285c39f9303f3b97470b29` → `agent/ci/20-same-run-audit-runtime` (merge base `03b567a`; 22 files, 6 commits)
- **Relationship:** Child of #66. Tip of the integration lineage.
- **Functionality:** Re-verifies original #66 build artifacts; prepares (does not approve) a canonical installation request; Ed25519 authorization verifier; one-use redemption receipt; identity checks; RUNBOOK.
- **Security relevance:** HIGH — authorization boundary for any Holochain mutation.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION (SUPERSEDED by #68 once merged)
- **Notes:** Merged first (c06886a). demo/installation + scripts/installation unchanged; committed historical request (executor 8ecbee6, baseline 03b567a) preserved byte-for-byte.

### #66 — [CI #20] Repair same-run audit compilation and stop before all Holochain mutation

- **Source:** `agent/ci/20-same-run-audit-runtime` @ `03b567a992bcd31930b49d08f594a4ef7ff58680` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 209 files, 103 commits)
- **Relationship:** Child of #32; contains #54/#51/#56/#58/#61 and #45/#46/#49/#41/#37/#39 integration chain.
- **Functionality:** Same-run SOL→OBS→native HAM/WASM→source-bound DNA/hApp pipeline; stops before installation.
- **Security relevance:** HIGH — source/evidence binding and mutation boundary.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION (SUPERSEDED by #67/#68)
- **Notes:** Ancestor via #67. Historical run 43648980986 (4/4) is historical evidence only.

### #65 — [RAVE #18] Fix actual coordinator and pinned Holonix build errors

- **Source:** `agent/rave/18-coordinator-deserialization-error` @ `7ccee3db4a86125bd914a9821f62cba783af0660` → `agent/rave/10-controlled-audit-dna-ham-review` (merge base `c6b60ac`; 3 files, 2 commits)
- **Relationship:** Forks #44 at c6b60ac; competing coordinator fix vs #44 16b60ea.
- **Functionality:** HDK 0.7.1 SerializedBytesError→WasmError coordinator fix; build.sh uses pinned Holonix rustc/cargo directly.
- **Security relevance:** MEDIUM — build reproducibility; coordinator error path.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged bc43e92. Its lineage also delivers #34's newer four-field shadow denials that #67 lacked.

### #64 — [A2 #12/#19] Preserve exact PR55 original ZIP; source-domain review and deployment-epoch HOLD

- **Source:** `agent/sol/12-19-original-evidence-preservation-20261114` @ `768f463a921998431f17007ffb1a79ac5577da6e` → `agent/sol/12-demo-source-domain-handoff-20261114` (merge base `c071e4c`; 3 files, 4 commits)
- **Relationship:** Child of #55; sibling of #63.
- **Functionality:** Commits exact original PR55 GitHub artifact ZIP (968887 B, SHA-256 33a56159…a018) + review.
- **Security relevance:** HIGH — original evidence provenance.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged b8b5a83. sol-pr55-preserve-original.yml (contents:write + git push) retired from the active workflow set; ZIP re-verified in new ci.yml job.

### #63 — [SOL #12/#19] Preserve PR55 source evidence; same-run policy review; epoch HOLD

- **Source:** `agent/sol/55-source-archive-epoch-review-20261114` @ `02a89b799ca06dd656684799ddce94597a4c3f52` → `agent/sol/12-demo-source-domain-handoff-20261114` (merge base `c071e4c`; 2 files, 3 commits)
- **Relationship:** Child of #55; sibling of #64.
- **Functionality:** Read-only verifier for the PR55 ZIP; deployment-epoch HOLD review.
- **Security relevance:** HIGH — evidence verification; epoch identity remains HOLD.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged 2db4d41; verifier now runs in shared CI.

### #62 — [OBS P0][DRAFT] Regression for CI-only archived RPC replay guard (inherits #59)

- **Source:** `agent/obs/2026-11-14-pr61-replay-guard-v2-freeze` @ `e70a178a927e74326abfff6732bf49e66df4f447` → `agent/obs/2026-11-14-v2-nested-denial-hardening` (merge base `52bd850`; 4 files, 4 commits)
- **Relationship:** Child of #59 ← #57 ← #52.
- **Functionality:** Replay-guard regression (archived fetch only in Node test child); UTF-8 byte bounds for v2 review preimages; A3/A4 ABI freeze candidate doc.
- **Security relevance:** HIGH — replay prevention, resource bounds.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged b904c88. NEW relative to #67 (which stopped at #57). Its own red Sprint 0 run 43645338510 was the lane-branch CROSS_LANE_MODE refusal, not an assertion failure.

### #61 — [A1 P0][DRAFT] Same-run SOL→OBS source-bound own DNA build/install (NO WRITE)

- **Source:** `integration/demo/2026-11-14-a1-source-domain-obsv2` @ `baa9f164cf9fa39b34ae1d1d0c3007c7e9197dc1` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 201 files, 101 commits)
- **Relationship:** Child of #32; parent of #66.
- **Functionality:** Same-run SOL→OBS source-bound own-DNA build (pre-compile-fix).
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** Superseded by #66 compile fixes.

### #60 — [A1 P0][DRAFT] OBS57 source + same-SHA execution-bound own-DNA build input

- **Source:** `integration/demo/2026-11-14-a1-obs57-source-bound-candidate` @ `b869da9ab07dd7c4aefec67c671aaf683bdccef1` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 202 files, 102 commits)
- **Relationship:** Closed alternative to #61.
- **Functionality:** Execution-bound DNA input derivation (demo/a0-execution-bound-dna.mjs).
- **Security relevance:** HIGH
- **Present in consolidation:** no — head is NOT an ancestor of #68
- **Decision:** SUPERSEDED (already CLOSED; NOT merged)
- **Notes:** Replaced by #61's a0-bind-same-run-dna.mjs. Its 9 unique commits stay on its branch.

### #59 — [OBS P0][DRAFT] Enforce nested economic denials on rehashed v2 audit witnesses

- **Source:** `agent/obs/2026-11-14-v2-nested-denial-hardening` @ `52bd850da4db70eb25b621f727c3a52b16153001` → `agent/obs/2026-11-14-v2-abi-kit-admission-freeze` (merge base `38847cf`; 2 files, 4 commits)
- **Relationship:** Child of #57; parent of #62.
- **Functionality:** Reject rehashed nested economic escalation in reviewed v2 witnesses; pin proof kind/verification fields.
- **Security relevance:** HIGH — economic-denial invariants.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Ancestor via #62 merge. NEW relative to #67.

### #58 — [A1 P0][DRAFT] Real same-SHA Kit preauthorization seven-stage runner and DNA domain guard

- **Source:** `integration/demo/2026-11-14-a1-preauthorization-stages` @ `2bc6887b1c373311f2fbddea530bd533067dad84` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 188 files, 93 commits)
- **Relationship:** Child of #32.
- **Functionality:** Seven-stage preauthorization runner; DNA domain guard.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** Content carried forward in #61/#66/#67.

### #57 — [OBS P0][DRAFT] Fresh demo-domain same-SHA Kit replay and lossless A3/A4 ABI review

- **Source:** `agent/obs/2026-11-14-v2-abi-kit-admission-freeze` @ `38847cf1399c59fd1a1665c8bef2249479d7da03` → `agent/obs/2026-11-14-kit-v2-outbox-review` (merge base `a2338f9`; 9 files, 16 commits)
- **Relationship:** Child of #52; parent of #59.
- **Functionality:** Fresh demo-domain same-SHA Kit replay; lossless A3/A4 v2 ABI review.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** #67 adopted its blobs; ancestor via #62.

### #56 — [A1][P0] Exact SOL55/OBS52/SEC53/RAVE44 integration + non-authorizing Holochain Cargo bootstrap

- **Source:** `integration/demo/2026-11-14-a1-bootstrap-source-v2` @ `b7379764f9ba7b20c2e72898df73e181c8ec2380` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 186 files, 90 commits)
- **Relationship:** Child of #32.
- **Functionality:** Exact SOL55/OBS52/SEC53/RAVE44 integration + non-authorizing Cargo bootstrap.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #55 — [SOL #12/#19] Original signed localnet domain → audit DNA scope handoff (NO-GO economics)

- **Source:** `agent/sol/12-demo-source-domain-handoff-20261114` @ `c071e4c98e7b2dd04a18374f3792c0a90ce4b284` → `agent/sol/sec38-3-4-remediation-20261114` (merge base `640714a`; 10 files, 14 commits)
- **Relationship:** Child of #50; parent of #63/#64.
- **Functionality:** Original signed localnet domain → audit DNA scope handoff; four isolated validator modes; demo-domain witnesses.
- **Security relevance:** HIGH — program + validator evidence source of truth.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Program/test source of truth (c071e4c) pinned in ci-integration-snapshot.json.

### #54 — [A1 P0][DRAFT] Execute SHA-bound own-DNA build preflight on PR; preserve fail-closed source gate

- **Source:** `agent/ci/16-a0-build-pr-preflight-20261114` @ `093a7454a36c3a26cc107b06b1334a289940811e` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 122 files, 83 commits)
- **Relationship:** Child of #32.
- **Functionality:** SHA-bound own-DNA build preflight on PR; fail-closed source gate.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #53 — [SEC P0][DRAFT] Synchronize strict non-economic ledger fixtures with OBS #52

- **Source:** `agent/sec/2026-11-14-ledger-fixture-obs52-sync` @ `da98cc24f6bda74c4282175c8e2d7cc0d7494f35` → `agent/obs/2026-11-14-kit-v2-outbox-review` (merge base `3c91962`; 2 files, 2 commits)
- **Relationship:** Based on older #52 (3c91962).
- **Functionality:** Strict non-economic ledger fixtures synced with OBS #52.
- **Security relevance:** HIGH — adversarial fixtures.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged 2b10aa0 (tree unchanged: both fixture blobs already present).

### #52 — [OBS P0][DRAFT] Kit-backed authenticated audit outbox, full-proof v2 and PR47 raw archive verification

- **Source:** `agent/obs/2026-11-14-kit-v2-outbox-review` @ `a2338f965916ffac982527f6dc7696e9c5706345` → `integration/demo/2026-11-14-a1-rave5-required-review` (merge base `a51e335`; 33 files, 10 commits)
- **Relationship:** Child of #49; parent of #57/#53.
- **Functionality:** Kit-backed authenticated audit outbox, full-proof v2, PR47 raw archive verification.
- **Security relevance:** HIGH — idempotency, durable outbox.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Ancestor via #62.

### #51 — [A1 P0][DRAFT] SHA-bound A0 blocked evidence inventory + v2 OBS/DNA ABI handoff

- **Source:** `integration/demo/2026-11-14-a1-a0-evidence-gated` @ `101e6ecfb33fbee40c21caf54bc1ff6d8fcb22b0` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 120 files, 78 commits)
- **Relationship:** Child of #32.
- **Functionality:** SHA-bound A0 blocked evidence inventory; v2 OBS/DNA ABI handoff.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #50 — [SOL P0] SEC-38-3 exact attribution negatives and SEC-38-4 pinned release verification

- **Source:** `agent/sol/sec38-3-4-remediation-20261114` @ `640714a14ba338c615cf2ada55ca4166646a2d96` → `agent/sol/sec38-attribution-review-20261114` (merge base `f9d65f1`; 8 files, 5 commits)
- **Relationship:** Child of #43; parent of #55.
- **Functionality:** SEC-38-3 exact attribution negatives; SEC-38-4 pinned release verification.
- **Security relevance:** HIGH — signed attribution.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** Content carried forward by #55.

### #49 — [P0 review] Exact-SHA RAVE five-job companion to proven SOL/OBS replay (#46 child)

- **Source:** `integration/demo/2026-11-14-a1-rave5-required-review` @ `a51e3354c74fbb61cd30a1ab6e41ed9da6211a40` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 112 files, 68 commits)
- **Relationship:** Child of #32.
- **Functionality:** Exact-SHA RAVE five-job companion.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** Its RAVE job includes a disposable Unyt conductor install probe (historical).

### #48 — [OBS P0][DRAFT] Source-owned audit-only v1 outbox, crash reconciliation and rollback HOLD

- **Source:** `agent/obs/2026-11-14-audit-outbox-review` @ `3258cb9eb70f2e11e7092a8894617e1a2ad0daea` → `agent/obs/8-observer-validation` (merge base `2931c5f`; 10 files, 28 commits)
- **Relationship:** Child of #36; parallel to #52.
- **Functionality:** v1 outbox, crash reconciliation, rollback HOLD; later v2 proof contract, durable returned ActionHash, path-scoped uiAmount.
- **Security relevance:** HIGH — delivery idempotency.
- **Present in consolidation:** no — head is NOT an ancestor of #68
- **Decision:** PARTIALLY_INCLUDED (REQUIRES_INDEPENDENT_REVIEW / STILL_ACTIVE (OBS port))
- **Notes:** Commits through 220d5aa reached #67 via #52. NOT included: v2-proof-contract (37f6101,c01f761,c14719a,a441364,3258cb9; superseded by #57/#62 typed v2), durable returnedActionHash (63403b8,cafc19e: conflicts; its 2 tests fail on consolidated outbox), path-scoped uiAmount (b29e469,3288d11,2802d95: semantically incomplete port). No CI run at head.

### #47 — [SOL→OBS P0 research] Raw produced-slot two-provider archive with explicit gaps

- **Source:** `agent/sol/obs-archive-producer-20261114` @ `9d62b8ee5eb760092610193c77eeb49270dfc29e` → `agent/sol/sec38-attribution-review-20261114` (merge base `f9d65f1`; 4 files, 7 commits)
- **Relationship:** Child of #43.
- **Functionality:** Fail-closed produced-slot two-provider RPC archive producer with explicit gaps.
- **Security relevance:** MEDIUM — research tooling; credential stripping verified.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** HISTORICAL_RESEARCH (INCLUDED (merged; mock tests in shared CI))
- **Notes:** Merged 0f6aa1c.

### #46 — [P0 review] Exact A3 production rewards-meta OBS adoption + same-SHA genuine witness CI (NO-GO)

- **Source:** `integration/demo/2026-11-14-obs-replay-reviewed-source` @ `bc7c8020e2a623cd3a7ce1c8be697fb88faf3365` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 112 files, 67 commits)
- **Relationship:** Child of #32.
- **Functionality:** Exact A3 rewards-meta OBS adoption; same-SHA genuine witness CI.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #45 — [P0 demo staging] Fail-closed source-only observation contract and CLI runbook (NO DNA write)

- **Source:** `integration/demo/2026-11-14-audit-contract-staging` @ `80f79e6c0499122f3b36762f63eac990dab50111` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 110 files, 66 commits)
- **Relationship:** Child of #32.
- **Functionality:** Fail-closed source-only observation contract; CLI runbook.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #44 — [RAVE][DEMO-HAM-01] Controlled Holochain 0.7.1 audit-only DNA + pinned HAM adapter — runtime proof pending

- **Source:** `agent/rave/10-controlled-audit-dna-ham-review` @ `f0c0ec00653c9323a2e166f8687c1971c2098d72` → `agent/rave/9-rave-validation` (merge base `e34e0f8`; 33 files, 58 commits)
- **Relationship:** Child of #34; #65 forks it at c6b60ac.
- **Functionality:** Holochain 0.7.1 audit-only DNA + pinned HAM adapter; A4 real build; external-Lair sandbox install record.
- **Security relevance:** HIGH — DNA source; historical sandbox install.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** PARTIALLY_INCLUDED (REQUIRES_INDEPENDENT_REVIEW)
- **Notes:** Merged d1df64b for provenance. NOT adopted: coordinator variant 16b60ea (kept #65), agent4-real-build.yml and a4-install-readonly.sh (retired: genesis + keystore provisioning). Historical A4 run 43647150236 performed a disposable install — flagged for SEC.

### #43 — [SOL SEC-38 P0] Separate requested vs signed-effective account flags (review pending)

- **Source:** `agent/sol/sec38-attribution-review-20261114` @ `f9d65f1935f679d0052e19bc23960d5b2461452d` → `agent/sol/sec38-hardening-20261114` (merge base `b4d7763`; 6 files, 10 commits)
- **Relationship:** Child of #40; parent of #50/#47.
- **Functionality:** Separate requested vs signed-effective account flags.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #42 — [SOL research only] Future custody state machine, atomic init and single-use redemption ADR

- **Source:** `agent/sol/research-custody-adr-20261114` @ `f2491e0311e51879f8f22aad4d322b3e8f5946b7` → `agent/sol/7-anchor-build` (merge base `6492260`; 2 files, 3 commits)
- **Relationship:** Child of #35.
- **Functionality:** Future custody state machine / atomic init / single-use redemption ADR.
- **Security relevance:** INFO — research only, NOT implemented.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** HISTORICAL_RESEARCH (INCLUDED (docs only))
- **Notes:** Merged a77a103.

### #41 — [P0 rehearsal RED] CI real signed-wire replay narrow rewards equivalence (no economic approval)

- **Source:** `integration/demo/2026-11-14-real-witness-rehearsal` @ `4a95ee97dfdd08afc5d16c992bac55065002a9ca` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 107 files, 58 commits)
- **Relationship:** Child of #32.
- **Functionality:** Real signed-wire replay rehearsal (RED).
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #40 — SEC-38 independent re-review: signed attribution, mandatory wires, tamper classes and provenance

- **Source:** `agent/sol/sec38-hardening-20261114` @ `b4d776320f291d4eb526026a33aff2443ae48310` → `claude/solana-independent-fix` (merge base `cca4e9a`; 10 files, 16 commits)
- **Relationship:** Child of #38; parent of #43.
- **Functionality:** SEC-38 signed attribution, mandatory wires, tamper classes.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** Its SOL temp run 43584777333 failed; later #43/#50/#55 green.

### #39 — [P0 RED][Integration trial] SOL #38 54 signed wires + 21 tamper checks; pending SEC/Agent 2

- **Source:** `integration/s0/2026-11-14-sol38-review-pending` @ `6a415018792e79aa7ab2962b9c9f8003a5bcc8bb` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 106 files, 56 commits)
- **Relationship:** Child of #32.
- **Functionality:** Integration trial: 54 signed wires + 21 tamper checks.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))

### #38 — [SOL] Independent review: pin adversarial rejections to exact errors; ed25519/ELF-bound witnesses

- **Source:** `claude/solana-independent-fix` @ `cca4e9a94b5147efa82ac0106f1f97f75a42251f` → `agent/sol/7-anchor-build` (merge base `6492260`; 5 files, 1 commits)
- **Relationship:** Child of #35; parent of #40.
- **Functionality:** Pin adversarial rejections to exact errors; Ed25519/ELF-bound witnesses.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** Only PR with a formal review: SEC COMMENT 'CHANGES REQUIRED' (HIGH attribution binding) — addressed by #40/#43/#50.

### #37 — [Integration-only] Exercise S0 SOL/OBS/RAVE/SEC snapshots against CI #32

- **Source:** `integration/s0/11-all-agent-snapshot` @ `6a500811eb8b7b08865a4ae0acce327cbdbae002` → `agent/ci/11-build-pipeline` (merge base `ce0fe43`; 103 files, 55 commits)
- **Relationship:** Child of #32.
- **Functionality:** S0 SOL/OBS/RAVE/SEC snapshot exercise.
- **Security relevance:** MEDIUM
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** SUPERSEDED (INCLUDED (ancestor))
- **Notes:** RAVE run 43573382985 includes the historical disposable Unyt conductor install probe.

### #36 — [S0→S2][OBS] Receipt/PDA verification, signed deposit transactions and durable finalized indexer (draft)

- **Source:** `agent/obs/8-observer-validation` @ `2931c5fc51736e3c845cb9bedc55c578534b53a1` → `main` (merge base `4da2eee`; 39 files, 94 commits)
- **Relationship:** Targets main; parent of #48.
- **Functionality:** Receipt/PDA verification, signed deposit transactions, durable finalized indexer.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged 8bf0d74 (tree unchanged: content identical or superseded).

### #35 — [S0→S1][SOL] #7 build verified; #12 adversarial localnet tests awaiting CI

- **Source:** `agent/sol/7-anchor-build` @ `6492260f184e69f86abce02466878c25d666324d` → `main` (merge base `4da2eee`; 19 files, 76 commits)
- **Relationship:** Targets main; root of SOL lineage.
- **Functionality:** Anchor program build; adversarial localnet tests.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION (SUPERSEDED by #38→#55)
- **Notes:** Ancestor via #64.

### #34 — [S0][RAVE] Verified Unyt release, real Holochain 0.7.1 lifecycle and non-economic shadow regressions

- **Source:** `agent/rave/9-rave-validation` @ `e34e0f874b2465f89dbb8e552c6eec647f4410ac` → `main` (merge base `4da2eee`; 39 files, 84 commits)
- **Relationship:** Targets main; root of RAVE lineage.
- **Functionality:** Verified Unyt release, Holochain 0.7.1 lifecycle, non-economic shadow regressions.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Ancestor via #65. Its 14-Nov shadow hardening was missing from #67 and is now present.

### #33 — [SEC][S0] Threat model, conservation invariant and adversarial gates (#10)

- **Source:** `agent/sec/10-threat-model` @ `53bc4110583892e6d7bba5533025670e396e5ed7` → `main` (merge base `4da2eee`; 36 files, 54 commits)
- **Relationship:** Targets main.
- **Functionality:** Threat model, conservation invariant, adversarial gates, 13 independent review records.
- **Security relevance:** HIGH
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION
- **Notes:** Merged 45f75fc. transaction-provenance-adversarial.test.mjs keeps the integration fix f16e461 (SEC backport outstanding).

### #32 — [S0][CI] Add fail-closed observer, Anchor and validator smoke workflows (#11)

- **Source:** `agent/ci/11-build-pipeline` @ `ce0fe43dbaab4c709a521197693e52b2ea7176ef` → `main` (merge base `4da2eee`; 124 files, 37 commits)
- **Relationship:** Targets main; root of the CI/integration lineage.
- **Functionality:** Fail-closed observer, Anchor and validator smoke workflows.
- **Security relevance:** HIGH — CI gate integrity.
- **Present in consolidation:** yes — head is a Git ancestor of #68
- **Decision:** INCLUDED_IN_CONSOLIDATION (SUPERSEDED by the #54..#67 extensions)
- **Notes:** Ancestor via #67.
