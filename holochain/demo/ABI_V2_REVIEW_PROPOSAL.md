# Proposed Solana → Holochain audit-only v2 ABI — REVIEW ONLY

**Status 2026-11-14: UNIMPLEMENTED, NOT DEPLOYED, NOT APPROVED.** This is the Agent 4 typed ABI decision proposal in response to A3 PR #48 (source-owned outbox), A1 PR #45/#46 (signed-wire diagnostic replay) and independent SEC #33's immutable [SEC-38 convergence findings](https://github.com/ConorTttttt/Holochain-Solana-Bridge/blob/bdbd8f57842261aec5c5f3d10260f4b40bfe62d0/security/evidence/2026-11-14-agent5-sec38-f9d65-demo-convergence-review.md). It is a review contract, **not** an enabled zome or grant. Existing `solana-observation-demo-v1` remains strictly **`test_only_fixture` + deposit-only** at the integrity zome, HAM adapter and JS schema. Do not reinterpret a submitted JSON `evidenceOrigin` as security approval.

## Exact proposed typed record

All objects **must** use Serde `deny_unknown_fields`, `rename_all="camelCase"`. Strings use UTF-8; pubkeys/signatures use canonical base58 encoded 32/64 original bytes, `recipientCore` and SHA-256 digests are lowercase 64-hex; amounts/nonces are canonical decimal u64 **strings**, no decimals, zero amount or scientific notation; slots are positive safe u53 JSON integers; instruction indices are u32. No unknown fields, implicit defaults, optional provenance or numeric coercion.

**`AuditObservationV2` root** — fields exactly:
- `kind: String` literal `solana-observation-demo-v2`; `schemaVersion: String` literal `2`.
- `source: SourceV2`, `witness: WitnessV2`, `proof: ProofV2`, `destination: DestinationV2`.
- `bindingDigest: String`: SHA-256 hex over typed canonical root **excluding this field**, with domain and exact destination as defined below.
- `status: String` literal `source_verified_rpc_claim`; `historyIndexed: bool` literal false; `deliveryAuthorized: bool` literal false (caller evidence never grants a write).
- `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`.

**`SourceV2`**, all required:
`sourceId`, `occurrenceId`, `sourceEventType:"deposit"`, `genesisHash`, `program`, `mint`, `holochainScope`, `receiptAddress`, `configAddress`, `vaultAddress`, `depositor`, `recipientCore`, `depositNonce`, `amountBaseUnits`, `signature`, `recentBlockhash`, `finalizedSlot`, `observationSlot`, `outerInstructionIndex`, `sourceCodeCommit`, `idlSha256`, `elfSha256`, `deploymentEpochId`, and the four required economic denials.
- `sourceId = genesisHash + ":" + program + ":" + receiptAddress`.
- `occurrenceId = genesisHash + ":" + program + ":" + signature + ":outer:" + outerInstructionIndex`.
- `deploymentEpochId` is a **source-verified** immutable deployment identity whose upstream formulation MUST be agreed with Agent 2/3 (e.g. verified ProgramData/upgrade slot). No `unknown`, inferred epoch or fabricated digest. Until agreed, the v2 write remains disabled.
- `observationSlot >= finalizedSlot > 0`; `recipientCore` is the actual receipt's 32-byte core in hex, NOT a Solana pubkey or an invented Holochain address. `holochainScope` must equal the actual receipt bytes and the installed DNA properties, never historical 0x07.
- Actual `sourceCodeCommit`, IDL and ELF digests are bound to the executed Solana deployment, not generic HEAD labels.

**`WitnessV2`**, all required: `originalSignedWireSha256`, `rpcExecutionMetadataSha256`, `containingBlockSha256`, `receiptSnapshotSha256`, `ledgerEvidenceSha256`, `containingBlockhash`, `signedMessageRecentBlockhash`, `sourceWitnessDigest`, `digestAlgorithm:"sha256"`, `canonicalEncoding:"sorted-key-utf8-json-v1"`, `historyComplete:false`, plus the four denials. Never substitute a block metadata label for the exact archived containing-block bytes. A3 must define precise byte / JSON projections; all digests are recalculated from witnessed bytes at the **admission boundary**, not merely format-checked 64-hex strings. Deny missing original wire, contradictory transaction/block meta, unsigned requested privileges, synthetic ALT attribution, and unsupported refund/history claims.

**`ProofV2`**, all required: `evidenceKind:"solana-deposit-evidence-v2"`, `sourceTrust:"single-operator-rpc-claim"`, `observerAdmission:"in-process-kit-ledger-revalidated"`, `transactionVerifiedRpcClaim:true`, `independentFinalityProof:false`, `historyComplete:false`, `sourceAuthNotConferredByPayload:true`, plus the four denials. These values are **labels**, not cryptographic authority. The Holochain DNA cannot prove Solana finality solely from this data.

**`DestinationV2`**, all required: `installedAppId`, `dnaHash`, `cellAgentPubkey`, `role:"audit"`, `integrityZome:"solana_audit_integrity"`, `coordinatorZome:"solana_audit"`, `function:"record_observation_v2"`, `integrityWasmSha256`, `coordinatorWasmSha256`, `dnaBundleSha256`, `happBundleSha256`, `abiSha256`, and the four denials. App ID must be a dedicated demo ID excluding `unyt` case-insensitively. Full CellId is the ordered pair `(dnaHash,cellAgentPubkey)`; both must equal the **installed** app's provisioned audit cell. Never accept caller-supplied destination or build digest as the runtime identity authority.

**`AuditRecordV2` readback** adds actual `ActionHash`, `observation: AuditObservationV2` and the same four denials. `ActionHash` **never appears in an inbound observation** and must originate from an authenticated, signed Holochain author action and typed readback against the exact cell. Source IDs/occurrences may not be reused for contradictory observations. Scope is only same author + DNA; no cross-author or rollback uniqueness promise.

## Canonical source-to-DNA binding, no silent projection

1. A3's in-process **production Kit** verifier must fetch original signed wire and containing block, verify Ed25519, deployed IDL/ELF/program, canonical receipt PDA/SPL amount/nonce/scope, later four-account observations and committed OBS ledger. It must enforce archive completeness limits and fail closed on missing/contradictory sources. A1's diagnostic root/source/witness/destination is **not** an authorization input. Caller-originated JSON is never promoted by flags.
2. The trusted exporter materializes the **complete** `AuditObservationV2` structure, obtains `DestinationV2` from **pinned actual conductor/installed CellId/build tuple** (not from the event), and calculates component hashes from the verified original raw data. No `source` field dropping and no mapping `evidenceOrigin:"observer_reviewed_outbox"` to trusted capability.
3. Canonical encoding: recursively lexicographically sort object keys and encode UTF-8 JSON with no whitespace, arrays in original order, integer values only when JS-safe; disallow NaN, floating point except explicitly canonicalized display-only RPC fields in separately defined RPC metadata hashes, `__proto__`, `constructor`, `prototype` and duplicate serialized keys. Do NOT JSON-stringify arbitrary untrusted objects with lossy coercion. For a full record `R`, compute:
   ```
   bindingDigest = lowerhex(SHA256(
     UTF8("HSC/solana-audit-demo-v2/source-to-dna") || 0x00 ||
     UTF8(canonicalJSON(R without bindingDigest))
   ))
   ```
   This binds identity, **all nested fields, all denials, proof limitations, exact destination and ABI**; it is an integrity commitment, **not** source consensus or a signer capability.
4. HAM authenticates Node Lair signing with `CapGrantOptIn::Withheld`, compares installed app/role/full DNA/agent and all build/ABI IDs, uses only an independently approved versioned `record_observation_v2` function; readbacks must match full bytes/digest and actual ActionHash. A3's durable outbox persists `pending -> uncertain` **before** attempting a write, re-reads before retry/ACK, and HOLDs ambiguous errors; host rollback remains independently unprotected.
5. **Activation requires** separately reviewed A3 authenticated source capability, actual Rust/WASM build and installation, external-Lair read-only identity proof, independent Agent 5 approval of exact immutable SHA/WASM/DNA/app/CellId/agent/function/ABI/fixture tuple, and a new explicit implementation PR. None has been granted. **Do not implement a public JSON import endpoint**, grant capability implicitly, or silently activate this spec as a v1 schema revision.

## Proposed required negative matrix

Reject unknown/missing root/nested field; modified source nonce/recipient/amount/program/mint/genesis/slot/receipt/scope/IDL/ELF/deployment epoch; invalid wire, signature, blockhash, execution meta, block entry or historical snapshot; changed component/binding digest; unexpected destination app/full CellId/agent/build hash/ABI; extra `ActionHash` from caller; forgery of `observerAdmission`/proof labels; mismatched explicit provenance; refund (v2 is deposit-only pending a separate revocation proposal), `historyComplete:true`, duplicate conflicting source/occurrence and rollback/restart disagreement. Run against an **actual** conductor and in-process Kit, not mocks, before describing runtime acceptance.

**Always:** `creditEligible:false`; `independentConsensusVerified:false`; `spendableBaseUnits:"0"`; `withdrawalAuthorized:false`. Gate C **NO-GO**.
