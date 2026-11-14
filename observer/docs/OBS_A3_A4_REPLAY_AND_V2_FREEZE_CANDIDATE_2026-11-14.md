# Agent 3 → Agent 4: replay guard / lossless v2 ABI freeze decision register

**14 November 2026 · PR #62 (A3-owned) · REVIEW CANDIDATE — NOT FROZEN OR AUTHORIZED.**
Source baseline: PR #59 `52bd850da4db70eb25b621f727c3a52b16153001`. The A1-owned PR #61 failed job `132589205296` on `OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN`. This document is for exact typed ABI ratification and independent SEC review, not a transport switch.

## A. Approved test boundary / invocation to hand off to Agent 1

```sh
bash scripts/ci/record.sh genuine-fresh-solana-domain-obs-v2 \
  env OBS_ALLOW_ARCHIVED_RPC_REPLAY=1 \
  node --test scripts/ci/a0-demo-domain-kit-v2.mjs
```

The actual `queueVerified` guard additionally requires `NODE_TEST_CONTEXT=child-v8` supplied by Node's test-runner child. Do NOT manually assign this variable to bypass the guard. `node scripts/ci/a0-demo-domain-kit-v2.mjs` is production-mode execution and must reject `fetchFn`, even when `OBS_ALLOW_ARCHIVED_RPC_REPLAY=1` leaks. The two replay URLs are names for one archived local-validator capture, never independent RPC finality. The test-only injection only replays the actual same-SHA signed original and four-account RPC; the verifier, canonical PDA/IDL, immutable original `DepositLedger`, and exact credit denials remain mandatory. No synthetic JSON can become reviewed source.

PR #62 test file `observer/test/replay-guard-boundary.test.mjs` exercises absent opt-in, explicit child opt-in, no admission on injected RPC error, unknown proof-field refusal, and separately spawned ordinary Node with leaked opt-in. This is an internal test-runner isolation policy, **not** a cryptographic attestation of the CI environment or malicious host.

## B. Single strict v2 typed contract requiring A4/A5 ratification

Use one exact root: `AuditObservationV2` with fields
`{kind,schemaVersion,source,witness,proof,destination,status,historyIndexed,deliveryAuthorized,bindingDigest,creditEligible,independentConsensusVerified,spendableBaseUnits,withdrawalAuthorized}`.
Constants: `kind:"solana-observation-demo-v2"`, `schemaVersion:"2"`, `status:"source_verified_rpc_claim"`, `historyIndexed:false`, `deliveryAuthorized:false`. No extra/missing keys at root or any typed child. Rust must derive `Deserialize` with `deny_unknown_fields`, exact camelCase names and no defaults; JS `verifyBindingDigestReviewOnly` is explicitly **review-only**, not an admission API.

| Typed child | Required fields (add the four denials to **every** child) |
| --- | --- |
| `source` | `sourceId,occurrenceId,sourceEventType,genesisHash,program,mint,holochainScope,receiptAddress,configAddress,vaultAddress,depositor,recipientCore,depositNonce,amountBaseUnits,signature,recentBlockhash,finalizedSlot,observationSlot,outerInstructionIndex,sourceCodeCommit,idlSha256,elfSha256,deploymentEpochId` |
| `witness` | `originalSignedWireSha256,rpcExecutionMetadataSha256,containingBlockSha256,receiptSnapshotSha256,ledgerEvidenceSha256,containingBlockhash,signedMessageRecentBlockhash,sourceWitnessDigest,digestAlgorithm,canonicalEncoding,historyComplete` |
| `proof` | `evidenceKind,sourceTrust,observerAdmission,transactionVerifiedRpcClaim,independentFinalityProof,historyComplete,sourceAuthNotConferredByPayload,originalObserverWitnessCanonicalJson,originalObserverWitnessCanonicalSha256,originalFourAccountRpcUtf8,originalFourAccountRpcSha256` |
| `destination` | `installedAppId,dnaHash,cellAgentPubkey,cellId,role,integrityZome,coordinatorZome,function,integrityWasmSha256,coordinatorWasmSha256,dnaBundleSha256,happBundleSha256,abiSha256` |

Mandatory child constants: `sourceEventType:"deposit"`; `digestAlgorithm:"sha256"`; `canonicalEncoding:"sorted-key-utf8-json-v1"`; `witness.historyComplete:false`; `proof.evidenceKind:"solana-deposit-evidence-v2"`, `sourceTrust:"single-operator-rpc-claim"`, `observerAdmission:"in-process-kit-ledger-revalidated"`, `transactionVerifiedRpcClaim:true`, `independentFinalityProof:false`, `historyComplete:false`, `sourceAuthNotConferredByPayload:true`; `destination.role:"audit"`, `integrityZome:"solana_audit_integrity"`, `coordinatorZome:"solana_audit"`, `function:"record_observation_v2"`. No caller-declared verification flag can confer authority.

**Source types and identities:** Base58 pubkeys/blockhashes decode exactly 32 bytes; signature exactly 64 bytes; scope/recipient SHA digests are exactly 64 lowercase hexadecimal characters; `amountBaseUnits` is a positive canonical decimal u64 **string**, `depositNonce` canonical decimal u64 string, never floating point; `finalizedSlot > 0` and `observationSlot >= finalizedSlot` are exact safe-u53 JSON integers; outer index is u32. `sourceId=genesis:program:receipt`, `occurrenceId=genesis:program:signature:outer:index`; `sourceCodeCommit` exactly 40 lowercase hexadecimal characters. `deploymentEpochId` must be **independently source-verified** against executed Solana ProgramData and the pinned ELF/IDL; no guessed or placeholder epoch. The A3 witness `source.codeVersion` is not an independently authenticated deployment identity.

**Original preimages are mandatory:** `originalObserverWitnessCanonicalJson` must hold the ENTIRE A3 reviewed witness including the original base64 signed wire, whole containing block and unrelated entries, execution metadata (not merely hashes), both source/later receipt snapshots, the immutable ledger evidence and all nested economic denials. `originalFourAccountRpcUtf8` is the retained **original** raw `getMultipleAccounts` RPC response: exactly four accounts with source original slot/address ordering/owner/base64 account data linked to the evidence's original four account digests. Its raw UTF-8 must never be reconstructed from parsed JSON or a later snapshot. The review verifier rejects duplicated decoded member names at every depth, including Unicode-escaped duplicates. In particular, do not round `rentEpoch` via IEEE-754.

**Destination types:** `cellId:[dnaHash,cellAgentPubkey]` is a strict two-element ordered pair; `installedAppId` is the actual installed demo app (never published Unyt); `cellAgentPubkey` is the actual installed cell author, independently authenticated through conductor and external-Lair preflight. Signer identity, app, build and ABI must be independently matched at runtime, not inferred from caller data. ActionHash is **readback-only** after a separately approved and signed Holochain action: never an input field.

**Economic denial literals at root/source/witness/proof/destination and nested A3 evidence/snapshots**:
```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```
Reject any changed/omitted denial even if every unkeyed SHA-256 is recomputed.

## C. Canonical encoding, digest separation, size bounds

For the **typed A4 binding** (unlike raw A3 RPC transaction metadata), disallow floats, NaN, infinity, unsafe JSON integers, negative zero, prototype keys, duplicate member names, undefined and type coercion. Recursive lexicographic key sorting, compact UTF-8 JSON without trailing LF; arrays retain order and unknown fields are refused. Fixed keys are ASCII. Raw Solana RPC fractional `uiAmount` is preserved *inside the original A3 witness*, never used as an authoritative amount. The original raw RPC four-account response remains a UTF-8 string, not a re-encoded object.

Distinct, non-interchangeable digests:
```text
A3 sourceWitnessDigest =
  lowercasehex(SHA256(UTF8("HSC/observer-authenticated-audit-witness/v2")
  || 0x00 || UTF8(canonicalJSON(original A3 witness WITHOUT witnessDigest))))

A4 bindingDigest =
  lowercasehex(SHA256(UTF8("HSC/solana-audit-demo-v2/source-to-dna")
  || 0x00 || UTF8(canonicalTypedV2(typed A4 record WITHOUT bindingDigest))))

originalFourAccountRpcSha256 = SHA256(raw original RPC UTF8 bytes)
originalObserverWitnessCanonicalSha256 = SHA256(full canonical A3 witness UTF8 including witnessDigest)
originalSignedWireSha256 = SHA256(base64-decoded original signed transaction bytes)
```

Review-only JS bounds added at PR #62 (must be ratified identically by A4/Rust before ABI freeze): **32 MiB UTF-8 bytes per original raw RPC sidecar and complete canonical A3 witness**, and **96 MiB UTF-8 bytes per full canonical typed destination-bound record**. These are binary MiB, not character counts. Oversize raw input: `OBS_V2_ABI_REVIEW_REFUSED:RAW_JSON_UNAVAILABLE_OR_TOO_LARGE` or `RAW_PROOF_PREIMAGE_MISSING_OR_CHANGED`; oversize binding: `OBS_V2_ABI_REVIEW_REFUSED:CANONICAL_RECORD_TOO_LARGE`.

**Strict negative matrix**: changed source chain/program/mint/scope, receipt/occurrence, nonce, recipient, amount, original signed wire, full containing block, original transaction metadata, original/later receipt data, original four-account raw bytes/slot, verified source deployment epoch, IDL/ELF, full installed CellId, actual app, signer/author, code/build ABI or any denial must fail via precise source/typed-integrity checks. A rehashed untrusted payload must still fail **the in-process authentication/provenance boundary**, not just digest equality. Relevant existing classes: `OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN`, `OBS_DEMO_REFUSED:UNTRUSTED_AUTH_SHORTCUT`, `OBS_DEMO_REFUSED:PINNED_IDL_BYTES_REQUIRED`, `OBS_DEMO_REFUSED:AUTHENTICATED_SOURCE_MISMATCH_*`, `OBS_V2_REFUSED:NESTED_ECONOMIC_DENIAL_*`, `OBS_V2_REFUSED:REVIEWED_PROOF_CONTRACT`, `OBS_V2_REFUSED:ORIGINAL_BLOCK_ENTRY_METADATA`, `OBS_V2_ABI_REVIEW_REFUSED:SOURCE_WITNESS_PROJECTION_LOSS_OR_CONFLICT`, `OBS_V2_ABI_REVIEW_REFUSED:RAW_ORIGINAL_ACCOUNT_SNAPSHOT_INCOMPLETE_OR_CONTRADICTORY`, `OBS_V2_ABI_REVIEW_REFUSED:BINDING_DIGEST_CHANGED`, `OBS_V2_ABI_REVIEW_REFUSED:FULL_CELL_ID`, `OBS_DEMO_REFUSED:REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED`. The last refusal is **deliberate and required**.

## D. Exact genuine vectors and Rust/JS gate — NOT YET MET

**Do not publish primitive/synthetic vectors as genuine source admission.** The existing `observer/fixtures/v2-binding-primitive-vectors.json` explicitly declares `realKitSourceWitness:false` and `signedHolochainTransportApproved:false`. PR #61's `node` invocation failed before a genuine `queueVerified` acceptance, and source epoch plus actual A4 installed DNA/app/author/ABI are still unverified. There is therefore **no defensible completed full v2 canonical vector set to sign or freeze** at this review commit.

After A1's corrected real same-SHA replay succeeds, require one evidence package pinned to one immutable checkout SHA with: original source manifest + SHA, original signed RPC files and raw four-account sidecar + exact raw-byte SHA, retained durable ledger evidence, complete A3 `reviewedWitnessV2`, its unsigned **exact canonical UTF-8 bytes**, A3 `witnessDigest`, source-verified deployment epoch + ELF/IDL/commit, A4 genuinely installed app/full CellId and externally verified author/build/ABI (or explicit NO-GO for destination binding), complete typed A4 canonical bytes and distinct `bindingDigest`. Rust and JS must independently calculate equal **byte sequences and digest hex** from the same input (not simply compare each other's supplied digest). Negative vectors mutate each field listed above and test *rehashed* rejection where appropriate. Record positive controls and exact failures with CI run/job/artifact checksum. Do not fabricate unavailable SHA/DNA/CellId or signatures.

Until Agent 4 and independent Agent 5 ratify this exact lossless shape, sizes, authority and canonical bytes, this is an **ABI freeze candidate only**, and signed transport remains blocked.

## E. Durable outbox semantics — no implicit transport activation

A3 `observer/test/demo-outbox.test.mjs` covers duplicate original replay, conflicting occurrence/source, pending fsync, pre-send `uncertain`, lost/ambiguous ACK, crash, close/reopen, readback absence/mutation, target DNA/agent mismatch, conflicting ActionHash, terminal ACK deduplication, and adversarial rollback of an intact older local journal. Production reviewed origin is explicitly rejected by both `deliver` and `reconcile`; fixture-only mock ACK is not real Holochain approval. A valid older journal rollback can regress ACK to pending: **`HOSTILE_FILE_ROLLBACK_UNPROTECTED` remains a mandatory hold** until an independent monotonic off-host checkpoint is implemented and audited. Do not enable an unapproved signer/grant or any refund/economic transport.

**Gate C NO-GO:** no credit, bridge allocation, spendable tokens, withdrawal, main merge or unaudited published Unyt coordinator call.
