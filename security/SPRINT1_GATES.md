# Independent Sprint 1 security decision — Issue #15

**Date:** 13 November 2026. **Branch:** `agent/sec/10-threat-model`, PR #33. **Decision: P0 STOP SHIP for spendable Holochain credit and external Solana payouts.** No production withdrawal or spendable-credit function was reviewed or enabled. This report is not an independent human audit or security approval of other agents' code.

## Test/proof legend

- **SOURCE** — directly observed in published current branch source; may still require exploit execution.
- **EXECUTED MODEL** — passed exact-integer/reference test; NOT actual Unyt/Solana consensus.
- **EXECUTED OBS** — observed against real Solana Kit-backed Observer in existing integration CI run 43499276656, *before* new S1 probes.
- **NEW / NOT CI RUN** — new tests in this PR; require full-checkout cross-branch CI evidence.
- **BLOCKED DNA** — cannot test without exact verified deployed Unyt integrity/coordinator code, build hashes and conductor.

## Severity-ranked findings and acceptance criteria

| ID / severity | Component and prerequisites | Evidence / impact | Required acceptance test |
|---|---|---|---|
| SEC-S1-01 **P0** | SOL: attacker submits first valid `initialize` while config PDA is absent | **SOURCE:** `Initialize` accepts any `admin: Signer` and creates the single global config PDA, pinning their mint/scope/admin. A first-initializer race can capture configuration. Not yet reproduced as an attacker-first validator transaction. | Fresh localnet test intentionally initializes with attacker before legitimate operator; assert unauthorized bootstrapping is impossible under approved deployment trust model. Pin deployment/admin authority, or fail deployment. |
| SEC-S1-02 **P0** | SOL/RAVE: externally issued credit backed by still-refundable deposit | **SOURCE + EXECUTED MODEL:** `refund` remains accessible to depositor; adding Holochain redeemable claims double-counts collateral. `sprint1-economic-attacks.test.mjs` shows 100 refundable + 100 credit > 100 collateral. This is a conditional economics exploit, not one enabled today. | Real nonrefundable source mechanism with atomic exclusivity; refund-after-credit negative test must fail. |
| SEC-S1-03 **P0** | OBS: adversary supplies internally consistent but fabricated `finalized` RPC response | **SOURCE:** `observeRpc` requests `finalized` and checks reported genesis/owner/PDA/account bytes, but does not independently attest creating transaction inclusion or consensus. **NEW / NOT CI RUN:** SEC-14 forges the entire RPC envelope. Current `transactionVerified: false` and `creditEligible: false` prevent escalation. | Real finalized successful creating-tx inclusion, signature/instruction linkage, retry/backfill and diverse source checks; reject failed and replayed transactions. |
| SEC-S1-04 **P0** | RAVE: two agents or DNA versions have independent replay/recovery ledgers | **EXECUTED MODEL:** separate journals each permit one payout; changing DNA in per-version key permits second payout. No real payout exists. **BLOCKED DNA:** global recovery uniqueness, parked standing and fork rules. | Exact deployed integrity/coordinator zomes; partition/fork, recovery-agreement replacement, repeated reclaim, migration and crash/restart tests with globally anchored one-time identity. |
| SEC-S1-05 **P0** | SOL: upgrade authority or asset mint authority bypasses previously reviewed assumptions | **SOURCE:** `initialize` checks mint's freeze authority but not immutable mint supply authority; tests use a disposable mint with mint authority. Solana program upgrade governance is not verified here. No claim of malicious mint exploit. | Record upgrade authority and mint authority at source/verification slot; test unauthorized upgrade, mint changes, program ID and account ownership mismatch, and emergency pause policy. |
| SEC-S1-06 **P1** | OBS: same RPC response sent twice is presented as two sources | **SOURCE:** `reconcileObservations(a,b)` returns `checkedBy:[a.source,b.source]` without asserting distinct providers or noncollusion. **NEW / NOT CI RUN:** SEC-13 demonstrates pseudo-quorum. Still `creditEligible:false`. | Reject repeated provider identity for quorum, bind response to independently configured endpoint and independent signed checkpoint; downstream MUST NOT treat `checkedBy.length` as a finality quorum. |
| SEC-S1-07 **P0** | Withdrawal signer: wrong identity, stale Parked, fork or repeated payout | **EXECUTED MODEL:** S1-MODEL-05 rejects wrong signer/standing, S1-MODEL-02 reserves pending liability, S1-MODEL-03/04 expose separated journals. **BLOCKED DNA:** no deployed signer/withdrawal route exists to test. | Independent signature domain, agreement identity, nonce, expiry, fork/debit finality and on-chain idempotent payout with crash-consistent record. |
| SEC-S1-08 **P1** | OBS: wrong genesis/program, receipt PDA, mint or token account | **EXECUTED OBS:** baseline SEC-04/05/08/09/10 assert rejections under real Kit; baseline SEC-06 shows fake slot remains untrusted. **NEW / NOT CI RUN:** SEC-15 fails mismatched reported genesis before account intake. | Confirm generated IDL, deployed code/program ID, canonical PDA, four-account finalized snapshots and exact source-chain transaction proofs, zero skipped checks. |

## Reproduction and execution evidence

Local isolated Node.js v22.16.0:

```sh
node --test security/test/sprint1-economic-attacks.test.mjs
# tests 6; pass 6; fail 0; skipped 0; exit 0
```

These are deliberately **counterexample models**: S1-MODEL-01 refund insolvency; 02 reserved payout liability; 03 partitioned journals; 04 DNA-migration key change; 05 wrong signer/stale standing; 06 domain-bound replay identity. The pass asserts that the counterexample is reproducible in the model, not that the deployed implementation is safe.

Previously confirmed SDK-backed GitHub Actions run **43499276656**, job **132140483901**, executed baseline SEC adversarial **16/16 PASS** and solvency model **7/7 PASS** with zero skipped within SEC suites. The overall integration job **FAILED** because the SOL IDL source/layout verification skipped. The new SEC-13, SEC-14 and SEC-15 tests were committed **after** that run and have **not been executed in cross-agent CI**.

Reproduction on full Agent 1 integration branch, after bringing forward this SEC commit and latest OBS/Anchor fixtures:

```sh
node --test security/test/*.test.mjs
node --test observer/test/*.test.mjs
# MUST run generated-IDL/validator tests separately; any skip is a gate failure.
```

SEC-14 uses an adversary-supplied RPC `getGenesisHash` and `getMultipleAccounts` response with internally correct four-account bytes and a fictitious slot 999999. **Intended observation:** data can pass structural parsing but remains `transactionVerified: false`. This is a *trust-boundary probe*, not a verified real-chain deposit, and must not be misreported as a rejection of the RPC data itself. SEC-13 records the lack of independent-provider identity validation without changing production code.

## Cross-agent required handoff

**SOL (Agent 2):** attacker-first initialize, unauthorized pause/refund and program upgrade/mint authority cases on the real local validator, with generated IDL and exact binary hash. Existing validator tests already cover many wrong-signer and double-refund cases; do not mislabel them as tests of attacker-first initialization.

**OBS (Agent 3):** finalized creating-transaction provenance; failure/rollback and duplicate-instruction replays; independent source identities; bound network/program/deployment; no promotion of two matching RPC views to consensus proof. Review SEC-13/14/15.

**RAVE (Agent 4):** exact Unyt deployed integrity/coordinator source and conductor, receipt/recovery/parked-link validations across forks and migration. Shadow Map is a non-economic demo, not global replay safety.

**CI (Agent 1):** integrate both PR #33 and #34 tests independently; archive exact source SHAs, Node/Rust versions, full logs, zero skipped applicable tests, generated IDL and validator evidence. Do not run a real-conductor gate as a passing stub.

**Release restriction:** No self-approval, no live tokens, no spendable Holochain credit, no Solana withdrawal, and no elevation of RPC observations or RAVE enum states into settlement proofs.


## Independent SEC follow-up — 13 November 2026 (post-integration failures)

See **[INDEPENDENT_GATES_2026-11-13.md](INDEPENDENT_GATES_2026-11-13.md)** for per-finding severity, preconditions, actual versus pending reproduction evidence, mitigation, unknowns and required acceptance tests. This supersedes any implication above that the new S1 SOL, OBS or RAVE suites are already green.

- Actual SOL local-validator job `43510726154` stopped at unsupported CommonJS named import **before** executing the new attacker-first initializer, concurrent deposit, u64-max or restart tests. The initializer vulnerability is **source-confirmed; executable attack not independently reproduced**.
- OBS job `43510726021` reported **38/45 pass**, seven failures; updated head now handles address-keyed `SignaturesMap` but post-fix integrated execution is pending. The new SEC independent signed-wire/adversarial probes have been committed under `security/test/transaction-provenance-adversarial.test.mjs`; their Kit-backed execution is **not claimed**.
- Published RAVE `rave_engine =0.15.0` test run `43510726154` reports **7/8 pass**, with the large decimal-string ReserveUnits assertion false; no proof of rounding or truncation. Independent JS/JSON BigInt **reference** boundary checks passed locally **4/4**, but are not RAVE execution.
- Credit, withdrawal and independently authenticated finality remain **P0 DENIED**. Real verified Unyt DNA/coordinator/conductor and cross-history replay validation remain required.
