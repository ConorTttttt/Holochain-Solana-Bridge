# Cross-lane security test evidence — 13 November 2026

**Reviewer:** SEC, Sprint 0, Issue #10 / PR #33. **Scope:** read-only test fixtures against the current integrated OBS/SOL/RAVE branch. **NOT an external audit or economic authorization.**

## Source and execution provenance

- SEC adversarial test committed on `agent/sec/10-threat-model` as `b0af4adbb444e0affb33961c4944f8f38df9cb56`, file blob `17d2a68d96a8ac5623f21062e118fb2b92b6c8a2`.
- The same file blob was verified on the integration branch `integration/s0/11-all-agent-snapshot` (snapshot commit `897f02241b3a098039353eafd40c5f7b034e9ac7`).
- GitHub Actions cross-lane test run: [43499276656](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499276656), job ID **132140483901**.
- The job ran on `ubuntu-24.04` using Node 22.16.0; the workflow installed the actual `@solana/kit` dependency from the package registry, not a local stand-in.
- Dependency installation was **UNLOCKED**: no committed `observer/package-lock.json` or `tests/solana/package-lock.json` at that point. The workflow resolved them at runtime and recorded the resulting SHA-256 values. These are **ephemeral evidence**, not reproducible dependency pins.
- Direct SEC authoring sandbox lacked network access for npm and Rust; execution evidence below is independently sourced from the GitHub Actions job logs.

## Confirmed test results from actual CI logs

| Suite | Passed | Failed | Skipped | Scope |
|---|---:|---:|---:|---|
| `security/test/adversarial.test.mjs` | **16** | **0** | **0** | Actual integrated Observer async API, mint account, Kit-backed PDA checks, explicit issuance/withdrawal refusal, synthetic snapshots and reference ledger |
| `security/test/solvency-model.test.mjs` | **7** | **0** | **0** | Pure integer accounting / replay *reference model* |
| `tests/holochain/shadow-review.test.mjs` | **9** | **0** | **0** | Shadow-only behaviour / modeled replay and refusal |
| `tests/holochain/economic-attack-model.test.mjs` | **5** | **0** | **0** | Economic attack *models*, not deployed DNA |
| `tests/solana/layout.test.mjs` | **6** | **0** | **1** | Source-derived layout; **compiled IDL cross-check SKIPPED** |

**Combined CI job: FAILED** by policy because the SOL layout suite skipped its generated-IDL check. This is the correct fail-closed behaviour; SEC tests are not the reason for the current combined job failure.

## External and execution-level gates still open

- **No actual Solana validator deposit/refund evidence is claimed by these JS tests.** Separate local-validator CI job status must be evaluated independently.
- **No compiled/generated Anchor IDL was available to the JS cross-lane job**; SOL and CI must publish it and make the exact binary/IDL available to the layout test. A successful independent compilation does not substitute for IDL-layout checks.
- **Uncommitted dependency lockfiles:** obtain reviewed, committed `package-lock.json` and use `npm ci` rather than resolving the graph afresh each run.
- **Consensus/inclusion:** synthetic `finalizedSlot` input remains forgeable; no transaction-level creation/inclusion verification or authenticated consensus proof exists yet.
- **Upgrades/custody:** first-initializer admin capture remains possible in public network bootstrap; upgrade authority and fixed asset admission remain unverified.
- **Holochain economic finality:** real RAVE crate unit test success, if any, does not prove exact deployed DNA fork/parked-spend/recovery properties.
- **Replay:** the shadow journal is process-local, not globally durable. Future external payout must never rely on it.
- **Refund:** depositing into this prototype confers a refundable entitlement; external spendable credit is always forbidden.

## Security decision

**P0 STOP SHIP** for spendable Holochain issuance, external payouts and production collateral. **Conditional positive** for continuing disposable-token localnet development, once real SBPF/IDL and full validator integration evidence are reviewed. This document is test evidence, not independent security approval.
