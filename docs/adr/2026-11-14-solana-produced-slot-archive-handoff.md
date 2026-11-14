# SOL -> OBS handoff: original produced-slot archive contract, 2026-11-14

**Status:** SOURCE-REVIEWED REQUIREMENTS / CAPTURE NOT YET PRODUCED OR ACCEPTED.
**Owner roles:** Agent 2 producer, Agent 1 isolated validator and second RPC plumbing, Agent 3 source-owned `observer/src/history.mjs` contract, Agent 5 SEC audit.
**Fixed baseline:** OBS PR #36 `2931c5fc51736e3c845cb9bedc55c578534b53a1`, SOL review PR #43 based on PR #40 `b4d776320f291d4eb526026a33aff2443ae48310`.
**No economics:** `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false` in outer and all nested observation records.

## What the existing evidence proves — and does not

Original selected-witness artifact 14106778660 from run 43577100529 is reported to contain **54 submitted signed transaction witnesses and 52 selected containing blocks**, not all produced blocks. The independent OBS review reports 106 Ed25519-verified entries across those selected blocks, not exhaustive indexing. The later failed PR #40 run 43584777333 produced artifact 14110785584 while the signed-flag attribution verifier failed. Retain both artifacts and exact failures. Neither is a complete independently witnessed history.

The currently inspected localnet CI launches one local `solana-test-validator` RPC at `127.0.0.1:8899`. It does not configure two independently administered validators or slot-exact historical account snapshot APIs. The missing provider/slot data **cannot be fabricated** by replaying the one provider twice or by substituting a later `getMultipleAccounts` snapshot.

## Exact Agent 3 acceptance contract

The source-owned `observer/src/history.mjs` exports `verifyArchivedHistory(archive)` and requires:

- `kind: "observer-original-two-provider-history-v1"`, trusted `fromSlot > 0`, inclusive `toSlot`, `genesisHash`, exactly two `providers` with distinct `providerId` and `rpcUrl`. Distinct URLs only satisfy a *format* condition; they do not prove independent operator control or Solana consensus.
- Per provider `genesisHash`, `firstAvailableBlock <= fromSlot`, `finalizedTip >= toSlot`, `commitment: "finalized"`.
- An original, gap-free array of `getBlocks` ranges with `{method:"getBlocks",commitment:"finalized",fromSlot,toSlot,result:[...producedSlots]}`. Every inclusive slot is covered by exactly one range; absent slots are **not classified as empty**.
- One ordered `getBlock` record for **every enumerated produced slot** from *each* provider; `{slot,method:"getBlock",options:{commitment:"finalized",encoding:"base64",transactionDetails:"full",rewards:false,maxSupportedTransactionVersion:1},result:<unaltered RPC block>}`. Do not normalize, trim, omit unrelated/failed transactions, or invent skipped blocks. Preserve the outer raw JSON-RPC request/response in public-only sidecar files and record precise errors/pruning responses even though those cannot pass the verifier.
- Equal original block results across providers, block/parent hash linkage, distinct signed transaction signatures per block, and original signed versioned wires. If a signed v0 transaction references ALT addresses, require both providers' exact historical ALT bytes, owner, size and context slot **equal to the transaction slot**. No later ALT account is a substitute.
- For the deposit/refund subset, separately retain the signed `getTransaction` base64 RPC, original submitted serialized wire, signature/slot/block linkage, original RPC execution metadata and account fixture acquisition slot. The source-owned indexer must bind receipt/depositor/nonce/scope/mint/program/transaction occurrence and deny an unfounded historical refund transition.
- Per isolated validator scenario, record deployed ProgramData slot, fixed genesis and program/IDL/ELF hashes, identity and control of each RPC provider, acquisition timestamp with timezone, order and raw status of every request; stable sorted SHA-256 checksums of *all* public files plus a manifest hash. Exclude signing secrets, ledger keypairs and endpoint credentials.

`verifyArchivedHistory` explicitly returns a non-economic `observer-history-coverage-v1` only on strict verification, and its process-local WeakSet prevents an arbitrary JSON object from impersonating coverage. It **does not** independently authenticate Solana consensus, validate a hostile historical rollback or infer an external signed checkpoint.

## Proposed capture execution plan (unexecuted)

1. Agent 1 arranges **one disposable genesis per scenario** and two separately configured RPC services, retaining truthful operator/validator identity. If both routes are to the same validator, say so; this is not independent finality.
2. Agent 2 pins the finalized deployment slot and tip, captures raw `getGenesisHash`, `getFirstAvailableBlock`, `getSlot(finalized)`, and inclusive range `getBlocks` from both; then fetches **all** base64 full `getBlock` results, including failures/unrelated transactions. Fail the history gate, not the positive custody tests, if the range cannot be obtained.
3. Store each provider's original response with method/options, slot, request timestamp and raw bytes; derive a structured sidecar exactly matching the OBS source contract. A hash manifest verifies archive transport integrity, not validator truth.
4. Agent 3 replays with real `@solana/kit`, checks versioned ALT, refund lifecycle and conflicts, and reports why any produced slot/state snapshot is unavailable rather than using later data.
5. Agent 5 independently recomputes evidence and documents two-provider dependencies, operator independence, fork/rollback and remaining trust limits. Only after review can Agent 1 consume a source-approved producer SHA for demo CI.

## Required handoff decisions

**A1:** Provide two documented RPC configurations, origin/ledger preservation until the end of archive, historical request cadence and artifact storage/retention; do not mix genesi.

**A3:** Confirm whether the above source contract is frozen or needs a version bump before producer changes; specify deposit/refund occurrence and slot-context historical state requirements.

**A5:** Define trust requirements outside two-RPC consistency: authenticated checkpoint high-water mark, independent validator finality assumptions and explicit NO-GO economic gate.

**Present answer:** no genuine complete two-provider original produced-slot archive has been delivered in this agent round. It is a hard dependency for the Observer's B1 complete-history claim; the audit-only demo may still show signed RPC observations with `history_incomplete` visibly set.
