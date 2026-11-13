# SEC #10 — P0 acceptance gates, test vectors and evidence manifest

**All gates below remain FAIL/BLOCKED until exact implementation plus independent proof is supplied.** Node fixture tests are narrow S0 boundary tests; they do not close any future economic gate.

## Executable baseline

Run from the repository root with Node.js 20 or later:

    node --test security/test/adversarial.test.mjs
    node --test observer/test/verify.test.mjs
    node --check security/test/adversarial.test.mjs

SEC-01 through SEC-07 assert current denial behavior, refund-after-observation, missing PDA provenance, missing finalized-chain proof, mismatch rejection and inability of two matching snapshots to grant issuance. SPEC-01 through SPEC-04 exercise **only an in-test reference model** of reserved/paid obligations, recovery identity and replay. A passing SPEC test does not establish on-chain or Unyt economic guarantees.

### Reproducibility and honest status

- Reviewed tree: main commit 4da2eee91aede92a35121e725fc7b44309fef427.
- JS syntax and unit-test logs: attach real output and exact Node version to Issue #10 PR; if not executed, mark NOT RUN.
- Anchor compilation and generated IDL: NOT RUN by SEC; depend on #7 and #11.
- Solana local validator: NOT RUN by SEC; no on-chain adversarial exploit evidence.
- RAVE 0.15.0 and production Unyt DNA: NOT RUN / exact deployed source and execution proofs not available in this repo.
- Operator keys, production signer protocol, custody/withdrawal implementation: NOT IMPLEMENTED in this repo.

## Independent stop-ship acceptance matrix

| Gate | Positive evidence to supply | Negative/adversarial evidence to supply | Reviewer / required artifact |
|---|---|---|---|
| P0-A Source collateral and nonrefundability | One finalized, successful, nonrefundable Solana localnet deposit; deterministic transaction + receipt identity, custody trace and account/PDA rederivation | Refund-after-credit attempt, wrong mint/owner/vault, fake finalized RPC, reorg/replay, transaction failure and program-upgrade race must NEVER issue | SOL + OBS evidence bundle, verified IDL/deployment hash; independent SEC approval |
| P0-B Source observation | Gap-free block/transaction scanner with v0/v1 tx support, versioned IDL, two independent source checks and archival recovery | Duplicate nonces and tx instructions, skipped slots, RPC disagreement, stale snapshots, data loss and collusion trigger pause; no issuance | OBS signed evidence schema, source-trust model, deterministic regression fixtures and CI logs |
| P0-C Holochain conservation | Exact deployed RAVE/DNA/source hashes; amount-preserving issuance and debit with checked integer arithmetic | Forked source chains, double spends, conflicting peers, parked-spend rollback, partial agreement, duplicate receipt or commitment and concurrent recovery all rejected | RAVE owner provides direct zome/engine execution logs, distinct SEC reviewer verifies |
| P0-D Refund vs credit exclusivity | Issuer proves a deposit's Solana refund entitlement is irreversibly disabled before issuing any Holochain redeemable claim | Cached pre-refund state, deposit refund after issuance, two-credit replay and reorg must not create liability > B | Tested alternate nonrefundable custody protocol; no edits to current denial gate until explicitly approved |
| P0-E One-time redemption | Holochain claim's final irreversible extinction is independently attested, then converted atomically from H to W; Solana pays once and writes durable status | Attempt payout on stale/reversible parked link, same claim twice, concurrent/retransmitted signatures, output destination substitution, crash after payout and DB loss | Independent signers + on-chain settlement state; SEC must review both sides |
| P0-F Recovery/migration continuity | Replay ledger persists across DNA/epoch/agreement migrations and restored backups; mutually exclusive old/new claims | Duplicate entitlement minted from one source across epochs, double spend under fork, replay of recovery agreement, cleanup of spent status, rolled-back DB all rejected | RAVE + SOL integration logs, SEC review of invariant across all recognized histories |
| P0-G Signer/admin compromise | Threshold rotation, timelock/upgrade controls, policy versioning, deployed equivalence, pause and revocation drills | Compromised minority signer, forged quorum, stale authorization, malicious upgrade, first-init race, replay across genesis/program/mint/epoch all rejected | Security operations runbook and threshold key governance independently reviewed |
| P0-H Global solvency and operations | Continuous exact-unit reconciliation B >= F + H + W + O including all pending claims, custody proof and freeze-on-gap monitoring | Mint-vault mismatch, spent claim remains spendable after payout, insolvent state, double-counted pending, network outage, backup loss all block transfers | Signed reconciliation, failure-injection logs and external audit |

All requirements are per specific mint, Solana genesis and Holochain DNA/scope. Provider agreement is **not** a proof of source-chain finality; RAVE deterministic execution is **not** a proof of Solana custody. Stale parked-link standing is **not** a proof of irreversible debit.

## Required exit criteria and human sign-off

1. The exact tested source matches what is deployed on each side; show program ID, program-data hash/upgrade authority, DNA hashes and reproducible artifact checksums.
2. Each P0 row has a passing ordinary test **and** a passing adversarial failure test with actual commands, environment versions, output, seeds/fixtures and failure impact.
3. The Solana settlement contract enforces once-only redemption and debit atomically and is independently audited. Permanent replay markers and nonce scope survive all migrations.
4. Demonstrate end-to-end claim extinction before payout; a user never simultaneously possesses a spendable Holochain claim and released equivalent Solana collateral.
5. Independent security reviewers who did not implement the economic changes explicitly approve a **separate** gated promotion PR. No automatic release on green CI.
6. Any unresolved source-finality, fork, recovery, signer, upgrade or collateral accounting uncertainty keeps all value-moving paths disabled.

## Handoff to other lanes

- **SOL #7:** send pinned tool versions, built IDL, PDA derivation tests, program upgrade authority constraints and local validator refund/nonce tests. Existing refundable prototype MUST stay a no-credit artifact.
- **OBS #8:** send concrete source-consensus trust model, successful transaction proof and canonical account/PDA verification; test fabricated finalized slots and two colluding stale RPCs.
- **RAVE #9:** send exact source/DNA hashes, full parked-link/receipt/recovery state machine and replay/fork tests; show how independent signers know economic extinction is durable.
- **CI #11:** run Node SEC test from the root and log its output, but never report Node success as Anchor build, Solana validator, or Holochain settlement proof.

Re-review every proposed SOL/OBS/RAVE economic change and open blocking comments or follow-up issues on unfulfilled rows. This document is an acceptance plan, **not** a release authorization.
