# Issue #9 — RAVE 0.15.0 investigation and shadow-only handoff

Date: 2026-11-13 | Sprint: S0 | Status: source inventory and offline-fixture tests only.

**SAFETY GATE:** No Holochain value issuance, no spendable credits, no withdrawal authorizations, no real funds, and no claim that publicly available RAVE source matches deployed Unyt DNA. The prototype deposits can be refunded. The existing holochain/evidence-gate.mjs denial remains unchanged.

## Reproducibility and exact provenance

1. The published rave_engine crate version 0.15.0 can be browsed at https://docs.rs/crate/rave_engine/0.15.0/source/ . Package Cargo.toml lists hdi 0.8.1, hdk 0.7.1, rhai ^1.21.0, and zfuel 0.9.1. Published .cargo_vcs_info.json names Git SHA 753eb97c474b7c180c403bd26231e47a03ba52b9 and workspace path crates/rave_engine. **That Git SHA is not a cryptographic checksum of the published .crate tarball.**
2. The public agreement library was inspected at https://github.com/unytco/smart_agreement_library/tree/be2d630a3f3861c66b1b2ee341ff1c76b28210b8 .
3. The HOT bridge was inspected at https://github.com/unytco/raindex-orders/tree/c0e0ccbaa0103f1b462c0211c3d926396323b004 . Its bridge-orchestrator/Cargo.toml explicitly pins rave_engine = "=0.15.0".
4. The published package tarball could not be downloaded and SHA-256 verified in this runner (outbound DNS/network restricted). Its checksum is an OPEN S0 task. In addition, access to deployed Unyt integrity/coordinator DNA and zome artifacts was not established. **Public-source-to-deployed-DNA equivalence is UNVERIFIED.**

### RAVE code surface

| Behaviour | Published crate source path or relevant public artifact |
| --- | --- |
| RAVE Rhai execution | src/rhai_engine/mod.rs |
| Input schema validation | src/json_schema_validator/mod.rs; src/types/entries/rave/rave_input.rs |
| RAVE outputs and input consumption | src/types/entries/rave/rave_output.rs and src/types/entries/rave/mod.rs |
| Ledger, balance and carry-forward | src/types/ledger/mod.rs and src/types/ledger/state/ |
| Commit, receipt, accept, reject, reclaim | src/types/entries/commitment.rs, accept.rs, reject.rs, receipt.rs, reclaim.rs |
| Parked spending and standing | src/types/entries/rave/parked_link/mod.rs |
| Conservation constraint for reserves | src/reserve.rs, ReserveUnits::accepts |
| Smart agreements and host helpers | src/types/entries/smart_agreement/ and src/helper_fn/ |

ParkedLinkStanding is a four-way enum: Parked(Box<Transaction>), Unparked, NotAParkedLink, NotHeld. A node observing Parked at one instant is not independently a globally unique, partition-safe, cross-epoch proof of external settlement. The published Receipt models RAVE payment sources, not verified Solana collateral.

ReserveUnits::accepts requires exactly two units, a negative debit and equal positive credit. Other economic validity depends on host functions, ledger progression and exact running DNA/zomes, which were NOT independently tested.

### HOT bridge signer interface (reference, not Solana integration)

At unytco/raindex-orders/bridge-orchestrator/src/signer/service/checks.rs each signer checks its own independently connected Holochain cell for standing(withdrawal). The service proceeds only when Parked and refuses Unparked, NotAParkedLink, NotHeld, or unavailable status. It then checks the exact bridge agreement, executor, parked-spend role and vault, HOT amount, withdrawal recipient, nonce, expiry, chain, Safe owner/order and locally reconstructed signature hash. The service records the signed withdrawal/order association durably before signing for an order; see signer/service/records.rs. docs/signer-service.md describes on-chain claim-store nonce replay protection and operational rules for order rotation. This is the HOT/EVM path, not an independently audited Solana withdrawal protocol.

Other references: bridge-orchestrator/src/lock_flow.rs, src/orchestrator.rs, src/orchestrator/withdrawal.rs, src/signer.rs.

### Credit-limit adjustment, reservation, recovery

The public smart_agreement_library/library/__system_credit_limit_adjustment/execution_code.rhai (also _lane_credit_limit_adjustment_unyt) reads consumed_inputs.proof_of_deposit; a bridge call adds a deposit and subtracts a withdrawal from credit_limit. That code is not an authorization to feed Solana RPC observations to Unyt. Its reserve path checks matching, equal and opposite unit amounts, and uses find_run_citing(agreement, previous.id, commitment.id) to block an already-cited commitment along the relevant executor history. The check is agreement-contextual and history-bounded; cross-agreement global uniqueness is not established.

The published library/__system_unit_recovery/execution_code.rhai carries a map of recovered commitments in previous_execution.output.carryover.recovered and rejects membership duplicates. Its comments explicitly describe **once per agreement**, including a new agreement beginning without the old agreement's credit. There is no demonstrated globally authoritative recovered-commitment registry surviving replacement, different recovery agents, DNA migration or partition. This is a **P0 hypothesis and test obligation**, not proof of a deployed exploit.

A source-chain fork, conflicting agent histories, insufficient validation receipts or a partition can make one cell's local acceptance/standing differ from another node's state. Economic conservation requires testing those divergent histories under actual zomes and checking the effective ledger/commitments, not merely validating a Rhai output. Lost receipts and crashes between a reserve, RAVE execution and external release require explicit recovery/payout reconciliation.

## Strict shadow observation interface proposal

Input A: immutable observer snapshot of schema kind solana-receipt-observation-v1, including id (= genesis:program:receipt), genesisHash, program, receiptAddress, configAddress, vaultAddress, mint, depositor, recipientCore, holochainScope, depositNonce, amountBaseUnits (exact decimal u64), finalizedSlot, receiptDigest, refunded, state and creditEligible=false. Treat this as a potentially incorrect RPC observation, not consensus attestation or collateral.

Input B: **separately configured** target binding with genesisHash, program, mint, holochainScope, dnaHash, agreementHash and deploymentEpoch. Binding alone does not authenticate that a DNA is deployed or a receipt is valid.

Output: a read-only finding with mode="shadow-only"; verdict="quarantined" for a syntactically consistent but economically unsafe/refundable receipt or "rejected" on inconsistent inputs, state conflicts or replay; findings[]; evidenceId; proofStatus="untrusted-rpc-observation"; creditEligible=false; spendableBaseUnits="0"; withdrawalAuthorized=false. These negative economic fields are unconditional, including for refundable/unrefunded data and successful replay classification.

Reference-only implementation: holochain/shadow-review.mjs. This module has **no conductor/zome, network, signing, mint, or agreement execution side effects**. A passed-in in-memory Map tracks local fixture identities and refuses agreement/epoch/DNA replay and backwards refund transitions. It is NOT a durable, shared, crash-consistent, consensus-approved anti-replay ledger. No permitted production use of its verdict should create economic state.

Sequence: finalized RPC observer result -> independent format/binding comparison -> read-only quarantine/rejection audit -> OBS/SEC investigation. NEVER call issueHolochainCredit, a Unyt credit agreement, or authorizeSolanaWithdrawal. Keep holochain/evidence-gate.mjs unchanged. No Holochain node is connected.

**OBS handoff:** Publish stable identity and subsequent observation revisions, transaction inclusion/versions, PDA derivation, owner/authority and program upgrades, signed source evidence and finalized backfill. Specify immutable event IDs, sequence/rollback, and two-provider disagreement. Preserve creditEligible=false.

**SEC handoff:** Investigate duplicate recovery after agreement replacement, concurrent forked Parked status seen by independent signers, source-chain fork validation, replica partition, receipt loss, unconfirmed refunds, bridge solvency and compromised attestations. Require globally atomic/durable replay state across deployment epochs and independent external settlement signatures.

## Executed tests and unexecuted harness

Actual local runtime: Node v22.16.0.
Actual command, run from project root:

    node --test tests/holochain/*.test.mjs

Result: **14 tests passed, 0 failed**. Includes positive-but-quarantined receipt, repeated identity, mismatched scope/program/mint, invalid quantities, forged eligibility, conflicting receipt history, refund transition/rollback, recycled agreement and DNA epoch, parked-standing changes, inaccessible signer, repeated recovery, recovery replay with isolated partitioned journals, and conservation-invalid fixtures.

The replay and parked tests are **offline adversarial models**. Passing them does NOT demonstrate RAVE acceptance, deployed Holochain validation or source-chain fork resilience. Specifically, the fixture using two separate journals intentionally demonstrates that absent a global ledger, two independent domains can each accept the same original commitment.

Optional Rust package harness at tests/holochain/rave-engine/ pins rave_engine = "=0.15.0" and includes published ReserveUnits::accepts positive/adversarial fixtures. **It was NOT compiled or run:** cargo/rustc and a Holochain conductor were unavailable in this runner. Do not count these as passed tests. External reviewer commands:

    curl --fail --location --output rave_engine-0.15.0.crate https://static.crates.io/crates/rave_engine/rave_engine-0.15.0.crate
    sha256sum rave_engine-0.15.0.crate
    # Compare SHA-256 to the crates.io registry index cksum for 0.15.0.
    cargo test --manifest-path tests/holochain/rave-engine/Cargo.toml
    node --test tests/holochain/*.test.mjs

Unresolved acceptance tests against the exact **deployed** DNA/zomes: repeated recovery across two recovery agreements or epochs; duplicated proof_of_deposit under agreement replacement; competing parked withdrawals during source-chain forks and partitions; rollback/reject after prior receipt; crashed or lost execution receipt; recovery state migration and exact ledger fee/obligation conservation. Promotion to spendable credit is STOPPED pending all evidence and independent security approval.
