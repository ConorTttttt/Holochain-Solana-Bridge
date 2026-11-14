# Security gates, unresolved risks and next development milestones

## Non-negotiable invariant

At every point, **unpaid externally redeemable obligations <= actually available collateral**, with pending withdrawals counted exactly once. This prototype has *zero* externally redeemable obligations because issuing any is disabled.

## Current prototype risks (intentional tradeoffs)

| Risk | State now | Before economic bridging |
|---|---|---|
| Depositor can refund | **Allowed** for safe test-token recovery | Remove refunds only after complete issuance-redemption proof or replace with burn/escrow reservation mechanism |
| RPC can lie | Observer reports what RPC says | Define multi-party verification, authenticated source consensus evidence or disclosed attestor trust |
| Upgrade authority can alter deposit logic | Not governed in prototype | Verified builds, independent threshold control, time lock/monitoring and emergency-response policy |
| Receipt PDA not independently rederived by JS | Not yet checked; no authority granted | Use audited Solana SDK to derive/check PDA and bump; verify program ID and deployed code |
| No tx inclusion proof | Only `getMultipleAccounts(finalized)` state | Confirm transaction success and instruction semantics; archive/checkpoint finality evidence |
| Only one legacy SPL mint | Intentional | Explicit per-asset review; separate work for SOL and Token-2022 |
| Holochain duplicate-history / parked spend | Unverified production DNA | Executable adversarial tests on exact deployed Unyt integrity/coordinator zomes |
| Recovery across agreement migration | Not integrated | Global replay ledger and cross-epoch duplicate recovery tests |
| Signers / custody governance | Not integrated | Domain-separated signatures; threshold independent reviewers; replay and expiry proof |
| Database/indexer loss | No scanner yet | Historical backfill, durable receipt IDs, two-provider reconciliation and fail-closed gaps |
| Program first-initialize front-running | Local prototype config can be initialized by first signer | Atomic secure initialization and operator governance before public deployment |
| Refunded receipts change state after observation | Explicitly checked as refundable | No economic credit until irreversible entitlement evidence exists |

## Minimum next milestones

**M1 — Verify this starter on Solana localnet.** Install Anchor/Solana CLI, compile; write full validator integration tests for deposit, duplicate nonce, pause, refund and wrong account substitution. Run independently, preserving reproducible build versions.

**M2 — Solana deposit indexer.** Add finalized transaction v1 parsing (`maxSupportedTransactionVersion: 1`), transaction success, full instruction/receipt validation, deterministic PDA derivation, gap-free pagination, scanner checkpoints, block evidence and independent provider comparison.

**M3 — Verify RAVE and Unyt DNA.** Obtain exact deployed source, run fork/recovery/migration adversarial tests, and specify witness/signer trust. Do not enable credits before this gate passes.

**M4 — Nonrefundable economic escrow.** Replace refundable prototype with a carefully audited custody and redemption state machine, only once Holochain external-claim conservation and release authorization have been proven. Determine authority/upgrades and collateral proofs.

**M5 — Two-way settlement.** Implement independent signing, one-time withdrawal identities, on-chain redemption, failed-payout recovery, on-chain pause/revocation, audits and operational disaster drills.

This is a project gate checklist, not a claim that any later milestone has been implemented.

## Sprint 0 independent SEC review (#10; 2026-11-13)

- The detailed [cross-chain threat model](../security/THREAT_MODEL.md) defines P0/Critical risks, source-finality assumptions, Holochain fork/parked-spend rollback and recovery/migration replays.
- The [P0 acceptance matrix and evidence plan](../security/ACCEPTANCE.md) lists positive and negative tests, operational requirements, independent sign-off and known unverified stages.
- Run independent Node fixture tests with `node --test security/test/adversarial.test.mjs`. These validate the current denial boundary and illustrate an **untrusted RPC snapshot**; specification-only replay examples do **not** validate a deployed RAVE or Solana settlement system.
- Release invariant per asset and scope: **B >= F + H + W + O**, where B is actually available finalized collateral, F is unpaid refundable entitlement, H is externally redeemable claim value (including reversible parked claims), W is authorized unpaid payouts **only for irreversibly extinguished claims removed from H**, and O is other competing liabilities. A possibly reversible Holochain spend cannot authorize payout.
- **P0 STOP:** Any refunded/redeemable overlap, unverified Solana inclusion, Holochain fork or park reversal, migration replay, signer/upgrade compromise, non-durable paid marker or unresolved signer trust assumption blocks economic issuance and withdrawals. Neither RPC consensus labels nor green Node tests constitute proof.
- **Independent review is mandatory; SEC cannot self-approve an economic state change.** The existing `creditEligible: false`, `CREDITING_DISABLED`, and `WITHDRAWALS_DISABLED` paths remain unchanged.
