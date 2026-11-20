# ADR-SOL-2026-11-14 — Alternative future custody, atomic authority and single-use redemption

**Status:** RESEARCH / PROPOSED TEST-ONLY ALTERNATIVE; NOT APPROVED OR IMPLEMENTED.
**Owner:** Agent 2 (SOL), independent review required by Agent 5.
**Baseline:** official PR #35 at `6492260f184e69f86abce02466878c25d666324d`.
**Scope:** a *separately deployed* disposable localnet experiment, not a patch to the existing refundable `deposit_prototype` program.
**Security decision now:** SEC Gate C remains NO-GO. No spendable Holochain credit, economic settlement, value-bearing custody or Solana withdrawals.

## Primary source observations, not claims about this repository

1. Unyt [`HoloBridgeDeployer.sol`](https://github.com/unytco/raindex-orders/blob/main/src/HoloBridgeDeployer.sol) constructs its claim token and vault, adds the claim order and hands vault control to the configured admin inside **one EVM transaction**. Constructor failure rolls the whole transaction back. The deployer's caller is never the final administrator. **Analogy only:** deployment-time authority and initial configuration should be inseparable; an EVM constructor is not a deployable Solana instruction.
2. Wormhole [NTT Solana manager documentation](https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/manager/solana/) describes `Config` (owner and pending owner, token mode, mint, custody, threshold and pause), registered transceivers, `OutboxItem`/`InboxItem`, inbound/outbound rate-limit queues, `transfer_lock`, `receive_wormhole_message`, `redeem`, `release_inbound_unlock` and token authority handoffs. These are a useful *reference state machine*, not a supplied Holochain attestation or permission to call a production bridge.
3. deBridge [`DlnSource.sol`](https://github.com/debridge-finance/dln-contracts/blob/main/contracts/DLN/DlnSource.sol) distinguishes `Created`, `ClaimedUnlock` and `ClaimedCancel`; claims depend on authenticated cross-chain sender and source/destination chain checks. Its [`DlnDestination.sol`](https://github.com/debridge-finance/dln-contracts/blob/main/contracts/DLN/DlnDestination.sol) makes fulfillment and cancellation mutually exclusive when the take-side order is `NotSet`; cancellation requires order authority and conditional beneficiary checks. **Inference:** a cross-chain cancel is an authenticated protocol transition, not a depositor refund button. This code is BUSL-1.1; this ADR copies no code.
4. Unyt's [signer-service design](https://github.com/unytco/raindex-orders/blob/main/docs/signer-service.md) independently rechecks origin/destination authorization, nonce and claim order per signer; transport/orchestration is not itself payout approval.

The separately uploaded project research brief `holochain_solana_bridge_external_research_2026-11-14.md` is an *external research source*, not proof these patterns are implemented or verified here. Existing repository primitives remain refundable and first-initializer-capturable.

## Goals and non-goals

**Future goals:** single domain-bound localnet source event; irreversible entitlement commitment before *any* external economic acceptance; authenticated and replay-resistant claims; conservation under pause, upgrade, token transfers and cancellation; a governance model with independent payout authorization.

**Non-goals for this round:** changing `programs/deposit_prototype/src/lib.rs`; provisioning real-world mint authority; integrating released Unyt coordinator zomes or calling `execute_rave`; trusting a local RPC's `finalized` report as independent Solana consensus; implementing production-signing, spend, withdrawal or bridged credit.

Every existing and proposed *audit-only observation envelope* must have these exact values, including every nested record:

```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

## Candidate separately deployed V2 model (NOT an approved change)

### Authority/bootstrap

- Deploy a uniquely addressed, reviewed V2 Anchor binary with exact ELF/IDL hashes, genesis and upgrade epoch. Its initialize path must require an **explicit governance initialization authority** validated on chain (for example against verified ProgramData upgrade authority or an immutable, committed authority key); merely being the first signer cannot initialize a global PDA.
- Use deterministic domain-specific `config_v2` PDA, derived per scope/mint/governance epoch. The initialization instruction must atomically create config and custody and assign mint/governance roles *within the already deployed program*, checking the expected program upgrade authority, mint owner, freeze/delegate/close authorities, SPL token program, mint decimals, initial liabilities zero, and approved signer quorum.
- Important Solana difference: program ELF deployment itself may require separate transactions and cannot be asserted atomic with config creation merely because an EVM constructor is atomic. Before opening deposits, block all other instructions until the authorized initializer has succeeded; verify signed deployment manifest, deployed ProgramData bytes and any upgrade-authority transition. No interval of uncontrolled first-initializer capture is allowed.
- Distinguish `config.owner`, `pending_owner`, `pause_guardian`, upgradeable-loader `ProgramData.upgrade_authority`, mint authority, and payout-attestor epoch. Require an independent delayed/two-phase transfer for changes that could affect custody. Renouncing an authority should be explicit and provable, never inferred.
- Pausing blocks new deposits, commitments, attestation acceptance and releases as appropriate; it must not silently refund a committed entitlement or erase obligations. Unpause and emergency recovery require governed auditable actions.

### State and transition authorization

| State | What funds/entitlement mean | Allowed next transitions |
|---|---|---|
| `PENDING` | SPL collateral held but **no external entitlement**; depositor refund possible only under a provably uncommitted cancellation rule | `COMMITTED` with governed, durable attestation setup; or `CANCELLED` before commitment |
| `COMMITTED` | Nonrefundable collateral backing one externally acceptable claim; depositor **cannot** refund | `REDEMPTION_PENDING` on authenticated Holochain retirement proof; emergency governance pause only |
| `REDEMPTION_PENDING` | Already authorized unpaid liability; unique claim ID reserved and recipient/amount fixed | `RELEASED` once, via independent approval |
| `RELEASED` | Token payout already executed and claim marker consumed; no remaining claim | Terminal |
| `CANCELLED` | Pending-only refund with irrevocable cancellation tombstone; any later commitment/delivery rejected | Terminal |

A separate `paused` configuration bit is **orthogonal** to each state; it does not rewrite transaction history.

- `deposit_pending`: debit exactly `amount` classic SPL base units via checked transfer, create `deposit_v2` PDA keyed by scoped owner+nonce, verify receipt source, mint, token program and vault. Deny noncanonical accounts, reentrancy-like CPI authority substitutes, u64 overflow, duplicate nonces, and first-init race.
- `commit_deposit`: one-way `PENDING -> COMMITTED` transition with exact on-chain commitment receipt and bound message hash. The resulting Solana collateral can never be unilaterally refunded. No Holochain economic acceptance may precede independently verified evidence of this committed event; a bare pending deposit is insufficient.
- `cancel_pending`: only a truly pending item, before *any* external acceptance may become valid; require an enforceable cancellation/tombstone protocol and independent proof of non-acceptance where another domain is involved. **Absence of an observed Holochain record is not proof of non-issuance.** If conclusive safety is unavailable, fail closed and hold funds pending governed recovery, not unilateral timeout release.
- `initiate_redeem`: authenticate irreversible Holochain burn/retirement (not an audit-only write) under a separately approved source-equivalent Unyt protocol and independently controlled checker set; consume a claim nonce, bind recipient, amount and expiry, set `REDEMPTION_PENDING`.
- `release_redeemed`: check threshold signatures over exact claim digest and signer epoch, destination token account authority, mint, amount and vault budget; atomically mark claim as `RELEASED` before/with SPL transfer, with runtime rollback on failure. A second attempt, equivocated attestation or another order using the nonce fails.

### Signed domains and anti-replay

Use a canonical binary encoding (not ambiguous concatenation), versioned domain separators, unambiguous field lengths and integer base-unit units; bind **at minimum**:

```text
HSC/sol-v2/deposit-commit/v1
genesis_hash | program_id | deployment_epoch | governed_scope | mint |
token_program | mint_decimals | vault_pda | receipt_pda | depositor |
holochain_network_id | dna_hash | recipient_core | nonce_u64 |
amount_u64 | occurrence_sequence | commitment_block_ref
```

Payout approval uses a **different** domain, e.g. `HSC/sol-v2/redeem/v1` with source commit, distinct Holochain retirement action/hash, verifier epoch, recipient Solana token address, amount, nonce, expiry and threshold policy. No signature may validate across programs, assets, networks, epochs, actions or message types. Use persisted claim receipt PDAs/tombstones and explicit quorum non-equivocation. Check chain restoration, fork, rollback, signers sharing one operator and signer overlap before assigning any independent-security status.

### Conservation and trust

For each mint and scope, enforce with checked integer arithmetic:

```text
outstanding externally redeemable liabilities
  + already-authorized but unpaid redemption obligations
  <= actually spendable, unencumbered custody base units
```

Count each receipt's liability in *exactly one* bucket; transfer a liability from committed to redemption_pending without double-counting. Only after successful release does the paid amount leave both vault and outstanding obligations. Donations are not obligations; tokens subject to a delegate/close/freeze authority are not unrestricted available collateral. Independently audit all ledger receipts and unauthorized SPL changes.

**Security model alternatives for future review:** (A) signed self-operated RPC report; (B) truly independently operated attestor quorum (Wormhole/LayerZero/Hyperlane-like), verifying original consensus assumptions before signing; (C) Solana light-client/history verification or a separately justified consensus-proof system. Multiple RPC URLs hitting one validator are **one trust domain**, not independent consensus. Checkpoint digests and HMAC logs provide audit provenance, not Byzantine finality. No economic transition until an explicit security model is reviewed and implemented.

### Proposed independent adversarial gate (not implemented)

1. First initializer is unauthorized even on fresh genesis; expected initializer + governed handoff succeeds, wrong upgrade authority and mutable mint roles fail.
2. `PENDING -> COMMITTED` exactly once, and every refund attempt after commit fails; committed collateral can never be refunded on an observed timeout.
3. Cancel after any accepted/acceptance-capable external claim fails; failed bridge delivery requires reconciled state, not local negative evidence.
4. Canonical nonce and claim replay, altered Holochain DNA/network, program/mint/scope, recipient, amount, decimals, validator epoch, expiry, signer order, disjoint quorums, swapped vault, equivocation and ledger rollback all fail under named classes.
5. Under worst-case concurrent deposits, cancellations and redemptions, liability buckets and vault balance remain conservative; duplicate payment is impossible.
6. Pause and upgrading cannot bypass checks; tested governance recovery retains liabilities and evidence history.
7. Full test harness retains exact original signed wires, generated IDL/ELF and two-provider **original** histories, records limits explicitly, and never assumes actual Unyt authorization.

## Decision and handoffs

**Decision now:** `do not implement` in the current prototype or audit demo. Existing refundable localnet receipts remain observation-only. Agent 1 may deliver the audit-only demo without implementing this ADR.

**Agent 5 review needed:** admissible consensus/attestation model, cancellation non-issuance proof, governance threshold independence, ProgramData authority handoff, upgrade epoch, liability invariants, nonce/tombstone strategy and payout signature/expiration rules.

**Agent 3 review needed:** event envelope version and durable observation/reconciliation semantics; do not convert incomplete historical coverage into settlement proof.

**Evidence classification:** external primary source patterns (links above) + design inference. No V2 program, tests, deployment, independent finality, legitimate Unyt economic role or SEC acceptance exist by virtue of this document.
