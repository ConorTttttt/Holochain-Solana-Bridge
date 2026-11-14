# ADR-SEC-ATT-2026-11-14 — External attestations, committed custody and cross-network uniqueness

**State:** PROPOSED / RESEARCH-ONLY — NOT IMPLEMENTED, APPROVED OR REQUIRED FOR THE AUDIT-ONLY DEMO.
**Owner:** Agent 5 independent security review. **Decision requested:** choose a declared future economic source-authentication and custody design **only after** present SOL/OBS/Holochain evidence is fixed and custody economics redesigned.
**Reviewed context:** project external research `holochain_solana_bridge_external_research_2026-11-14.md` (research only); SOL #40 `b4d776320f291d4eb526026a33aff2443ae48310` FAILED [run 43584777333](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43584777333); OBS #36 `2931c5fc51736e3c845cb9bedc55c578534b53a1` source only; RAVE #34 `e34e0f874b2465f89dbb8e552c6eec647f4410ac` 5/5 conductor/static-shadow PASS; integrated #39 `6a415018792e79aa7ab2962b9c9f8003a5bcc8bb` three OBS replay failures. Future advancement requires independently pinned new evidence.

## Decision / context

**Near-term decision:** finish existing **disposable Solana localnet -> real signed Observer RPC claim -> authenticated write to an entirely new controlled Holochain audit DNA -> signed ActionHash readback -> refund/revocation** demonstration. It has **no economic entitlement** and always includes `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false` on outer and nested observations. No bridge protocol migration, Wormhole deployment or new attestation dependency is needed to demonstrate this limited path. **Original Unyt v0.117.0 coordinator source/ABI/caller provenance remains unavailable**.

**Economic decision deferred:** choose among explicitly configured attestor quorum/checkpoints (A), canonical Wormhole Core VAA (B), or future modular verifier (C) **only after** nonrefundable/committed collateral and global one-time claim semantics exist. No solution below transforms a refundable original deposit into valid cross-chain collateral.

### Trust boundary common to every option

Canonical claim `HSC/claim/v1` must domain-bind origin Solana **genesis, program, upgrade/deployment epoch, mint/decimals, config/vault, receipt PDA, depositor, nonce, recipient, Holochain target DNA/agreement/epoch, original transaction signature + instruction path, u64 amount, source block slot/hash, finalized evidence policy, claim kind, expiry, signer/verifier epoch and previous checkpoint/consumption marker**. Hash an unambiguous canonical binary encoding with explicit algorithm and version. Public JSON values or independently mutable labels must not supply trusted identity. Require signed code/source and exact deployed ELF/IDL/upgrade governance evidence.

**Consensus/trust truth:** a self-operated RPC finalized response, two matching RPC providers, 3 keys controlled by one host, a Holochain action signature, an HMAC telemetry report or a locally hashed journal are NOT independent Solana consensus. A threshold attestation is a claim by named operators under stated source-chain verification policy; it is not automatically a Solana light client. To survive host rollback, checkpoint/high-water mark and consumption registry must be outside that host's control.

## Option A — two-provider history + externally operated threshold checkpoint

**Mechanism:** each independent attestor re-fetches or authenticates full original produced-slot ranges and signed transaction/block/account evidence under a documented finality model; validates program/mint/receipt/refund and custody invariants; compares its own off-host monotonic high-water mark; signs a canonical sequential checkpoint (e.g. `HSC/observer-ledger-checkpoint/v1`), including genesis/program/mint/scope/DNA/deployment epoch, original range bounds/tip/hash, all-block digest, deposit/refund root, cumulative totals, previous digest, signer set epoch and sequence. For illustrative reference only: **3-of-5 separately operated Ed25519 signers**, each with its own hardware/isolated key, independent operator and independent archive; *not* a production policy or proof. Publish signatures, off-host append-only receipt and consistency evidence, prohibit same-sequence double-signing, rotate by separately approved governance. The Holochain destination checks explicit signer list/threshold, canonical digest and previously anchored checkpoint/consumption identity; do NOT treat the audit DNA as a consensus ledger.

**Pros:** can be prototyped entirely with local-validator fixtures and simulated independent signing; preserves full historical audit, refund and operator forensics; source/destination verification format is project-owned and upgradable; can explicitly fail on pruned history. Reuse SEC reference-only test `security/test/external-checkpoint-reference.test.mjs` (5 synthetic cases), not as proof of deployed checkpoint.

**Cons:** large independent archival/indexing burden, off-host high-water service, verifier policy/security operations and application-level signature verifier need design and audit. Each signer may silently rely on same compromised source, capture stale RPC, censor a refund or equivocate. A "3-of-5" signature count alone is an operational trust promise; no independent consensus without independent finality verification. If signers are Byzantine, safety relies on sufficient honest intersection and a global atomic consumption service across restored/forked Holochain identities. Fee costs = infrastructure, data storage, signer/HSM/security operations and any chain publication; not assumed zero.

**Localnet:** high for a **test harness**, not for authentic operator independence; verified real history still missing.

## Option B — Wormhole Core VAA for a NEW canonical Solana message

**Mechanism:** redesign source program so a nonrefundable, governed committed-collateral transition atomically emits a correctly domain-bound **Wormhole Core** message (emitter address+chain+sequence, nonce/payload, configured consistency). Guardians independently observe and sign VAAs; the receiving app validates current guardian-set epoch, canonical VAA body hash and quorum, emitter chain/address, sequence, finality/consistency policy, program/receipt/amount/recipient/scope and **globally unconsumed message identity**. Consider NTT peer/transceiver and rate-limit/pause design for a future transfer manager, but NTT is not a drop-in Holochain token manager. Retain signed-wire and historical-scanner checks for audit/forensics. Wormhole is committee attestation, **not source-history completeness or a Solana light client**. Wormhole itself notes emitter/sequence uniqueness can be invalidated by reorganization under weaker consistency.

**Pros:** externally operated Guardian attestation and structured emitter+sequence/replay model, existing on-Solana Core messaging concepts; NTT illustrates peer authorization, inbound/outbound throttles, pause and queues.

**Cons:** cannot retroactively attest arbitrary old deposit just by querying a VAA; the current vault emits no reviewed canonical Wormhole message and remains refundable. Requires different custody source, real Core deployment + emission/fee path, Guardian network availability for target network, Holochain ECDSA/Keccak + Guardian-set governance verifier and independent destination replay store. VAA accepted by any local mock has **not** verified a Guardian quorum. Fees/availability depend on actual supported environment and public service; do not assume Guardians service an arbitrary private localnet. Guardian equivocation/censorship, off-chain delivery liveness, guardian-set update, replay under DNA forks and application governance remain risks.

**Localnet:** low for authentic Guardian-signed messages unless a separately audited private Guardian test network/environment is run; synthetic VAA tests are **not** external consensus.

## Option C — LayerZero V2 / Hyperlane-style app-owned verification policy

**LayerZero V2:** separates verifier policy (all **required** DVNs + configured threshold of **optional** DVNs) from executor delivery. Each DVN observes source-chain event, decides finality by its method and submits verification; executor availability cannot substitute for verification. A recipient application owns its verifier configuration, so two addresses operated by the same party are **not** independent. A required DVN refusing to attest can deliberately stall liveness. Holochain is not an automatically supported deployed Endpoint; adaptation requires protocol implementation, message verification/custody mapping and governance.

**Hyperlane:** destination Interchain Security Module (ISM), e.g. multisig ISM, verifies m-of-n validator-attested messages, with origin/domain-specific policy. Checkpoint signatures and merkle proofs are useful patterns; each validator's independent origin view and destination verification remain explicit trust assumptions. No deployed Holochain ISM is proved. A Holochain shim is a new trust-sensitive project.

**Pros:** modular per-channel/per-origin security policies can express operator independence, threshold and verifier migrations. **Cons:** substantial dual-network implementations, fee infrastructure, update/upgrade governance, liveness and censorship policy; not a ready-made solution to current audit demo. Use as design inspiration, not as adopted protocol. If `m <= n/2`, disjoint quorum sets may exist; even `m>n/2` intersects, but Byzantine intersection security requires intersection larger than the assumed number of corrupt keys (e.g. 2f+1 out of 3f+1 gives minimum intersection f+1).

## Custody/reference patterns that are *orthogonal* to attestation

**deBridge DLN:** on source, maker creates an order and temporarily locks 'give' tokens; taker fulfills on destination; source unlock is separately authenticated. Primary source `contracts/DLN/DlnDestination.sol` exposes `fulfillOrder`, fulfilled-order unlock and cancellation specifically for **unfulfilled/not already cancelled** orders; `contracts/DLN/DlnSource.sol` processes authenticated cancellation/unlock. A cancel/release cannot race against an outstanding authenticated external fulfillment. In our future design a source refund must be **disallowed after an external entitlement becomes commit-eligible**; merely observing an SPL transfer or marking `receipt.refunded` is not a settlement machine. deBridge's own validator/execution model is separate from our Solana finality/Holochain trust and cannot simply be transplanted.

**Unyt `raindex-orders`:** its `docs/signer-service.md` calls for each Safe owner signer, on a **separate party's own key/node**, to reconstruct Holochain withdrawal amount, action hash, destination, order, expiry and nonce from its own view. Signer MUST compute the EIP-712 coupon hash and never sign a digest provided by orchestrator; deny unknown/changed spend, cross-order `already_signed`, stale, mismatched deployment. `bridge-orchestrator/src/state.rs` persists uniquely keyed work items and distinct stage hashes, reconciling ambiguous success by reading actual on-chain state before retry. Both are relevant models, but the current Holochain audit demo uses no coupons/withdrawal and these are EVM-specific economics. Original-Unyt authorization not established by public caller source.

**Unyt `HoloBridgeDeployer.sol`:** creates claim token/vault/order, then transfers admin from the deployer to selected Safe **inside one reverting EVM transaction** so nobody can race to initialize/capture public admin. Our Solana future requires its own authorized/atomic deployment/config initialization, PDA authority and upgrade/transfer governance, not copying EVM bytecode or pretending current first-initializer capture is fixed.

**Unyt `ham` at pinned `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`:** source includes Lair-backed agent call signing and an explicit opt-in for a write-capability grant. With `CapGrantOptIn::Withheld`, missing signing must refuse. It supplies safe client mechanics ONLY for an authorized **new demo DNA**, not a Holochain attestation/settlement proof.

**Unyt `watchtower`/HMAC:** telemetry provenance, sequence/timestamp/nonce replay rejection and visible dashboard can strengthen operations; a compromised reporter can still send a perfectly authenticated false report. Do not use its key or dashboard as the checkpoint trust root.

## Comparison for an eventual economic design

| Dimension | A — off-host threshold checkpoint | B — Wormhole Core VAA | C — modular DVN/ISM-style policy |
|---|---|---|---|
| Attested object | Complete selected history ranges plus source events & monotonic state | Canonical newly emitted source message identified by emitter/sequence | Application/domain-bound message/checkpoint under chosen verifiers |
| Source change | May use existing source events **only after** nonrefundable custody redesign | New atomic message-emission path + custody redesign | Likely new source emitter/adaptor + custody redesign |
| Holochain verifier | canonical encoding, Ed25519 quorum, off-host sequence and replay | ECDSA Guardian VAA validation/epoch, emitter/payload replay | policy engine, threshold/required attestations, relayer separation |
| Source authenticity | Explicit trusted attestor archival/finality assumption | Guardian committee source observation + consistency-level policy | Each DVN/validator's specified source observation proof |
| Real localnet feasibility | Mock/signature integration plausible; authentic independence still absent | No assumed public Guardian quorum for private localnet | Only simulator/custom operator set without a native verified Holochain endpoint |
| Cost/liveness | archival nodes, external store, key custody/quorum operators | Core message & delivery fees, Guardian support, VAA retrieval, Holochain verification | DVN/validator/executor fees, configuration, operator availability |
| Main fraud risk | signers collude/forge same-source archive, double sign or rollback | forged or wrongly scoped emitter/quorum/consistency, fork, guardian compromise | weak quorum/required DVN censorship, shared trust domains, fork/replay |
| History completeness | Designed for auditable intervals but only with actual unpruned history | **Not supplied** by one VAA | Not inherently supplied |
| Holochain source fork | separate global atomic consumed-occurrence registry essential | same: VAA replay must be globally controlled across DNA/restore | same: separate global consumed identity and signer policy |
| Status | Design-only | Research-only | Design patterns only |

## Failure-mode / adversarial acceptance matrix (future; nothing deployed)

1. **Fork/finality:** two RPC views disagree on hash, omitted produced slot, conflicting parent; signer must refuse. Include a stale/pruned archive and prohibit fallback to current account state as proof at old slot.
2. **Replay:** repeated emitter+sequence, duplicate receipt+nonce+instruction, conflicting VAA payload or two accepted Holochain source-chain branches; each must be rejected before entitlement.
3. **Equivocation:** same signer or Guardian-set epoch signs distinct checkpoints for same sequence; freeze and publish both signed bodies; fail-closed recovery without allowing earlier high-water mark.
4. **Key independence:** two signers share admin host/seed, leaked signing credential, stale epoch and forged governance rotation; reject quorum independence claim. Simulate a disjoint signer-group attempt to sign same withdrawal against two different orders.
5. **Unavailable services:** signer quorum, required DVN, Guardian VAA, archive node, external high-water mark, Holochain app cell or proof store unreachable => blocked, not optimistic issuance. Censorship and operational fees are liveness costs, not excuses for unchecked acceptance.
6. **Custody cancellation:** unilateral refund after committed source claim; refund while destination entitlement pending or already fulfilled; cancel after fulfillment; out-of-order finality and replay of old cancel. All prohibited.
7. **Governance:** first-initializer capture, fake program/mint/deployed ELF, arbitrary upgrade, freeze/mint takeover, wrong peer or emitter, wrong Holochain DNA/app/cell, stale Guardian-set update.
8. **Cross-lane numbers:** u64 max, signed i64 overflow, JS Number rounding, different decimals, amount-conservation deficit and duplicated liability; exact strings and fail-closed arithmetic only.
9. **At-most-once payout:** two distinct payout requests for same canonical withdrawal/nonce, expired coupon, alternate source-chain hash, competing Holochain branches, signer nonce reset, payout retry after ambiguous success.
10. **Crash/restore:** source signed ActionHash persisted but queue response lost; restart re-read and return same record, not create duplicate. Hostile ledger rollback must be detected by independent off-host high-water and globally shared consumed registry.

## Gate ranking and recommendation

| Priority | Gate / action | Owner | Admission criteria |
|---|---|---|---|
| **P0-demo** | Fix SOL requested/effective attribution and exact 3-mode CI; integrate narrow OBS rewards correction | A2/A5 and A1/A3 | New source-pinned full PASS and SEC approval of adoption |
| **P0-demo** | New authorized audit-only HAM/Lair DNA and persistent idempotent readback | A4/A5 and A3 | Explicit exact DNA/app/CellId/function/signing/schema authorization, no cap grants, ActionHash readback |
| **P0-B1** | Complete two-provider *original produced-slot* archival histories, authentic historical pre/post; real Kit refund | A2/A3/A5 | No gap/pruning/ALT uncertainties; original captures; no independent consensus claim |
| **P0-B2** | Exact released Unyt app source->WASM, supported ABI, allowed caller/capability, audit of side effects | A4/A5 | Specific explicit approval of any published coordinator call, separate from own DNA |
| **P0-C** | Authorized/atomic initializer, governed immutable mint/deploy, committed/nonrefundable escrow | A2/A5 | Source collateral cannot be refunded after external claim becomes valid; conservation invariant |
| **P0-C** | Actual independent attestor finality+global monotonic registry across Holochain forks | A3/A5 and independent operators | Independently operated policy/keys/anchor, authentic history/fork model, at-most-once acceptance |
| **P0-C** | Domain-bound withdrawal, independent coupon checks and one-time on-Solana release | A2/A5 | Unique replay-protected Solana claim, no disjoint quorum double authorization |
| **P1-research** | Prototype A vs B vs C on simulated/bounded non-economic inputs; evaluate fees/availability | SEC/architecture | Threat model, tests, cost model only; none becomes a demo dependency |
| **P1-demo** | Watchtower-style statuses/UI without settlement claims | A1/A4 | Clear `history_incomplete`, `refunded_at_observation` and four denial flags |

**Economic invariant required before Gate C:** at each atomic transition,
`available_external_collateral >= refundable_on_source_obligations + outstanding_spendable_destination_obligations + authorized_but_unpaid_withdrawals + other_reserved_claims`,
with each liability included **exactly once**. A source deposit cannot count twice as refundable and externally committed. The *existing* program's refundable deposits imply external spendable authority must remain zero.

**Decision:** adopt **neither** Wormhole nor a custom checkpoint today. Permit controlled research design experiments only. Re-evaluate A/B/C after same-SHA SOL+OBS proof, owned audit DNA and nonrefundable custody design; keep C STOP-SHIP.

## Verified public primary sources and scope

1. Wormhole [Core Solana PDA/message/sequence](https://wormhole.com/docs/products/messaging/reference/core-contract-solana/) and [VAAs, Guardian set, emitter+sequence, signature quorum and reorg risk](https://wormhole.com/docs/protocol/infrastructure/vaas/). Vendor technical docs, not deployed Holochain endpoint evidence.
2. Wormhole [NTT Solana manager peer/owner/transfer/redeem/pause](https://wormhole.com/docs/products/token-transfers/native-token-transfers/reference/manager/solana/) and [NTT inbound/outbound rate-limits/queues](https://wormhole.com/docs/products/token-transfers/native-token-transfers/configuration/rate-limiting/).
3. LayerZero [DVN separation, all required + optional threshold, independent verifier finality](https://layerzero.network/blog/explaining-decentralized-verifier-networks) (vendor article 2026-05-27).
4. Hyperlane [Multisig ISM](https://github.com/hyperlane-xyz/v2-docs/blob/main/protocol/sovereign-consensus/multisig-ism.md) (archived source documentation; use current upstream before integration).
5. deBridge [DLN source contract](https://github.com/debridge-finance/dln-contracts/blob/main/contracts/DLN/DlnSource.sol) and [destination fulfill/unlock/cancel source](https://github.com/debridge-finance/dln-contracts/blob/main/contracts/DLN/DlnDestination.sol), plus [repository](https://github.com/debridge-finance/dln-contracts). Public source demonstration of lifecycle, **not our code**.
6. Unyt [independent signer service contract](https://github.com/unytco/raindex-orders/blob/main/docs/signer-service.md), [orchestrator state machine](https://github.com/unytco/raindex-orders/blob/main/bridge-orchestrator/src/state.rs), [atomic deployment admin handoff](https://github.com/unytco/raindex-orders/blob/main/src/HoloBridgeDeployer.sol), [HAM Lair/cap-grant policy](https://github.com/unytco/ham/blob/main/src/client.rs). Public Unyt source examples are not authorized calls to released coordinator.
7. Our repo's prior [SEC external-checkpoint synthetic reference test](https://github.com/ConorTttttt/Holochain-Solana-Bridge/blob/d32b3064cf169595273f7a1ce7433d488e972b46/security/test/external-checkpoint-reference.test.mjs) and [SEC review](https://github.com/ConorTttttt/Holochain-Solana-Bridge/blob/d32b3064cf169595273f7a1ce7433d488e972b46/security/evidence/2026-11-14-sec38-remediation-observer-checkpoint-review.md). No operational deployment proved.
