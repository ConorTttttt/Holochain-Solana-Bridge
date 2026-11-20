# P0 OBS refund + history + monotonic checkpoint gate — 2026-11-14

**Status: DRAFT / SECURITY AND REAL KIT REVIEW REQUIRED. Never credit or withdraw.**
PR #36 on `agent/obs/8-observer-validation`. These changes are entirely `observer/**`. Do not merge into main or describe two RPC agreements as independent finality.

## Independently executed original SOL witness checks

Archive: SOL run [43577100529](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43577100529), immutable artifact **14106778660**, ZIP SHA-256 `aa4cbdf19979816f48c1b2a2327bd09bc578953f5b5794bb8863672b41da7600`. Source `cca4e9a94b5147efa82ac0106f1f97f75a42251f`; original IDL `1d0693206815787d1ee7fe22435f39dd3bf6b3953a3dcb4b58cc7c82aa653121`; original ELF `753c130a158e35c241962c07d7425a0ced70a2496354f39dd4187f4d3c6cdb38`. Deployed program `EHT4VAKN1p1XMVkANkMunF8T6Hv3ASskRNDiEPQZ8nYh`. All **246/246** archived manifest paths passed `sha256sum -c`.

On 2026-11-14 this agent re-opened that original ZIP, decoded raw legacy signed wire, checked *every required signer Ed25519 signature* across every archived base64 containing block with Python `cryptography`, original signed submission wire, each finalized base64 `getTransaction`, containing block transaction and metadata with ONLY `rewards:null` versus `[]` equivalence, and distinct scenario genesis. Exact command `python /mnt/data/observer-witness-audit.py` (local independent audit, not Kit). Output:

```text
archive_sha256=aa4cbdf19979816f48c1b2a2327bd09bc578953f5b5794bb8863672b41da7600
original_signed_witnesses=54 successful=22 failed=32
complete_containing_blocks=52 ed25519_verified_entries=106
mode=lifecycle genesis=Ay3GSFNuCwTjMzLSyotzzsYcbdQfVAqrZwkdeHFN4wDK witnesses=45 blocks=43
mode=init-capture genesis=CneMp5SxfKQZ3aoyQQKSKBRNcuSHVmsCga7BgABiom7Z witnesses=4 blocks=4
mode=u64-max genesis=Buv1aqN463NyYeVaPp9Gv1vs68rKxqHpUZJVcRtGCxt8 witnesses=5 blocks=5
refund_original_verified: deposit_slot=17 refund_slot=65 original_payer=3W986w1WBah9KwZswH2kQC7GpHHhnNHmsh6R4C65dvuE nonce=42017 amount_base_units=250000
refund_original_post_state: receipt_refunded=1 liabilities=250000->0 vault=250000->0
HISTORY_GATE=BLOCKED: no two-provider full getBlocks enumeration, no gap-free checkpoint, no durable refund
```

The authentic pair is original deposit signature `3gE8pjd7jSVywReD5ZKGzJg9axZLW3eSoEFQfkx9W3y6XaKabAuyWYk3JeNabfJex6iUW37TNFb62oAnTas3y5Ed` at slot 17 and original refund signature `27ESHxo2S7nbX21Pf3iHUH1cqFRCMzUuAJLcXwzNpSFi5rMFHCGjSobqCn8ETcDrA9rLkiBcth5ffnK7HCmNCL1T` at slot 65. The original pre/post receipt Borsh bit changes 0→1; config total_active 250000→0; classic SPL vault amount 250000→0. This verifies THIS pair only, **not** all intervening blocks. The archive does not contain v0/ALT witness cases.

## Source changes

- `src/refund.mjs`: source-owned read-only canonical refund IDL discriminator/accounts, actual Ed25519 signed transaction, top-level owner signer, depositor+nonce receipt PDA, CPI TransferChecked amount/decimals, exact before/after token balance deltas, and precise original receipt/config/vault/mint before/after snapshot constraints. Outputs `solana-refund-evidence-v1` and four literal denial fields. Requires a process-validated `observer-history-coverage-v1` to mark a transaction as historically covered; absent history remains false.
- `src/ledger.mjs`: one atomic JSON replacement for refund revocation and checkpoint; per-receipt `refund` row preserves original deposit evidence, has separate occurrence and fingerprint; duplicate/missing/orphan/rollback/economic-escalation refusals and recovery validation. `receiptState(id)` returns `refunded` only after recorded refund, never “irrevocably locked.” This remains CRASH-consistent, **not hostile-filesystem authenticated**.
- `src/history.mjs`: verifies TWO separately configured providers' original getBlocks ranges, first-available and finalized tip bounds, full base64 blocks for every enumerated produced slot, byte-identical block consistency and Ed25519 signers; checks parent linkage, v0 lookup indexes against the historical ALT account bytes when provided, and rejects missing/contradictory ALT state. Only returns a process-issued coverage record; labels omitted slots unclassified, never empty. **NO original complete-history artifact currently satisfies this contract**.
- `scripts/replay-quarantined-ledger.mjs`: real original deposit witness → disposable ledger commit → reopen → duplicate idempotence/conflict refusal, WITHOUT advancing a historical checkpoint; output never economic.
- `scripts/replay-refund-witness.mjs`: original lifecycle successful deposit slot 17 + refund slot 65 signed-wire and exact before/after observation replay, then marks **history incomplete; no durable refund transition**. Uses real Kit; requires independently supplied original archive.
- `scripts/replay-validator-witness.mjs`: explicit `-` sentinel for no-deposit, **archive-only** signed replay; init-capture contains no genuine successful deposit, so must not synthesize one.
- `test/history.test.mjs`, `test/refund-ledger.test.mjs`: synthetic bounded unit tests for archive omissions/forks and atomic revocation/recovery/duplicate/rollback denial. Fixture manifests for lifecycle, init-capture and u64-max keep three different genesis/mint/vault/scope domains separate.

The original historical indexer **still explicitly halts on included successful refund** via `verifyDepositCandidates`; this is intentional until the full archival history, historical snapshot provenance, real SDK results and SEC review complete. Do not bypass it by injecting a forged coverage JSON.

## Reproducible real Kit execution — NOT yet passed on this agent host

Local container has Node `22.16.0`, npm `10.9.2`, no source checkout, no `@solana/kit`, and outbound `registry.npmjs.org` fails DNS `EAI_AGAIN`. The source changes above have **not passed** pinned real-SDK tests in this continuation. A currently-green standalone SOL job must not substitute for Observer runtime. Agent 1 must run on an online, exact-HEAD checkout:

```sh
npm --prefix observer ci --ignore-scripts
npm --prefix observer run check
npm --prefix observer test

# Original archive from immutable GitHub artifact 14106778660:
A=/tmp/obs-14106778660
E=$A/localnet-evidence
IDL=$A/idl/deposit_prototype.json
ELF=$A/deploy/deposit_prototype.so
L=observer/fixtures/lifecycle-43577100529-TEST-ONLY-pinned-deployment.json
I=observer/fixtures/init-capture-43577100529-TEST-ONLY-pinned-deployment.json
U=observer/fixtures/u64-max-43577100529-TEST-ONLY-pinned-deployment.json

# Three INDEPENDENT raw-wire archive replay modes; '-' means no deposit issuance:
node observer/scripts/replay-validator-witness.mjs "$E" lifecycle "$L" "$IDL" "$ELF" -
node observer/scripts/replay-validator-witness.mjs "$E" init-capture "$I" "$IDL" "$ELF" -
node observer/scripts/replay-validator-witness.mjs "$E" u64-max "$U" "$IDL" "$ELF" -

# Real deposit, disposable durable commit/reopen, conflicting replay refusal:
node observer/scripts/replay-quarantined-ledger.mjs "$E" lifecycle "$L" "$IDL" "$ELF" \
  3gE8pjd7jSVywReD5ZKGzJg9axZLW3eSoEFQfkx9W3y6XaKabAuyWYk3JeNabfJex6iUW37TNFb62oAnTas3y5Ed

# Real historical refund WITNESS; must say historyCoveredByTwoRpcClaims:false:
node observer/scripts/replay-refund-witness.mjs "$E" "$L" "$IDL" "$ELF" \
  3gE8pjd7jSVywReD5ZKGzJg9axZLW3eSoEFQfkx9W3y6XaKabAuyWYk3JeNabfJex6iUW37TNFb62oAnTas3y5Ed \
  27ESHxo2S7nbX21Pf3iHUH1cqFRCMzUuAJLcXwzNpSFi5rMFHCGjSobqCn8ETcDrA9rLkiBcth5ffnK7HCmNCL1T
```

## Critical source-data request to SOL #35 / CI #39

For **each separate genesis** and trusted deployment slot 5, supply a second immutable public-only artifact from **two separately configured RPC providers** (not two aliases of the same endpoint), containing:

1. Original raw `getGenesisHash`, `getFirstAvailableBlock`, `getSlot(commitment=finalized)`, endpoint/provider identities and exact acquisition times, with immutable manifest/digests and original JSON-RPC request/response envelopes.
2. Every inclusive `getBlocks(start,end,{commitment:'finalized'})` range from deployment slot to a declared finalized tip for BOTH providers; explicit pruned/gap/errors. Never translate omitted slot to an “empty block.”
3. Every listed produced slot's **FULL original `getBlock` encoding=base64, transactionDetails=full, rewards=false, commitment=finalized, maxSupportedTransactionVersion=1**, including failed and unrelated transactions. Parent-slot+previous-blockhash continuity, duplicate signatures and contradictory provider forks must be checked.
4. Original base64 `getTransaction` and signed submitted wire for relevant deposit/refund signatures, plus exact within-slot receipt/config/vault/mint pre/post state captures. If the RPC cannot serve historical account snapshots, source must include a genuine archival validator replay/slot-indexed state proof; a later current-state read must NOT be relabelled as slot-exact.
5. If a produced block contains v0/ALT lookups, original historical ALT account bytes at the transaction slot, original lookup-table address/program ownership, exact historical context and authority/extension state, and bound resolved writable/readonly addresses. Current ALT state is insufficient. If unavailable, abort, do not guess.
6. Missing ranges/slots/provider disagreements/pruned history must be explicitly recorded as **BLOCKED**, not “gap free.” This particular artifact 14106778660 has selected blocks only.

Agent 1 must independently adopt OBS `sameSolanaExecutionMeta` in the integration replay test. The failed CI job 132404629477 used strict metadata deep-equality and hit ONLY the documented RPC `rewards:null` vs `[]` difference, across all three scenarios. No other normalization is allowed.

## SEC #33 — independent external monotonic checkpoint proposal / review request

Local checksum, lock, fdatasync/fsync, rename and local HMAC defend against accidental corruption/process crash but **NOT hostile host rollback, substitution or competing local ledgers**. Proposed external checkpoint domain separator `HSC/observer-ledger-checkpoint/v1`; canonical encoded payload binds genesis/program/mint/scope/deployment epoch, checkpoint slot+blockhash, prior checkpoint digest, archived evidence digest, per-deposit/refund Merkle root, unambiguous sequence and monotonic cumulative counters. Independent SEC/operations trust domains keep an external append-only/WORM high-water mark with threshold Ed25519 approvals and anti-replay signer epoch. On reopen, the observer must verify the external high-water mark and hash-chain before accepting any new scan or shadow handoff; fail closed when inaccessible, conflicting, forked or locally behind. This protocol is **PROPOSED, NOT IMPLEMENTED OR SEC-APPROVED**; two provider RPC signatures alone are not independent Solana consensus. No issuance, withdrawal, main merge or production-ready classification.
