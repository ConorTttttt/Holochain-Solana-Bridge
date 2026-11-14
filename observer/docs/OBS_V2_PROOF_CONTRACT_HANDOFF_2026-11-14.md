# Observer-owned v2 proof contract — source recommendation / delivery disabled

**2026-11-14 · Agent 3 · P0 · PR #48 · exact predecessor `220d5aa314c5b154608af24dea8b0af5c1ed6053`.**

This is the **frozen source-owner recommendation for A4/A5 review**, not an approved writable DNA ABI. A4's current v1 fixture-only intake must continue to reject `observer_reviewed_outbox`. A0 remains BLOCKED; C remains NO-GO. No credit, mint, withdraw, settlement, Unyt coordinator mutation or global exactly-once claim.

## Strict `solana-observation-demo-v2` payload

The transport must accept a typed, strict-schema value produced **inside the same Observer process** after production `@solana/kit@8.6.0` re-fetch, signature, containing-block, instruction, IDL, PDA, SPL deltas and later receipt verification. The caller cannot supply `transactionVerified:true`, `historyCoveredByTwoRpcClaims:true`, an arbitrary `witnessDigest`, or a self-asserted source-ledger row. Pure serialization/hash tooling by itself **never authenticates a deposit**.

Top-level exact fields: `kind:"solana-observation-demo-v2"`, `schemaVersion:2`, `source`, `proof`, `destination`, `verifierVersion`, `witnessDigest`, and literal `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. Unsupported keys or types refuse. The digest does not cover its own `witnessDigest` field.

**`source`**: `sourceEventType:"deposit"`, `sourceId`, `occurrenceId`, `genesisHash`, `program`, `mint`, `holochainScope` (32-byte lowercase hex), `receiptAddress`, `depositor`, `recipientCore` (32-byte lowercase hex), `depositNonce` (canonical unsigned decimal u64), `amountBaseUnits` (canonical positive decimal u64), `configAddress`, `vaultAddress`, `sourceTokenAccount`, `signature`, `transactionVersion`, `finalizedSlot`, `blockhash` (containing block), `recentBlockhash` (signed message), `instructionPath` (exact `outer:N`), `cpiPath`, and four denial literals. `sourceId = genesisHash + ":" + program + ":" + receiptAddress`. `occurrenceId = genesisHash + ":" + program + ":" + signature + ":outer:" + N`. Do not collapse several occurrences of one transaction or reuse a source ID with changed bytes.

**`proof`** must retain or carry **mandatory, byte-addressed, retrievable attachments** for every item below. An external digest with unavailable bytes is not sufficient for independent audit:

- `evidenceOrigin:"observer_reviewed_outbox"`, `evidenceKind:"solana-deposit-evidence-v2"`, `finalityTrust:"finalized_rpc_claim_only"`, `historyComplete:false`, `historyIndexed:false`, `refundDurablyCommitted:false`, `rollbackSecurityHold:"HOSTILE_FILE_ROLLBACK_UNPROTECTED"`, four denial literals.
- **Original signed wire:** original canonical base64, raw-wire SHA-256, required signer set/signatures, signed-message hash, signed message version and original instruction occurrence. Verify every required Ed25519 signature; the signature string alone is not enough.
- **RPC execution:** original `getTransaction` finalized response, **full metadata** (err, fee, balances, token balances, innerInstructions, loadedAddresses, status, logs and cost), raw serialized evidence or canonical exact fields, and requested commitment. Reject any mismatched metadata except the narrow `rewards:null` versus `[]` compatibility already reviewed in `sameSolanaExecutionMeta`.
- **Containing block:** claimed slot, blockhash, previousBlockhash, parentSlot, exact transaction index and transaction entry, complete archived block entries and signature-validation result. Include source RPC identity as a provider claim, never independent consensus.
- **Custody/receipt evidence:** verified outer deposit and single matching `TransferChecked` CPI; exact pre/post source and vault token balance deltas, decimals/owners/programs; canonical receipt PDA and bump; **raw bytes and owner identities for all four receipt/config/vault/mint account responses**, observation slot per provider, decoded fields/digests, and two-provider comparison outcome. Distinguish original saved snapshot from a later fresh re-observation; bind both if present.
- **Persistent source:** exact immutable `DepositLedger` source row/evidence, ledger fingerprint, checkpoint/block reference, journal identity, artifact hashes and both the source evidence digest and original wire digest. A local checksum is corruption detection, not independent authenticated storage.
- **Code:** exact generated Anchor IDL bytes/SHA-256, program ELF SHA-256, source commit and a pinned Observer verifier version. A code version string alone does not establish source/WASM equivalence.

**`destination`** exact required fields: `appId`, `dnaHash`, `cellId:[dnaHash,agentKey]`, `agentKey`, `role:"audit"`, `zome:"solana_audit"`, reviewed version-specific audit-only `functionName`, source genesis/program/mint/scope, and reviewed signer/capability policy epoch. No fallback to published Unyt DNA, no implicit capability grant. The installed DNA, CellId, signer, role and function must be independently approved by A4 and A5 before any mutation.

## Canonical bytes and digest

Use **recursively sorted UTF-16 code-unit lexical key order (JavaScript default .sort; specify this for cross-language implementations)**, normal JSON UTF-8 with no whitespace, UTF-8 strings escaped via JSON string syntax, arrays in their given order, booleans and null literally, and only finite *safe integer* JSON numbers. Cryptographic values are canonical lowercase hexadecimal, original Solana identity strings canonical base58, amounts/nonces decimal strings with no leading zeros. Reject `undefined`, NaN, negative zero, unsafe numbers, prototype keys and ambiguous duplicate object fields. For RPC JSON containing fractional `uiAmount` or unsafe `rentEpoch`, preserve the **original UTF-8 JSON response bytes as a string/blob with a pinned SHA-256**, alongside typed exact integer fields; never silently round or recast them into canonical integers.

```text
preimage = canonicalJSON({
  kind, schemaVersion, source, proof, destination, verifierVersion,
  creditEligible:false, independentConsensusVerified:false,
  spendableBaseUnits:"0", withdrawalAuthorized:false
})
witnessDigest = lowercase_hex(SHA256(
  UTF8("HSC/observer-demo-outbox/v2/witness") || 0x00 || UTF8(preimage)
))
workKey = lowercase_hex(SHA256(
  UTF8("HSC/observer-demo-outbox/v2/work") || 0x00 ||
  UTF8(canonicalJSON({sourceId,occurrenceId,destination,verifierVersion,witnessDigest}))
))
```

Require both the exact digest **and authenticated underlying bytes**; a 64-character hex string does not authenticate anything. Separate **offline archive preimage** domain `HSC/observer-demo-outbox/v2/original-archive-preimage` is deliberately **not** the final `witnessDigest` domain and cannot be upgraded by renaming the field.

## Genuine original local-validator preimage

Artifact ID `14106778660`; original ZIP SHA-256 `aa4cbdf19979816f48c1b2a2327bd09bc578953f5b5794bb8863672b41da7600`; pinned archive manifest SHA-256 `83ccf38aeee9e11b2f193f3894f1869cd1b1c1edc506130422489b2bbcc5f63d`; 246 entries verified. Original deposit is slot **17**, signature `3gE8pjd7jSVywReD5ZKGzJg9axZLW3eSoEFQfkx9W3y6XaKabAuyWYk3JeNabfJex6iUW37TNFb62oAnTas3y5Ed`, nonce **42017**, recipientCore `09` repeated 32 bytes, amount **250000** base units, source wire SHA-256 `3dd6b979a6a08f8fe8680de041787234b91d4ff09232b8e8e57fdc3ce439dd98`. Containing blockhash `8yXE4i96bG5UNjWnRLoNxE3zg1VFUzjYXcWMJkEyFxCG`.

The immutable archive-preimage candidate with ZIP validation, original signed legacy wire Ed25519 check, matched containing entry, metadata comparison and receipt-byte crosscheck has `preimageDomainSeparatedSha256 = 4b4404d9c8857d9f208dcd2807f9678f15fdb81578b1728d535f97e5130455fb`. **It is not the destination-bound v2 witnessDigest**: no live Kit `queueVerified`, persisted OBS source row, approved full `CellId`, production HAM-signed ActionHash or independent history is present in that candidate. The complete manifest has `witnessDigest:null` and `acceptance:"BLOCKED_NO_KIT_LEDGER_DESTINATION_OR_SIGNED_HOLOCHAIN_ACK"`.

## Delivery / reconciliation gate

Single source key and exact destination; `pending -> uncertain` must be fsync-persisted **before** write. Conduct exact destination preflight and read before write; after any potentially successful call, persist uncertainty and read the exact source ID. Only a typed **real** Holochain signed ActionHash plus exact observation/digest/denials and authorized DNA/agent/cell/source readback may advance to `acked`. A mock `actionHash` is not a signed acknowledgement. Lost acknowledgement, crash, timeout, conflicting/missing readback, reused ActionHash, wrong agent/DNA or changed occurrence => durable `hold` or refusal; never blindly repeat an ambiguous write. No global exactly-once, hostile-host rollback resistance or remote fork policy is demonstrated.

The original refund at slot 65 remains selected archival history, not complete produced-slot indexing, and **cannot enter the deposit-only v1/v2 ABI**. No caller-supplied `historyCoveredByTwoRpcClaims:true` can make it authenticated. Continue `HOSTILE_FILE_ROLLBACK_UNPROTECTED`; external monotonic checkpoint and independent history/security review remain outstanding.

## Exact cross-lane handoff

**A3 owns** `observer/**` source and Kit-backed admission/reconciliation tests. **A4 owns** new controlled-DNA versioned ABI, approved source-to-WASM/DNA and real Lair-signed record/readback/restart. **A5 owns** independent source/tuple/capability/signature review; **A1 owns** exact-SHA CI and original artifact wiring. No approval is inferred from this document or passing archive-hash tests. Freeze this recommendation for review only; no v2 production writes before independent approval.
