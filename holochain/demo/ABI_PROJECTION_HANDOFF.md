# A1 / A3 / A4 v1 ABI compatibility — no trusted outbox acceptance

**Source comparison (14 Nov 2026):** A1 PR #45 `80f79e6c0499122f3b36762f63eac990dab50111`, `demo/observation-contract.mjs`; A3 PR #36 `2931c5fc51736e3c845cb9bedc55c578534b53a1`; A4 PR #44 own controlled demo DNA. Source references do not confer authorization.

## Two deliberately *different* envelopes

**A1 stage object** (source-only; no Holochain delivery): root `{ kind, id, status, historyIndexed:false, deliveryAuthorized:false, source, witness, destination, proofLimitations, fourDenials }`. A1 puts `status:'signed_transaction_verified_rpc_claim'|'refunded_at_observation'` at root; its `destination` is `{kind:'own-controlled-holochain-audit-dna-only', state:'not_bound_or_written', dnaHash:null, cellId:null, actionHash:null, fourDenials}`. A1's `id` is a SHA-256 digest with `HSC/demo-audit-record/v1` domain.

**A4 destination zome input** (strict typed, *currently fixture-only*): root `{kind:'solana-observation-demo-v1',schemaVersion:'1',source,proof,fourDenials}`. `source.id` is `genesis:program:receipt`, *not* A1's root digest, and `source.occurrenceId` is `genesis:program:signature:outer:<u32>`. The `proof` object accepts only `evidenceKind:'solana-deposit-evidence-v1'`, `evidenceOrigin:'test_only_fixture'`, `transactionVerified:true`, `verifiedByRpcClaim:true`, `historyComplete:false`, and the four denials. No `destination` object and no `refund` status are accepted by the DNA. Keep this ABI; **do not relax `deny_unknown_fields` or recast A1 JSON as a signed payload.**

## Proposed projection, NOT AN IMPORT ROUTE

| A4 destination field | Authoritative source / required check |
| --- | --- |
| `source.genesisHash/program/mint/holochainScope` | A1 source fields, but independently bind to operator-pinned localnet domain and DNA properties. |
| `source.receiptAddress/depositor/signature/finalizedSlot/amountBaseUnits` | A1 source fields only after A3's exact signed wire, containing block, receipts, CPI/program/mint/scope and u64 checks in the **same trusted process**. Never accept source JSON alone. |
| `source.instructionIndex` | Derive from independently verified **compiled top-level instruction occurrence**, confirming a unique `outer:<unsigned u32>` path; A1 only has `source.instructionPath`. Reject CPI or ambiguous/unbound paths; do not trust string parsing alone. |
| `source.id` | Derive from verified genesis + program + receipt; **not** A1 root `id`. Verify receipt PDA and uniqueness, not only matching string syntax. |
| `source.occurrenceId` | Derive from genesis + program + verified original transaction signature + validated outer index. Bind to chain/domain/epoch in outbox ledger. |
| `source.witnessDigest` | An A3-owned, strictly **domain-separated** SHA-256 over canonical original signed wire, containing block/metadata, snapshot, scope, unique occurrence and verified source-code/outbox receipt. Must specify encoding and bytes before enabling; **A1's single `signedWireSha256` is insufficient and MUST NOT be relabelled as this digest**. |
| `source.codeVersion` | Fixed immutable A3 verifier SHA or signed release version, not supplied by an importable JSON envelope. |
| `source.schemaVersion`, root `schemaVersion` | Literal `"1"`; reject unknown fields in all objects. |
| `proof.evidenceOrigin` | Literal `test_only_fixture` **today**. Future `observer_reviewed_outbox` needs separate source-authenticated command/capability, A3 proof receipt and Agent 5 approval, potentially a separately versioned DNA. |
| `proof.historyComplete` and all four denials | Always `false` and `{ creditEligible:false, independentConsensusVerified:false, spendableBaseUnits:"0", withdrawalAuthorized:false }` at source, proof, root. A1 `historyIndexed:false` is not permission to assert complete history. |

A1's `source.depositNonce`, `source.recipientCore`, `source.blockhash`, `source.transactionHash`, `witness.originalRpcMetadataSha256`, `witness.receiptSnapshotSha256`, and `source.refundedAtObservation` are **not destination ABI fields**. They must remain verifiably bound in the authenticated A3 receipt and domain digest; do not discard them silently or append undeclared fields to A4's `AuditObservation`. Explicit negative tests must mutate every one of these upstream fields and show failure before any Holochain write.

**Do not treat A1's `destination` placeholder as a Holochain readback.** Destination binding happens only from real installed `CellId`, signed Holochain `ActionHash`, typed readback and restart. The A4 `AuditRecord` is its own output schema; proof of a write is an externally verified runtime event, not a JSON field copied from A1.

## Source trust / replay contract to negotiate with Agent 3

1. A3 creates a **source-owned authenticated** `observer_reviewed_outbox` receipt bound to the immutable original signed wire, produced-slot/containing-block claim, source finalization domain, signer epoch, genesis/program/mint/receipt/nonce/amount/recipient/index, SHA-256s of all original evidence and A3's exact source SHA.
2. A3 issues a unique `genesis:program:receipt:occurrence` work-item ID and a durable monotonic receipt; the adapter authenticates the producer's local transport and integrity policy, re-reads before retry and fails on conflicting payload. Trusting a local HMAC alone **does not** attest Solana consensus or protect against hostile shared-host rollback.
3. A4 adds a **separate**, versioned authenticated intake command (not the current `deliver <file>`). SEC must review producer identity, digest canonicalization, scoped replay/ledger receipt, fail-closed recoverability, and exact Lair/DNA target **before** any write. Keep v1 deposit-only; any refund/revocation requires its own integrity/coordinator schema and SEC review.
4. No gate upgrades: `independentConsensusVerified:false`, `historyComplete:false`, no credit-limit calls, no Unyt `transactor`, no withdrawal.

## Current decision

A1 source-only contract and A4 destination ABI are **incompatible by design**; this is not an error to "fix" by accepting arbitrary `source/witness/destination` as the DNA input. The missing safe component is an authenticated, versioned in-process projection with independent source provenance and durable reconciliation. Until A3 + SEC authorize it, both the adapter and DNA reject `observer_reviewed_outbox`.
