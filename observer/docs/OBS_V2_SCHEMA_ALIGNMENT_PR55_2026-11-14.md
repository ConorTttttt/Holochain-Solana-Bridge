# OBS v2 admission freeze candidate — PR #55 source and A4 typed-wire reconciliation

**14 November 2026. Status: SOURCE-OWNER REVIEW CANDIDATE, NOT A4/SEC APPROVAL.**
OBS scope `observer/**` only. PR #52 source `a2338f965916ffac982527f6dc7696e9c5706345`; approved SEC fixture PR #53 `da98cc24f6bda74c4282175c8e2d7cc0d7494f35`; actual SOL source PR #55 `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`.
No reviewed-origin signed delivery, HAM ActionHash, main merge or economic authorization.

## CI verification and immutable archive

- OBS #52 run 43603678118: Observer job 132473602751 SUCCESS, other four shared non-cross-lane jobs SUCCESS; cross-lane job 132475785120 FAIL, `security/test/ledger-corruption-boundary.test.mjs` still omitted an obligatory economic denial. The other legacy SEC fixture was repaired in PR #53. Do **not** relax `DepositLedger`.
- SEC #53 exact-head run 43602667565: six jobs SUCCESS, cross-lane job 132473110587 SUCCESS. Agent 1 must cherry-pick/adopt only SEC's two approved fixture files into an **immutable new integration commit** with latest OBS and the genuine SOL producer, retaining all original run IDs.
- PR #55 run 43604140724 job 132475021174 SUCCESS, artifact ID 14118166967, ZIP SHA-256 `33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018`. Independently checked all **280/280** entries in `localnet-evidence/evidence-manifest.sha256` and real IDL bytes SHA-256 `d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007`.
- Fresh Solana identity: genesis `BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv`, program `387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1`, mint `3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig`, receipt `5HzYHP6kwfi7GNxhACYZxqtjU3Zypr1UMS3DQjmgn1mH`, derived 32-byte scope `85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7`, nonce `42017`, amount `250000` base units, deposit signature `4ibizpAzc2BmXAMhoPy15KmrvREnQMXcDp3QZszMGJL8wmWnNLG8GhKVbPjiLCMpS98k6c5GnpDCCuMdUkPeKETp` at slot 42.
- Original original signed-wire SHA-256 `7dd4f34251059c1c13f01c29087ac1e619111a4bc65910de62210c9a77ba02bc`; containing block canonical sorted-JSON SHA-256 `e074debfa7d9db304ce50ad8300b824d5c5db507f5ddfa8ff22697339d2ca6ef`. These **archive-preflight** hashes are not a passed OBS `queueVerified` witness digest or immutable Holochain cell binding.
- Same-SHA replay source harness now includes `demo-domain` with exact non-example scope derivation and archive genesis/program/mint/receipt/nonce/IDL checks. The **next integrated run must produce the SOL artifact at its own Git HEAD**. Do not set a fake `sourceCommitSha` on an older archive to bypass `SAME_SHA_SOURCE_PRODUCER_REQUIRED`.

## Exact ABI decision request: A3 original witness + A4 typed shell

**Proposed root `AuditObservationV2` (strict Serde deny_unknown_fields):**
`kind:"solana-observation-demo-v2"`, `schemaVersion:"2"`, `source:SourceV2`, `witness:WitnessV2`, `proof:ProofV2`, `destination:DestinationV2`, `status:"source_verified_rpc_claim"`, `historyIndexed:false`, `deliveryAuthorized:false`, `bindingDigest:<lowercase hex SHA256>` and all four literal economic denials.

**SourceV2** exact typed fields from A4's proposal: `sourceId,occurrenceId,sourceEventType,genesisHash,program,mint,holochainScope,receiptAddress,configAddress,vaultAddress,depositor,recipientCore,depositNonce,amountBaseUnits,signature,recentBlockhash,finalizedSlot,observationSlot,outerInstructionIndex,sourceCodeCommit,idlSha256,elfSha256,deploymentEpochId`, plus four denials. `sourceEventType:"deposit"`; unsigned base-unit/nonces are canonical decimal u64 strings; slots are safe integers; index is u32. `sourceId=genesis:program:receipt`; `occurrenceId=genesis:program:signature:outer:index`. Source epoch MUST be verified against actual ProgramData/ELF (no caller-invented epoch); unsigned IDL/ELF/provenance claims are not admission.

**WitnessV2** exact typed fields from A4: `originalSignedWireSha256,rpcExecutionMetadataSha256,containingBlockSha256,receiptSnapshotSha256,ledgerEvidenceSha256,containingBlockhash,signedMessageRecentBlockhash,sourceWitnessDigest,digestAlgorithm:"sha256",canonicalEncoding:"sorted-key-utf8-json-v1",historyComplete:false`, plus four denials.

**ProofV2** typed A4 fields `evidenceKind:"solana-deposit-evidence-v2",sourceTrust:"single-operator-rpc-claim",observerAdmission:"in-process-kit-ledger-revalidated",transactionVerifiedRpcClaim:true,independentFinalityProof:false,historyComplete:false,sourceAuthNotConferredByPayload:true`, plus four denials. **REQUIRED LOSSLESS AMENDMENT for A4 agreement:** add `originalObserverWitnessCanonicalJson:String` (whole OBS v2 witness including raw base64 signed wire, complete containing block, exact original transaction metadata, original and later verified receipt observations, immutable ledger evidence and origin/scope) and `originalObserverWitnessCanonicalSha256:String`. Also require `originalFourAccountRpcUtf8:String` (the genuine raw original RPC getMultipleAccounts response from committed source observation; preserve unsafe `rentEpoch` as unparsed UTF-8) and `originalFourAccountRpcSha256:String`. If full original raw four-account RPC response cannot be retained and linked to the immutable ledger, refuse with `LOSSLESS_SOURCE_ACCOUNT_BYTES_REQUIRED`: existing `verifySnapshot()` emits decoded fields and SHA digests, **not** original four-account response bytes. Never invent those bytes from a later snapshot. A4 must explicitly accept the additional typed fields or specify an equally strong mandatory content-addressed raw attachment with authenticated retrieval and exact byte hashes. This is **not yet agreed**.

**DestinationV2** A4 exact fields `installedAppId,dnaHash,cellAgentPubkey,role:"audit",integrityZome:"solana_audit_integrity",coordinatorZome:"solana_audit",function:"record_observation_v2",integrityWasmSha256,coordinatorWasmSha256,dnaBundleSha256,happBundleSha256,abiSha256` plus denials. Require `cellId:[dnaHash,cellAgentPubkey]` explicitly or treat this exact ordered pair as a fixed semantic derived field. A4/SEC must authenticate actual installed CellId, external Lair author, app/build/function and capability at runtime; never infer from payload. Reject published Unyt app IDs.

**Canonical format:** recursive object keys sorted by JavaScript UTF-16 code-unit order, JSON UTF-8 with no whitespace or terminal newline; arrays preserve order; reject prototype keys, duplicate JSON member keys on raw import, non-finite or unsafe numbers, negative zero, missing/null-vs-undefined coercions and unknown fields; no roundoff of u64. Parsed RPC UI floating displays cannot be an authority for amounts. Preserve *original* raw sidecar UTF-8 as a string and hash exactly those bytes, not `JSON.parse`+`JSON.stringify` of an unsafe `rentEpoch`. Preserve original raw RPC member-name uniqueness at every object depth: parse JSON strings including `\\u` escape spellings before ordinary `JSON.parse`, reject duplicate decoded keys (also `__proto__`/`constructor`/`prototype`) rather than allowing different parsers to assign different owners, account data, or context slots. Added OBS review-only refusal classes `RAW_JSON_DUPLICATE_KEY`, `RAW_JSON_PROTOTYPE_KEY`, `RAW_JSON_SYNTAX`; this guards internal integrity only, not Solana provenance, and does NOT activate v2 signed delivery.

**Digest separation:**
```text
sourceWitnessDigest = lowercasehex(SHA256(
  UTF8("HSC/observer-authenticated-audit-witness/v2") || 00 ||
  UTF8(canonicalJSON(A3 reviewedWitness without witnessDigest))
))
originalObserverWitnessCanonicalSha256 = SHA256(
  UTF8(canonicalJSON(A3 reviewedWitness including witnessDigest))
)
originalSignedWireSha256 = SHA256(base64decode(original original signed wire))
rpcExecutionMetadataSha256 = SHA256(UTF8(canonicalJSON(original rpcTransaction.meta)))
containingBlockSha256 = SHA256(UTF8(canonicalJSON(full original containingBlock)))
receiptSnapshotSha256 = SHA256(UTF8(canonicalJSON({
  original:originalReceiptSnapshot,later:latestReconciledReceiptSnapshot
})))
ledgerEvidenceSha256 = SHA256(UTF8(canonicalJSON(exact committed ledger evidence)))
originalFourAccountRpcSha256 = SHA256(original raw getMultipleAccounts UTF8 response)
bindingDigest = lowercasehex(SHA256(
  UTF8("HSC/solana-audit-demo-v2/source-to-dna") || 00 ||
  UTF8(canonicalJSON(typed AuditObservationV2 without bindingDigest))
))
```
The hashes are integrity/addressing commitments, never proof of trusted origin. Full signed message and containing-block bytes must remain retrievable under the authorized record; no hash-only lossy projection is acceptable.

## Rejection / durable semantics

Classes to preserve or implement: `SAME_SHA_SOURCE_PRODUCER_REQUIRED`, `PINNED_IDL_BYTES_REQUIRED`, `SOURCE_COMMIT_BINDING`, `PINNED_DEPLOYMENT_MISMATCH`, `DEPOSIT_NOT_AUTHENTICATED_OR_AMBIGUOUS`, `MISSING_DURABLE_SOURCE`, `AUTHENTICATED_SOURCE_MISMATCH_*`, `NONCANONICAL_SIGNED_WIRE`, `ORIGINAL_BLOCK_ENTRY_METADATA`, `SNAPSHOT_IDENTITY_*`, `LOSSLESS_SOURCE_ACCOUNT_BYTES_REQUIRED`, `BINDING_DIGEST_CHANGED`, `WRONG_DNA_OR_AGENT`, `REMOTE_ACTION_IDENTITY_CONFLICT`, `REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED`, `HOSTILE_FILE_ROLLBACK_UNPROTECTED`. Do not rename real implemented error strings to match this proposed list until tested.

A verified source ID (genesis+program+receipt) has one immutable occurrence and one local record per destination CellId+authorized author. Exact duplicate = same pending/acked row, no write. Changed signature/index/bytes/destination = conflict/HOLD, not an update; a returned real ActionHash must be persisted before readback and must match an exact typed remote record. Pending->uncertain must be durably committed **before** signed send. Lost ACK, restart and ambiguous readback = reread/HOLD, never blind resubmit. Local fsync and checksums do **not** protect hostile disk rollback. No global cross-author exactly-once claim.

## Must remain blocked

1. **A0 Kit:** SEC+SOL+OBS combined source not yet reproduced at one SHA; local artifact provenance preflight is not `queueVerified` acceptance. The OBS replay test requires `OBS_ALLOW_ARCHIVED_RPC_REPLAY=1` only in CI, never arbitrary production `fetchFn`.
2. **A4:** independently verified DNA source/lock/build/ABI/installed full CellId/external Lair/author/capability and actual typed record/readback are absent; existing v1 fixture-only zome rejects reviewed origin. Keep signed v2 transport blocked.
3. **B1/refund:** selected containing blocks are not complete produced-slot history; `historyCoveredByTwoRpcClaims:true` has no authority; refund is read-only until a separately reviewed revocation contract.
4. **C:** `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. No credit, RAVE economic operations, Unyt coordinator mutation, withdrawal or main merge.

**A4 review decision requested:** accept this lossless raw-preimage amendment to typed `source/witness/proof/destination` plus A4 `bindingDigest` (recommended), or return a byte-equivalent exact alternative with source and immutable retrieval semantics. **A5 independent approval required; this page is only OBS review source.**
