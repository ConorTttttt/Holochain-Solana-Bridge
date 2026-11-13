# Cross-chain threat model — Sprint 0 SEC review (Issue #10)

**Review date:** 2026-11-13. **Baseline:** main at 4da2eee91aede92a35121e725fc7b44309fef427. **Status:** BLOCKED for external issuance, redemption, devnet value transfer, and production custody. **Scope:** source review of the Anchor prototype, the read-only observer, the Holochain denial module, and repository research notes. Not an audit of deployed bytecode, Unyt DNA, RAVE 0.15.0 implementation, or operator infrastructure.

## 1. Trust boundaries and assets

- **Solana users and SPL token programs:** user funds and signature authorization; only the classic SPL Token program and one explicitly configured mint are in the prototype. A token mint's supply authority and market value are not guaranteed by the vault balance.
- **Solana program and custody:** upgradable Anchor program, initialization authority, config PDA, receipt PDA, vault token account, SPL mint, refund instruction, and upgrade authority. The vault/config/receipt are state, not independently authenticated proof when merely returned by an RPC.
- **Solana consensus and RPC:** finalized ledger, successful transaction inclusion, fork history, upgrades, account deletion/recreation, multiple providers, and adversarial/replayed RPC snapshots. A JSON-RPC commitment label is an assertion by that endpoint.
- **Off-chain observer, storage and bridge operators:** read-only evidence generation, checkpoint integrity, replay-state storage, signing policy, data availability, crash recovery, collusion, backups, compromise, and time-of-check/time-of-use races.
- **Holochain and Unyt:** application/DNA hash, network/scope, agent source chains, conflicting forks, DHT validation, RAVE conservation, parked-link standing, commitments, receipts, recovery agreements, migration epochs, and potentially independent witness nodes. A parked record visible to one node need not be irreversible economic extinguishment.
- **Future withdrawal authority:** signer keys, quorum membership, policy version, exact message bytes, domain separation, expiry, nonce ledger, Solana instruction/account binding, revocation/pause, vault program upgrades and final payout.
- **External dependencies:** DNS/RPC/hosting, managed signers, CI/artifact provenance, wallet compromise, archive nodes, clock and chain snapshots, and any upstream Unyt/HOT dependencies.

**Adversary capabilities:** arbitrary untrusted RPC replies (including colluding endpoints), compromised observer DB, public transaction construction, malicious depositor, colluding Holochain agents/fork authors, rollback/replay of backups, one or more compromised signers, admin/upgrade compromise, resource exhaustion, partitions, endpoint outages and malicious migration payloads. Distinguish these from cryptographically proven powers; no assumption that attackers can forge valid Solana or Ed25519 signatures absent key compromise.

## 2. Collateral and liability conservation

State all amounts as integer base units for a **single** tuple (Solana genesis, program ID and deployment version, classic SPL mint, Holochain DNA/scope, redemption epoch). Never aggregate unrelated tokens via spot-price conversion without a separate audited valuation/settlement model.

Let:
- **B** = verified actually available SPL vault balance in a canonical finalized state, excluding delegated, frozen, impaired, locked, or otherwise unavailable assets. Fees/reserves not available for claim settlement are excluded. A historical RPC screenshot alone does not establish B.
- **F** = remaining refundable depositor claims (the current prototype's active deposits), including refunds initiated but unpaid if the refund entitlement still exists.
- **H** = all outstanding externally redeemable Holochain credits, including transferable credits and any *possibly reversible* parked/retired claims. Across accepted conflicting forks, count all potentially independently enforceable claims, not simply one favored history.
- **W** = authorized but unpaid Solana payouts for claims **proven irrevocably extinguished** on Holochain and therefore removed from H. These are reserved exactly once, never also counted in H.
- **O** = other superior or parallel obligations that may debit B, including outstanding fees or reserves not yet subtracted from B, counted exactly once.

**Mandatory invariant:**

    B >= F + H + W + O

For pending withdrawal whose Holochain spend may roll back, keep the amount in H, not W, and **forbid transfer**. Only a proven irreversible debit permits atomic H-to-W reclassification. A paid withdrawal decreases B and W by the same value, atomically with a persistent paid marker. A paid refund decreases B and F equally; a refundable deposit may **never** also create H. If a possibly reversible Holochain claim can remain spendable after a Solana payout, this invariant cannot be shown and payout is blocked. A potential future mint/signer/upgrade privilege that can bypass accounting is an explicit unsatisfied trust assumption even when today's balance inequality holds.

Supply/identity invariant: each real finalized nonrefundable source entitlement contributes to H+W at most once across all forks, agreements, recovery attempts, replicas, migration epochs, deployments, and restarts. Global identities must bind genesis, program, vault, mint, receipt/deposit event, Solana transaction identity, Holochain DNA/agreement/asset scope and policy epoch. Reuse of an identity across incompatible namespaces must not yield another payout. Do not infer uniqueness merely from a depositor nonce local to one instance.

**Current baseline:** H=0, W=0. Refund obligations F correspond to refundable active receipts, and the on-chain code attempts to enforce vault amount >= config.total_active. No claim is made that this has passed compilation, validator testing, audit, or that the observer has independently proved finalized custody.

## 3. Findings: severity / preconditions / evidence / confidence

| ID | Severity | Finding and attack prerequisites | Classification and current protection | Required mitigation |
|---|---|---|---|---|
| SEC-P0-01 | **Critical, release blocker** | Refund after an apparently finalized deposit can remove 100 collateral while 100 externally redeemable Holochain credit remains, **if a future issuer honors the observation**. | **Confirmed** refundable deposit, refund path and denial gate in source; **conditional exploit**, not current executable theft. High confidence. | Do not issue from refundable receipts; implement separately audited irreversible escrow, atomic obligation conversion and tests for refund-after-issuance. |
| SEC-P0-02 | **Critical, release blocker** | A compromised or colluding RPC asserts fake/old finalized accounts, arbitrary slot, forged receipt-to-address association or upgrade history; future issuer accepts it. | **Confirmed trust-boundary gap**: read-only observer checks structure and reported state, does not verify inclusion, rederive receipt PDA, or cryptographically verify consensus. High confidence; no current issuance. | Authenticated consensus/attestation scheme with explicit quorum assumptions, transaction success/instruction checks, receipt PDA derivation, upgrades/program ID verification, historical reconciliation, fail-closed rollback and stale data. |
| SEC-P0-03 | **Critical, release blocker** | A forked or rolled-back Holochain source chain makes parked/retired value spendable after signer-approved payout. | **Unverified**: exact deployed Unyt DNA, RAVE executor and definitive parked-spend proof absent. Cannot claim current exploit. | Independently validate exact economic-spend proof and non-reversibility; fork/partition/disputed-chain tests against exact zomes and witness/signer software. |
| SEC-P0-04 | **Critical, release blocker** | Migration, duplicated recovery entitlement, restored DB or signer replay pays one extinguished claim twice. | **Not implemented**, no global withdrawal state machine or deployed Solana one-time payout. High impact, unknown exploitability today. | On-chain persistent global redemption PDA/nonce domain binding and atomic paid status, no replay ledger reset on upgrades/migrations; cross-epoch and crash tests. |
| SEC-P0-05 | **Critical, release blocker** | Program upgrade, admin takeover or signer quorum compromise substitutes mint/vault/withdrawal semantics or drains collateral. | **Confirmed governance gap**: placeholder program ID, upgradable program not governed, first-initialize admin, no payout signer implementation. High confidence in missing controls. | Source/bytecode equivalence, pin program ID, upgrade governance/timelock/pause, independent threshold operators and incident/revocation policy. |
| SEC-H-06 | **High, prerelease blocker** | PDA/account substitution and recipient/asset/scope confusion; attacker supplies expected addresses, or mismatches transaction instruction vs observed bytes. | Observer validates account owners, shapes, embedded references and scope but **does not independently derive all PDAs** or verify successful inclusion; account constraints are in uncompiled Rust. Confirmed partial validation. | Derive config/vault/receipt with audited SDK, verify bumps, token program, vault signer, mint authority and transaction semantics; run validator negative tests. |
| SEC-H-07 | **High, prerelease blocker** | Crash, chain rollback, endpoint outage or corrupt checkpoint misses refund/withdrawal; old evidence is reused. | No indexer, gap-free replay, durable dedupe or witness freshness guarantee. Confirmed missing service. | Two-source reconciliation, canonical history checkpoint, gap-free replay, write-ahead settlement log, recovery drills; no acceptance during gaps. |
| SEC-H-08 | **High, prerelease blocker** | Source deposit funding becomes unavailable due to token freeze, inflation, authority abuse, compliance/transfer restrictions or vault delegated privilege. | Prototype rejects mint freeze authority at initialization and observer checks vault delegate/frozen; authority and mint supply risk remain not independently monitored. | Review classic mint authority and token economics; use disposable assets until explicit reviewed asset policy. |
| SEC-H-09 | **High, prerelease blocker** | Unauthorized Holochain release justified by RAVE output, parked-link standing at one node or signed but stale witness attestation. | No integrated Unyt execution or independently verified standing. Trust assumption, not a confirmed RAVE flaw. | Validate exact zomes, independent nodes/quorum, conflicting history and rollback proofs; fail closed on disagreement/timeouts. |
| SEC-M-10 | **Medium, design risk** | Replay between chains/networks, withdrawal programs or signature policy versions due to ambiguous signing payload. | Future interface missing, unverified. | Canonical signed message includes genesis, program, mint/vault, Holochain DNA/asset, unique redemption, destination, amount, expiry, policy epoch and hash of irreversible-spend proof. |

No line in the above asserts successful on-chain exploit execution. The existing code's withdrawal and issuance functions throw unconditionally; the safety interlock must remain.

## 4. Scenarios required for adversarial acceptance

- **Solana fork and RPC equivocation:** include failed/nonincluded transactions, stale finalized reads, fabricated block slot, v0/v1 address lookup tables, two colluding RPCs, and state change across finalized snapshots; verify fail-closed until proven canonical and sufficiently final.
- **PDA/account substitution:** independently derive config/vault/receipt, verify owner, bump and data lengths, reject swapped program/mint/scope/recipient/nonce and invalid token authority/delegate/close; confirm wrong-signer and duplicate nonce rejection on local-validator.
- **Program upgrade and first-init:** preinitialization, unapproved upgrade, corrupt IDL/IDL-to-code mismatch, upgrade during observer/redeemer operation and signer policy rotation; require explicit trust governance.
- **Refund after observation or external credit:** on same-source finalized history observe active deposit, refund later, then attempt any credit; issuance MUST stay disabled, including if a cache has the earlier observation.
- **Holochain forks and parked spends:** two divergent source chains spend the same claim; parked-link standing independently varies by peer, is revoked, repaired or reorged; no payout until only one durable economic extinction is accepted.
- **RAVE conservation and recovery:** duplicate commitments/receipts, parked transfer reversal, partially executed agreement, lost receipt, simultaneous spending, asymmetric peer views, backup-restored recovery; assert that no combination mints value or restores previously paid claim.
- **Migration:** replay same deposit or withdrawal under a new DNA, agreement, network scope or signing epoch, plus recovery of original identity. Persistent global replay state must reject them or require a formally proven one-to-one migration with old claims disabled.
- **Signer and custody:** replay, amount/destination/vault substitution, signed-payload ambiguity, missing expiry, revoked key, compromised minority/quorum, duplicate signatures, simultaneous payout requests and pausing, exactly-once payout even on restart/transaction retransmit.
- **Infrastructure:** missing RPC history, provider disagreement, DB wipe, stale encrypted backup, signer key leakage, archive gaps, observer crash mid-checkpoint, network partition and authority compromise; no new issuance or release while consistency is uncertain.

## 5. Control boundary: what is and is not proved

The observer test suite and SEC-lane test fixtures can confirm JavaScript parsing and refusal semantics only. Synthetic snapshots show *acceptance of an RPC-like assertion*, not that Solana actually contained the state. The specification-only replay ledger in security/test/adversarial.test.mjs demonstrates required invariants, **not** compliance by existing deployed code.

Absent evidence: reproducible Anchor build/IDL, local-validator transactions, real finalized instruction/inclusion verification, upgraded/deployed program equivalence, Holochain exact DNA hashes/zomes, executed RAVE fork+recovery simulations, operational signer quorum and disaster-recovery testing. All remain BLOCKED.

**Non-self-approval:** independent human/SEC reviewer separate from the implementing SOL/OBS/RAVE agent must approve future economic authorization changes; this SEC documentation PR does not grant a release waiver.
