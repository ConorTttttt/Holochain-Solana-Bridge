# Observer-owned demo outbox review — 14 November 2026

**Status: DRAFT source-only implementation / NOT a real Holochain write / Gate C NO-GO.** Scope is exclusively observer/**. This review branch is based on OBS #36 at `2931c5fc51736e3c845cb9bedc55c578534b53a1`. It must target `agent/obs/8-observer-validation`, not main.

## Versioned boundary: solana-observation-demo-v1

The exact Holochain record is the A4 #44 ABI: root `kind,schemaVersion,source,proof` and four literal economic denial fields. The source object carries `id,occurrenceId,genesisHash,program,mint,holochainScope,receiptAddress,depositor,signature,finalizedSlot,instructionIndex,amountBaseUnits,sourceEventType,witnessDigest,codeVersion,schemaVersion` and the same four denials. Proof is `evidenceKind:solana-deposit-evidence-v1,evidenceOrigin:observer_reviewed_outbox,verifiedByRpcClaim:true,transactionVerified:true,historyComplete:false` plus denials.

Source ID = `genesisHash:program:receiptAddress`; occurrence = `genesisHash:program:signature:outer:instructionIndex`. Origin wire, RPC execution claim, later receipt snapshot, stored OBS evidence and Holochain signed reporting record are **different** evidence classes. They must never be conflated.

OBS journal keeps witness internals and exact destination; do **not** add them as fields to the strict A4 record. Canonical byte encoding: recursively sorted-key UTF-8 JSON, exact decimal strings and safe integers only; digest is lowercase SHA-256 of UTF-8 domain separator + single zero byte + canonical JSON bytes. Journal domains are `HSC/observer-demo-outbox/v1/witness`, `.../rpc-meta`, `.../snapshot`, `.../ledger-evidence`, `.../work`. Original wire hash separately SHA-256(raw base64-decoded signed transaction bytes). No mutable metadata normalization except OBS's separately reviewed `sameSolanaExecutionMeta` comparison during source verification.

All four denials must be present and literal at root, source, proof and remote readback: `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. The ABI is **deposit-only**. A1 #45's root/source/witness/destination source-only JSON is **not** directly conformant; it needs an OBS-controlled typed projection, not a field rename on unauthenticated JSON. A4 #44 HAM adapter currently rejects `observer_reviewed_outbox`, permitting only explicit `test_only_fixture`. Source PR alone does not authorize enabling that origin.

## Outbox and trust boundary

`DemoOutbox.queueVerified` requires a **live OBS DepositLedger instance**, matching pinned source ledger entry, in-process verified evidence, exact original wire hash, later receipt-account snapshot consistency and exact destination {dnaHash,agentKey,appId,role:audit,zome:solana_audit}. This method is **not** an independent proof API: callers must only invoke it within the same trusted OBS verification process; hostile local JS can forge in-process objects or stored ledger files. Do not accept arbitrary HTTP JSON or import a synthetic `test_only_fixture` as real evidence.

Each source row is journaled atomically (`fsync` file, rename, parent directory `fsync`, exclusive lock) with state `pending`. Before a signed write, the outbox verifies the exact Holochain target and reads that source ID. It durably advances `pending -> uncertain` **before** any signed write. It re-reads exact target after the write and only moves to `acked` on exact typed observation equality, literal denials and nonempty ActionHash; if a write's return hash is given, it must agree. Uncertain recovery reads before any further action, never blindly sends a second write. Missing result after uncertainty becomes `hold` pending operator/security reconciliation. Invalid, unavailable, or wrong-target transport cannot authorize a write. No raw Lair credentials or transport errors are logged.

Local idempotence is scoped to **exact destination DNA, agent and source ID**. An ActionHash from an untrusted mock is not an authenticated receipt: A4 must supply a real signed HAM client and typed ActionHash/readback with source-to-WASM/cell binding. No global exactly-once claim.

## Explicit hostile-host rollback NO-GO

The outbox always reports `rollbackSecurityHold: HOSTILE_FILE_ROLLBACK_UNPROTECTED`. An intact earlier journal file may be restored and silently change `acked` to `pending`; a synthetic regression documents this **known unresolved attack**. This hold is not an implemented off-host monotonic checkpoint. A separate, independently administered checkpoint/high-water-mark with restart validation and SEC review is required before stronger security assertions. Local checksums, locks, fsync and Holochain readback alone cannot prevent an attacker from replacing all local state.

## B1 refund/history, separate from v1

Original lifecycle: signed deposit slot 17, nonce 42017, 250000 base units, then genuine signed refund slot 65. Current original archive 14106778660 (SHA256 `aa4cbdf19979816f48c1b2a2327bd09bc578953f5b5794bb8863672b41da7600`) contains only 52 **selected** containing blocks, 54 original signed witnesses, 106 authenticated block entries and 3 genesis histories. It does **not** provide every produced slot or historical ALT state; `historyComplete:false`, `historyIndexed:false`, `refundDurablyCommitted:false` remain mandatory. Keep `verifyDepositCandidates` intentional refund halt. A proposed v2 revocation must be separately reviewed; never insert a refund into the deposit-only v1 ABI. Never treat caller-supplied `historyCoveredByTwoRpcClaims:true` as publicly authenticated proof.

## Review acceptance and exact commands

Locally source-only: `node --check observer/src/demo-outbox.mjs`; `node --test observer/test/demo-outbox.test.mjs`. These test **synthetic** fixture boundaries and mock remote transports only; do not count toward genuine Kit/validator acceptance.

On online pinned same-SHA runner (Agent 1 / OBS review): `npm --prefix observer ci --ignore-scripts && npm --prefix observer run check && npm --prefix observer test`, then the exact original artifact replay commands already pinned in `observer/docs/REFUND_HISTORY_MONOTONIC_GATE_2026-11-14.md` (three independent scenario modes, genuine lifecycle ledger and genuine slot 17 -> 65 refund). Archive and full logs, not green helper counts. The source handoff to #45 is `observer/src/indexer.mjs::fetchFinalizedTransaction` and `sameSolanaExecutionMeta` at the **source-owning OBS exact SHA**: compare raw `getTransaction` vs containing block wire/version/metadata, all-block Ed25519 and exact failed/success status, then genuine four-account snapshots. Only `rewards:null` / `[]` may normalize, never missing or nonempty rewards. Regression-mutate wire, signature, version, meta.err, fees, balances and unrelated block entry. A passing helper test without that production import is not an integration fix.

**SEC #33 review requested:** outbox origin spoofing at its JS boundary, ActionHash/readback trust, DNA/agent scoping, host rollback, same receipt/changed occurrence, refund caller Boolean, and independently operated checkpoint/global duplicate limits.

**No real demo acceptance until:** A1 uses source-owned production verifier on exact CI SHA; A4 approves ABI origin and proves real Lair-signed audit-DNA write, readback and restart; SEC reviews trust boundaries. C NO-GO: no issuance, withdrawal, published Unyt coordinator or main merge.
