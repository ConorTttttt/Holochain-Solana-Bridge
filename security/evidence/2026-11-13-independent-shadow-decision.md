# Independent SEC shadow-mode decision — 2026-11-13 (refresh of PR #33)

**Scope:** SEC-owned tests/evidence only; inspected SOL PR #35 at `db3692c0fa7fd6ef5dc36a5ac1360ff5636337be`, OBS PR #36 at `a38362a7a7041cb8290a5b8b787e47ee5d76137b`, RAVE PR #34 at `f7318f32e0640e7aa2cf9950503cbfa2034cc16e`, SEC PR #33 at `b34162443669a5111eaaefd8645b9552b3971f9e` prior to this update.

**Decision:** **GO only for non-economic, localnet-only/read-only shadow research; NO-GO for production custody, spendable credit, withdrawals, external redemption and economic release.** Neither this report nor green CI authorizes issuance. The SEC reviewer did not modify implementation under review or self-approve an economic state change.

## 1. First reproduce the actual red integrated baseline

Frozen integration snapshot `4949b5693dccba1ff373a276a75c27db2f045005`:

- Actions [43520698081](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43520698081), Observer job `132213906857`: **47/48 pass; 1 fail; 0 skip**. Exact failed test: `failed transactions require valid Ed25519 signatures before checkpoint advancement`. Stack says `Finalized indexer failed: invalid/incomplete ordered slot listing` at `observer/src/indexer.mjs:152` before signature verification.
- Frozen `observer/test/indexer.test.mjs` had `getBlocks` return `[20,21]` even when a resumed indexer requested only `[21,21]`. OBS specialist head now filters produced slots to `start <= slot <= end` and adds the associated regression. **Source-level correction inspected; not a newly executed green CI claim.**
- Actions [43520697998](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43520697998), SOL local-validator job `132213906207`: actual validator built/deployed, but enhanced lifecycle **FAILED** with `Transaction.serialize(): Missing signature for public key [JADX5XpQLbgFA7bnUC4RzzUcbvvf5FSX9CLReUctCc5S]` at `tests/solana/integration.test.mjs:480`. Client serialization aborts before the intended on-chain rejection. **Not an executed negative security test.** The init-capture, isolated u64-max and retained-ledger restart modes were not run.
- Same integrated runs: real published RAVE Rust **12/12 PASS**, Anchor build and lockfile provenance succeed. They do not resolve either failing branch or authenticate an Unyt DNA.

**Critical interpretation:** a faulty negative-test fixture can hide an untested signature check. Do not replace a signature rejection assertion with a generic `assert.rejects` or count a JS missing-signer exception as an on-chain authorization rejection.

## 2. New independent SEC regressions

| Test | Target | Current witnessed result | Required combined-branch result |
| --- | --- | --- | --- |
| `security/test/indexer-checkpoint-regression.test.mjs` | Valid two-slot `getBlocks` listing; signed *failed* unrelated transaction; forged Ed25519 after signing; provider block disagreement; deliberate out-of-range listing; immutable checkpoint/recovery | Node 22.16.0 `node --check`: PASS. Standalone `node --test`: **0 pass / 0 fail / 1 skipped**, because OBS branch/real Kit absent. **UNVERIFIED at runtime** | Install pinned OBS dependencies in combined checkout; verify malformed signed failed tx rejects on **Ed25519**, checkpoint remains 20, lock released, honest replay advances 21 with 0 evidence/credit; provider disagreement cannot checkpoint; invalid fixture errors only in dedicated fixture-negative case; **0 required skips** |
| `security/test/solana-rave-numeric-gate.test.mjs` | Canonical exact u64 strings, >2^53, ZFuel i64 six-decimal ceiling, nonrepresentable scales/rounding, duplicate raw JSON keys | Node 22.16.0 `node --check`: PASS; `node --test`: **5 pass / 0 fail / 0 skipped**. These are **reference contracts**, not Rust execution or a deployed conversion API | Preserve exact numeric strings, reject unsupported amounts rather than truncate; run RAVE Rust with locked published crates and auditable production ingress; reject duplicate keys **before** parse |
| Existing `security/test/transaction-provenance-adversarial.test.mjs`, `replay-ledger-adversarial.test.mjs`, `historical-localnet-accounts.test.mjs` | Signed wire/ALT/RPC manipulation, durable local replay, independently decoded historical SOL account bytes | Committed previously; run status is branch/snapshot specific; do not silently count SEC-only skips | Execute on exact refreshed combined head with actual Kit; positive and adversarial cases pass, no required skips |

Exact local commands:

```text
$ node --check security/test/solana-rave-numeric-gate.test.mjs
# exit 0
$ node --test security/test/solana-rave-numeric-gate.test.mjs
# tests 5; pass 5; fail 0; skipped 0
$ node --check security/test/indexer-checkpoint-regression.test.mjs
# exit 0
$ node --test security/test/indexer-checkpoint-regression.test.mjs
# tests 1; pass 0; fail 0; skipped 1 (expected missing combined OBS module)
```

## 3. Independent trust-boundary assessment

**SOL:** `Initialize` allows any funded `admin: Signer` to create the single `[b"config"]` PDA, supplying mint and nonzero Holochain scope. There is no pinned root-authorizer constraint. This is a **confirmed source-code first-initializer capture vulnerability**, not a newly verified validator exploit. `Deposit` uses a signer-constrained depositor, canonical nonce/owner PDA, typed classic Token Program, a config-controlled token vault and checked arithmetic. `Refund` explicitly permits the original depositor to withdraw; `total_active` then decreases. It is intentionally NOT locked collateral. New concurrent-depositor, rejected-transaction, duplicate nonce, mint/upgrade authority and restart tests are source-visible but need **real validator signatures, included meta.err, post-state and tested ELF/IDL hashes** before acceptance. Upgrade authority observation is not upgrade governance.

**OBS:** Current scanner source cryptographically verifies all required signers even for failed transactions and compares two provider-reported blockhashes, slot enumeration, and parent continuity before checkpoint commit. This improvement is **inspected source**, not freshly executed SDK evidence. Two URLs can be controlled by one operator; identical fabricated finalized RPC metadata is still not an independently authenticated Solana finality proof. v0 ALT loaded addresses and CPI/token balance metadata are RPC assertions; historical address-table provenance and code-upgrade identity require separate verification. The persistent ledger protects local idempotency and checksums but is neither authenticated against an adversarial filesystem administrator nor globally unique across two separate stores.

**Holochain/Unyt:** The current repository contains shadow JS adapters/reference RAVE tests, **not verified production-equivalent integrity/coordinator zome source and deployed WASM**. For future real DNA: integrity validation can require deterministic signed entries/links and fixed public DNA properties, but does not itself authenticate Solana finality; coordinator zomes orchestrate calls/state and are not a consensus oracle. A member's source-chain history and DHT observations need fork/warrant and partition handling; a client's `Parked` marker is **not irreversible proof of spent entitlement**. Countersigning in the referenced Holochain 0.7.1 line requires an `unstable-countersigning` feature on BOTH HDK and conductor; do not assume it exists in the deployed binary. Migration `InitProperties` are conductor-local and invisible to DHT integrity validation; `restore_from_dht` depends on key continuity, peers and warrant checks. Cross-DNA and cross-agreement replay prevention needs an independently durable global entitlement identity and proof of previous-history extinction. External signer policies/capability grants are separate from integrity validity. **No real conductor fork/recovery/countersigning/partition experiment verified here.** The skill's Holochain 0.7 examples are conditional: deployed Unyt versions are unverified.

**Numeric boundary:** Solana source base units are unsigned **u64** and must remain canonical decimal strings or BigInt inside JS. Published `ZFuel` uses signed **i64** units at up to six decimal digits; its positive micro-unit maximum is `9223372036854775807`, smaller than `u64::MAX=18446744073709551615`. For a six-decimal mint, `9007199254740993` micro-units must map to `9007199254.740993` whole units, NOT `9007199254740993` whole units. If a mint has >6 decimals, any amount leaving fractional micro-units must be rejected, **not rounded**; if <6, multiplication must be checked for i64 overflow. `JSON.parse`/serde_json `Value` collapses duplicate raw keys, so reject raw duplicates before normalization. MessagePack string/integer variants and Rhai numeric casts require separate executable checks; published library tests do not prove production wire enforcement.

## 4. Acceptance-gate matrix — explicit readiness

| Gate | Current state | Exact exit condition | Approver |
| --- | --- | --- | --- |
| G0 integration baseline | **FAIL**: OBS 47/48; SOL lifecycle signer build failure | Agent 1 integrates updated OBS + SOL heads, runs real Kit and all four SOL modes on exact pinned snapshot; 0 fail / 0 required skip; signed raw getTransaction/getBlock and ELF/IDL hashes attached | CI plus independent SEC |
| G1 admin/custody authority | **P0 BLOCK**: unrestricted singleton first-init; refundable deposits | Negative attacker-first on old program proves bug; separately approved hardened program rejects attacker signed tx on real validator, operator/mint/scope allowlist and program upgrade policy verified; full reserve reconciliation | SOL implementation, SEC-independent review |
| G2 transaction inclusion/indexing | **BLOCK**: forged RPC, unverified ALT, fresh regression not green | Complete signed full-block success/failure, v0/v1/ALT historic inputs, corrupt failed/unrelated signature, restart, parent/provider conflicts, durable replay; authenticated finality/assumed attestor threshold documented | OBS, CI, SEC |
| G3 exact numeric contract | **PARTIAL**: independent JS model 5/5, published RAVE 12/12 | Integrated exact scale/u64-to-i64 overflow/rounding tests, raw duplicate JSON rejection at actual ingress, MsgPack and Rhai, no Number conversion | RAVE, SEC |
| G4 Holochain fork/recovery/migration | **BLOCK**: no verified deployed DNA/conductor | Hash source/WASM and actual running conductor; two-conductor tests for fork, partitions, countersigning failures, `Parked` invalidation, restore and migrated replay; rejected double issuance/payout | RAVE/Unyt, independent SEC |
| G5 nonrefundable claims/redemption | **P0 BLOCK**: refund retained, no external settlement implemented | Reviewed economic state machine with globally conserved liabilities; refund-after-credit denied on source ledger; single-use withdrawal finalized with crash/retry/upgrade tests and independent signers | Project owner + independent SEC |

**Shadow milestone decision:** isolated observational demonstration **may proceed ONLY with economic controls hard-disabled** (`creditEligible:false`, `independentConsensusVerified:false`, no spendable credit, no withdrawal signing, no real-value custody). It cannot be advertised as a deployed economically secure bridge. PRs should remain draft until G0's test defects have been repaired and measured, and even a green G0 does not clear G1–G5.

## 5. Required cross-lane handoffs

- **OBS #36:** complete latest fixture repair; validate this SEC indexer test on actual locked Kit; supply confirmed block/transaction/ALT evidence and a detailed trust assumption. Failed transaction signatures must always be checked before checkpoint advancement.
- **SOL #35:** correct all fee-payer/deposit-owner signers in concurrent and authority negative cases. Demonstrate real included failure signatures, first-initializer capture, u64 max, duplicate nonce race, preserved ledger restart, minted supply/upgrade authorities and raw accounting. Do not claim on-chain rejection for client-side construction failure.
- **CI #32/#37:** refresh a new immutable integration snapshot with both owner fixes plus SEC tests; report exact SHA, command output, failed/skipped counts, all required fixtures and any remaining upstream blocker. **Do not alter the frozen 4949b569 baseline.**
- **RAVE #34:** independently run real conductor/DNA tests; establish exact deployed source equivalence, migration/fork/capability trust boundaries and numeric ingress. Preserve shadow-only denial.
- **SEC #33:** verify fresh CI evidence, keep P0 gates visible and do not self-approve economic changes.

No changes here to Solana program, Observer, Holochain implementation, CI workflows or economic authorization.
