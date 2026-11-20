# Branch inventory

Generated 2026-11-20. `git fetch origin '+refs/heads/*:refs/remotes/origin/*' --tags` returned 39 branch heads and **0 tags**. A 40th head, the consolidation branch, was created by this work.
`main` = `e1651fec77f1ed5c5f8e760e486c8757adc5e69c`. Every development branch forks from `4da2eee` (= `main~2`). `main`'s two newer commits only add `.github/skills/**`, which are byte-identical on the #67 lineage.

"Ancestor of #68" is computed against consolidation commit `8bf0d7411a05380e76284db2356d1555ab97f636`.

| Branch | Head | PR(s) | +ahead/-behind main | Ancestor of #68 | Decision |
|---|---|---|---|---|---|
| `agent/ci/11-build-pipeline` | `ce0fe43` | #32 | +37/-2 | yes | #32: INCLUDED_IN_CONSOLIDATION |
| `agent/ci/16-a0-build-pr-preflight-20261114` | `093a745` | #54 | +120/-2 | yes | #54: SUPERSEDED |
| `agent/ci/20-install-authorization-package` | `d0409a1` | #67 | +146/-2 | yes | #67: INCLUDED_IN_CONSOLIDATION |
| `agent/ci/20-same-run-audit-runtime` | `03b567a` | #66 | +140/-2 | yes | #66: INCLUDED_IN_CONSOLIDATION |
| `agent/obs/2026-11-14-audit-outbox-review` | `3258cb9` | #48 | +122/-2 | **no** | #48: PARTIALLY_INCLUDED |
| `agent/obs/2026-11-14-kit-v2-outbox-review` | `a2338f9` | #52 | +115/-2 | yes | #52: INCLUDED_IN_CONSOLIDATION |
| `agent/obs/2026-11-14-pr61-replay-guard-v2-freeze` | `e70a178` | #62 | +139/-2 | yes | #62: INCLUDED_IN_CONSOLIDATION |
| `agent/obs/2026-11-14-v2-abi-kit-admission-freeze` | `38847cf` | #57 | +131/-2 | yes | #57: INCLUDED_IN_CONSOLIDATION |
| `agent/obs/2026-11-14-v2-nested-denial-hardening` | `52bd850` | #59 | +135/-2 | yes | #59: INCLUDED_IN_CONSOLIDATION |
| `agent/obs/8-observer-validation` | `2931c5f` | #36 | +94/-2 | yes | #36: INCLUDED_IN_CONSOLIDATION |
| `agent/rave/10-controlled-audit-dna-ham-review` | `f0c0ec0` | #44 | +142/-2 | yes | #44: PARTIALLY_INCLUDED |
| `agent/rave/18-coordinator-deserialization-error` | `7ccee3d` | #65 | +140/-2 | yes | #65: INCLUDED_IN_CONSOLIDATION |
| `agent/rave/9-rave-validation` | `e34e0f8` | #34 | +84/-2 | yes | #34: INCLUDED_IN_CONSOLIDATION |
| `agent/sec/10-threat-model` | `53bc411` | #33 | +54/-2 | yes | #33: INCLUDED_IN_CONSOLIDATION |
| `agent/sec/2026-11-14-ledger-fixture-obs52-sync` | `da98cc2` | #53 | +111/-2 | yes | #53: INCLUDED_IN_CONSOLIDATION |
| `agent/sol/12-19-original-evidence-preservation-20261114` | `768f463` | #64 | +126/-2 | yes | #64: INCLUDED_IN_CONSOLIDATION |
| `agent/sol/12-demo-source-domain-handoff-20261114` | `c071e4c` | #55 | +122/-2 | yes | #55: INCLUDED_IN_CONSOLIDATION |
| `agent/sol/55-source-archive-epoch-review-20261114` | `02a89b7` | #63 | +125/-2 | yes | #63: INCLUDED_IN_CONSOLIDATION |
| `agent/sol/7-anchor-build` | `6492260` | #35 | +76/-2 | yes | #35: INCLUDED_IN_CONSOLIDATION |
| `agent/sol/obs-archive-producer-20261114` | `9d62b8e` | #47 | +110/-2 | yes | #47: HISTORICAL_RESEARCH |
| `agent/sol/research-custody-adr-20261114` | `f2491e0` | #42 | +79/-2 | yes | #42: HISTORICAL_RESEARCH |
| `agent/sol/sec38-3-4-remediation-20261114` | `640714a` | #50 | +108/-2 | yes | #50: SUPERSEDED |
| `agent/sol/sec38-attribution-review-20261114` | `f9d65f1` | #43 | +103/-2 | yes | #43: SUPERSEDED |
| `agent/sol/sec38-hardening-20261114` | `b4d7763` | #40 | +93/-2 | yes | #40: SUPERSEDED |
| `claude/holochain-solana-consolidation-3l2lqm` | `8bf0d74` | — | +626/-0 | yes | This consolidation (PR #68). |
| `claude/solana-independent-fix` | `cca4e9a` | #38 | +77/-2 | yes | #38: SUPERSEDED |
| `integration/demo/2026-11-14-a1-a0-evidence-gated` | `101e6ec` | #51 | +115/-2 | yes | #51: SUPERSEDED |
| `integration/demo/2026-11-14-a1-bootstrap-source-v2` | `b737976` | #56 | +127/-2 | yes | #56: SUPERSEDED |
| `integration/demo/2026-11-14-a1-obs57-source-bound-candidate` | `b869da9` | #60 | +139/-2 | **no** | #60: SUPERSEDED |
| `integration/demo/2026-11-14-a1-preauthorization-stages` | `2bc6887` | #58 | +130/-2 | yes | #58: SUPERSEDED |
| `integration/demo/2026-11-14-a1-rave5-required-review` | `a51e335` | #49 | +105/-2 | yes | #49: SUPERSEDED |
| `integration/demo/2026-11-14-a1-source-domain-obsv2` | `baa9f16` | #61 | +138/-2 | yes | #61: SUPERSEDED |
| `integration/demo/2026-11-14-audit-contract-staging` | `80f79e6` | #45 | +103/-2 | yes | #45: SUPERSEDED |
| `integration/demo/2026-11-14-obs-replay-reviewed-source` | `bc7c802` | #46 | +104/-2 | yes | #46: SUPERSEDED |
| `integration/demo/2026-11-14-real-witness-rehearsal` | `4a95ee9` | #41 | +95/-2 | yes | #41: SUPERSEDED |
| `integration/s0/11-all-agent-snapshot` | `6a50081` | #37 | +92/-2 | yes | #37: SUPERSEDED |
| `integration/s0/2026-11-14-agent1-candidate` | `6a50081` | — | +92/-2 | yes | No PR. Same SHA as `integration/s0/11-all-agent-snapshot` (#37); INCLUDED (ancestor). |
| `integration/s0/2026-11-14-sol38-review-pending` | `6a41501` | #39 | +93/-2 | yes | #39: SUPERSEDED |
| `integration/s0/frozen-24b60e72` | `24b60e7` | — | +46/-2 | yes | No PR. Frozen S0 snapshot; INCLUDED as an ancestor of the #67 lineage. |
| `main` | `e1651fe` | — | +0/-0 | yes | Base of consolidation. |

## Branches not incorporated as ancestors

| Branch | Reason |
|---|---|
| `agent/obs/2026-11-14-audit-outbox-review` (#48) | Partially included through #52. The remaining v2-proof-contract is superseded by the #57/#62 typed v2. The durable returned-ActionHash and path-scoped `uiAmount` commits conflict with the consolidated outbox. They were therefore **re-implemented by the integration in `98db651`** (2026-11-20) and await OBS + SEC review. See INTEGRATION_REPORT.md §4. |
| `integration/demo/2026-11-14-a1-obs57-source-bound-candidate` (#60, closed) | Superseded by #61's same-run binder, which is included. |

## Dependency graph (ancestry of the 12 tips before consolidation)

```
main@4da2eee
├─ CI  #32 ce0fe43 ─┬─ #37/#39 s0 snapshots ─ #41 ─ #45 ─ #46 ─ #49 a51e335 ─┬─ #52 a2338f9 ─ #57 38847cf ─ #59 52bd850 ─ #62 e70a178   [tip]
│                   │                                                         │    └─ (3c91962) ─ #53 da98cc2                             [tip]
│                   │                                                         └─ #51 ─ #54 ─ #56 ─ #58 ─ #61 baa9f16 ─ #66 03b567a ─ #67 d0409a1 [tip]
│                   │                                                                              └─ #60 b869da9 (closed)               [tip]
├─ SOL #35 6492260 ─┬─ #38 cca4e9a ─ #40 b4d7763 ─ #43 f9d65f1 ─┬─ #50 640714a ─ #55 c071e4c ─┬─ #63 02a89b7                       [tip]
│                   │                                            │                              └─ #64 768f463                       [tip]
│                   │                                            └─ #47 9d62b8e                                                     [tip]
│                   └─ #42 f2491e0                                                                                                  [tip]
├─ OBS #36 2931c5f ─ #48 3258cb9                                                                                                    [tip]
├─ RAVE #34 e34e0f8 ─ #44@c6b60ac ─┬─ #44 f0c0ec0                                                                                   [tip]
│                                  └─ #65 7ccee3d                                                                                   [tip]
└─ SEC #33 53bc411                                                                                                                  [tip]
```

The integration lineage (#32 → … → #67) **copied** specialist file contents at pinned blobs (`ci-integration-snapshot.json`) rather than merging the specialist branches. Ancestry alone therefore under-reports what #67 contained. The file-level three-way comparison is recorded in SOURCE_PROVENANCE.md.
