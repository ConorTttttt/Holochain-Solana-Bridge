# A0 Observer → controlled-DNA versioned contract: proposed v2

**14 November 2026 — REVIEW PROPOSAL ONLY. Not accepted or authorized.** Agent 1 owns this integration handoff. Agents 3, 4 and the independent security reviewer must ratify an immutable ABI, exact destination and signer before any mutating call. Gate A0 BLOCKED, Gate C NO-GO.

## Recorded immutable predecessors

- A1 #46 SHA bc7c8020e2a623cd3a7ce1c8be697fb88faf3365: shared run 43593366000 **6/6 success**; real cross-agent run 43593366067 **3/3 success**. Includes actual local-validator original signed-wire Observer replay; **no own Holochain DNA write**.
- A1 #49 SHA a51e3354c74fbb61cd30a1ab6e41ed9da6211a40: shared run 43594685075 **6/6 success** and RAVE run 43594648110 **5/5 success**, including *published* Unyt read-only disposable conductor probe. Cross-agent run 43594685052 was still in progress at this review; recheck it before claiming same-SHA 3/3.
- Agent 3 outbox PR #48, HEAD 220d5aa314c5b154608af24dea8b0af5c1ed6053: source-owned in-process Kit / ledger binding with mock client, 27 synthetic tests, versioned deposit-only v1. **No real HAM write.** Agent 4 #44 HEAD a0e5908a57d867a09abbc824b59db655b9052f62: strict fixture-only origin, no compiled new DNA / real Lair-signed action. Both are drafts.
- Agent 5 source assessment: SEC-38-1/2 acceptable for non-economic candidate test evidence, SEC-38-3/4 **CHANGES REQUIRED**. No independently attributable GitHub approval for the exact Holochain call.

## Contract collision

A1 source-only stage emits root **source/witness/destination**, where destination has null hashes. A4's strict DNA expects root **source/proof**, with an exact source occurrence, witnessDigest and three copies of economic denials. Their root IDs differ: A1 uses a domain digest, A4 source ID uses genesis:program:receipt. **Never feed the A1 stage JSON to A4.** The current A4 v1 correctly refuses authentic outbox origin, even if booleans and field shapes appear valid.

The proposed v2 is a **new strict schema**, NOT a backwards-compatible v1 mutation and NOT an enabled Holochain input.

| v2 class | Authentic binding to preserve |
| --- | --- |
| Root | New versioned kind solana-observation-demo-v2, literal schemaVersion 2, exact source/proof/destination and four denial literals. |
| Source | Genesis, program ID, mint, holochainScope, canonical receipt PDA, depositor, recipientCore, decimal nonce, decimal u64 amount, original signature, original transaction digest, finalized slot, exact containing blockhash, verified outer instruction index and occurrence ID. |
| Proof | Original Ed25519-signed wire hash and base64 evidence, full containing block entry identity, source transaction metadata, four-account later receipt snapshot, active/refunded observation distinction, exact Anchor IDL/ELF/code SHA and source ledger receipt. Never accept RPC truth booleans supplied by JSON. |
| Destination | Immutable installed own-DNA hash, complete CellId, expected signer agent, demo app ID, audit role, solana_audit coordinator zome, genesis/program/mint/scope domain and authorization. No original Unyt coordinator. |
| Delivery | Genuine same-process A3 production verifier and durable outbox, atomic pending→uncertain before authorized signed write, exact scoped typed readback, persisted ActionHash, restart reconciliation, conflict HOLD and no blind re-send. |
| Negative constraints | Wrong nonce, recipient, amount, signed wire, blockhash, source slot, receipt, scope, signature, schema, DNA, agent, signer, code-version, changed occurrence and replay all refuse before write. |

### Canonical encoding and security

A3 draft outbox canonicalizes recursively sorted-key UTF-8 JSON with safe integer numbers and exact decimal strings, and hashes UTF8(domain) + 0x00 + UTF8(canonical JSON) using lowercase SHA-256. Its witness domain is HSC/observer-demo-outbox/v1/witness, with child rpc-meta/snapshot/ledger-evidence/work domains. Raw signed-wire digest separately hashes **the original bytes**. Destination must be bound within the witness digest; A3 may not relabel a raw-wire digest as the whole proof. A4 must independently check the canonical digest and exact identity. This is a draft encoding for review, not an independent Solana consensus proof or hostile-host rollback defense.

Retain exactly **creditEligible:false**, **independentConsensusVerified:false**, **spendableBaseUnits:"0"**, **withdrawalAuthorized:false** at all applicable layers. Require historyComplete:false and refundDurablyCommitted:false; the genuine original refund at slot 65 is **selected archival evidence**, not a covered or globally accepted revocation. Deposit-only v1/v2 cannot carry a refund event; a future revocation needs an independently reviewed version.

### Hard stops

1. Agent 3: approve exact source-owned, production Kit witness/ledger/outbox SHA and authenticated in-process handoff. No arbitrary caller JSON, local HMAC attestation or fixture promotion.
2. Agent 4: provide two approved Cargo locks; pinned 0.7.1 Holonix/HAM at fbb4b6eb8a79a507e9453b709ed00f15c5618fb4; own-WASM / DNA / hApp source and digest; installed app + complete CellId; external Lair CapGrantOptIn::Withheld preflight; signed audit-only record/readback/restart negatives. Do not call before independent approval.
3. Agent 5: independent **distinct authorized account** explicitly approves the exact immutable source and binary tuple, app/DNA/CellId, role, signer, function and ABI. No reviewer approval can be inferred from these notes or green public CI.
4. Agent 1: run immutable, same-SHA shared 6, real cross-agent 3, RAVE 5 and new own-DNA runtime jobs. Preserve all older red runs and SHA-256 artifacts. No automatic A0 acceptance on count alone.

## CLI-first, honest blocked evidence

From the root at a checked-out exact commit:

    node --test demo/a0-evidence-summary.test.mjs
    A0_EXPECTED_SHA="$(git rev-parse HEAD)" node demo/a0-evidence-summary.mjs --out ci-artifacts/a0-evidence-summary.json
    node demo/a0-evidence-summary.mjs --require-a0

The third command intentionally exits code 3 because A0 is blocked. The generated JSON is a local SHA-256 file inventory, **not** Actions attestation, live Observer delivery, signed Holochain ActionHash or complete refund indexing.

No main merge, published Unyt coordinator mutation, real funds, credits, economic RAVE execution, withdrawal or self-approved security gate.
