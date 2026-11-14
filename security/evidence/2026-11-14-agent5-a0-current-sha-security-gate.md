# Agent 5 — P0 independent security gate, refreshed live-source review (2026-11-14)

**Disposition: CHANGES REQUIRED / A0 complete NO-GO, B1 NO-GO, B2 NO-GO, C NO-GO.** This is a source-pinned, independent *security workstream* assessment, not GitHub independent-account approval. The authenticated GitHub reviewer is also the implementation PR author; no PR reviewed here has an enforceable APPROVE from a different authorized account. No write, economic authorization, production merge or released Unyt coordinator call is approved. Do not turn workflow success into acceptance of an untested integration.

## 1. Frozen reviewed inputs and evidence grades

| Area | Exact reviewed SHA | Direct inspected evidence | Limit |
|---|---|---|---|
| SEC parent PR #33 | `bdbd8f57842261aec5c5f3d10260f4b40bfe62d0` (before this report) | prior SEC-38 reports and gates | Security author review is not distinct GitHub approval |
| SOL #43 | `f9d65f1935f679d0052e19bc23960d5b2461452d` | `tests/solana/signed-message.mjs`, `verify-witness-{bundle,tamper}.mjs`, localnet build and workflow; real [run 43592157300](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43592157300), job 132438982232 **success**; artifact 14112679385 `sha256:d001f67b581ba61ca671f5caa5f6a54bf612328e887eeec72ba26b57bc2f5879` | GitHub Actions metadata and real job log rechecked; do **not** call that artifact ZIP hash a source consensus proof. Earlier SEC report documents an independent byte-level audit; this update did not redownload its bytes |
| OBS outbox #48 | **new head** `220d5aa314c5b154608af24dea8b0af5c1ed6053` (supersedes briefing's `7452b7d...`) | `observer/src/demo-outbox.mjs` blob `47442de7e6371ebd0554ec51d08d9e6d038c862e`, test blob `b9b70a3876f7f148ddb9f2b6a836218a492ec91e`, documentation | Claimed 27 local mock/synthetic tests, not a new real-Kit `queueVerified` or Lair runtime run at this SHA |
| DNA/HAM #44 | `a0e5908a57d867a09abbc824b59db655b9052f62` | actual Rust integrity/coordinator/HAM code, `SEC_REVIEW_TUPLE.md`, `dna.yaml`, `build.sh` and ABI | No head workflow, Rust locked build, own WASM/DNA/hApp hashes, installed app/CellId, external-Lair signed ActionHash, restart/readback |
| A1 #46 | `bc7c8020e2a623cd3a7ce1c8be697fb88faf3365` | [shared 43593366000](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43593366000) **6/6**, [real cross-agent 43593366067](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43593366067) **3/3**, actual original-wire three-mode Observer replay in job 132445334150, artifact 14113652255 `sha256:9f4dc3d4a94dc918e37edaf90489a121929e508e95690ed67ec95c7f39f99598` | Does not contain #43 signed-message hardening, #48 outbox or #44 own runtime |
| A1 #49 | `a51e3354c74fbb61cd30a1ab6e41ed9da6211a40` | [RAVE 43594648110](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594648110) **5/5**, [shared 43594685075](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594685075) **6/6**; [cross-agent 43594685052](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594685052) **IN PROGRESS at inspection** | No 3/3 completion evidence for #49 at this checkpoint; no own-DNA signed write at this SHA. RAVE conductor run is for published **Unyt release install/read-only administrative probe**, not our DNA and not economic API |

**Important:** All five RAVE jobs on #49 are same-`a51e...`; they do **not** make #46's 3/3 proof same SHA as #49. Recheck #49 cross-agent final status and exact archived artifact *before* claiming its 3/3. A successful future #49 run without #48 + #44 adoption still cannot satisfy A0.

## 2. SEC-38 separate dispositions — SOL #43 only

| SEC requirement | Verdict | Pinned positive result | Remaining independent negative/provenance gap |
|---|---|---|---|
| **SEC-38-1** signed message and precise effective attribution | **ACCEPT for non-economic LOCALNET TEST evidence only** | `signed-message.mjs` recomputes required Ed25519 signatures, signed keys/header, fees and message-effective privilege union; separate *not wire-signed* requested account flags checked against pinned Anchor IDL / limited SPL Token ABI | Reject ALT lookup versions (`ALT_UNVERIFIED`); requested-attribution path is single-instruction; no broader transaction/protocol acceptance |
| **SEC-38-2** genuine original bytes and contradiction | **ACCEPT for non-economic LOCALNET TEST evidence only** | Original submitted wires required, duplicates equal, validated against base64 finalized getTransaction and containing getBlock; `WIRE_REQUIRED`, `WIRE_MALFORMED`, `WIRE_CONFLICT`, `WIRE_FINALIZED_TRANSACTION` seen in real job | A validator's RPC and local archive are not independent finality |
| **SEC-38-3** all negative classes, verifier failure semantics | **CHANGES REQUIRED** | Real job reported 18 named mutations + pristine control **per** lifecycle / init-capture / u64-max, 54 negative executions; classes include `SIGNATURE_INVALID`, `ATTR_REQUESTED_IDL`, `ATTR_INSTRUCTIONS`, `ATTR_PROGRAM`, `ATTR_SIGNERS`, `ATTR_FEE_PAYER`, `ATTR_BLOCKHASH`, `ATTR_REQUESTED_ACCOUNTS` | Missing containing block still accepts raw `ENOENT` instead of semantic `WITNESS_BLOCK_MISSING`; missing isolated signed header account-index/fee payer manipulation, v0 + ALT refusal, duplicate-requested flags, conflicting non-rewards meta, and first-failing-invariant precedence controls |
| **SEC-38-4** source/installer/build/deployed provenance | **CHANGES REQUIRED** | Commit/IDL/ELF hashes, generated Anchor IDL, tracked pre/post sync source, `cargo check --locked`, actual deployed ProgramData ELF byte comparison, recorded upgrade authority, pinned Anchor fork commit; genuine three-mode validator/restart log | `sol-verify-temporary.yml` downloads `https://release.anza.xyz/v4.1.2/install`, SHA256 **logs after download but checks no externally reviewed expected digest before `sh`**. Post-sync compiled-tree changes must stay attributable; source/CI/operator trust and ungoverned initializer/upgrade authority remain |

**No unconditional SOL #43 to #40/#35/main adoption until SEC-38-3/4 and distinct reviewer signoff.** Exact reviewed artifacts: [job log](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43592157300/job/132438982232), [artifact](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43592157300/artifacts/14112679385). A previous reference report `security/evidence/2026-11-14-agent5-sec38-f9d65-demo-convergence-review.md` contains additional cryptographic evidence details, not a substitute for approval.

## 3. Source-owned OBS #48 outbox, trust and crash review

**Accepted as inspectable source-level progress, not approved as authenticated destination transport.**

- **Trusted in-process admission:** `queueVerified` dynamically imports production `fetchFinalizedTransaction`, `verifyDepositCandidates`, `observeRpc` and `reconcileObservations`, requires two distinct URL strings, source-pinned program/mint/scope, one matching receipt, and an open `DepositLedger`. The fresh verified event is checked against the original durable source ledger before projection. The public `queueSyntheticFixture` is separately gated by `DEMO_ALLOW_TEST_ONLY_FIXTURE=1`. There is **no** arbitrary caller JSON-to-`observer_reviewed_outbox` method. This trust boundary assumes the JS process, pinned expected config and underlying Kit/provider source are trustworthy; two URLs do not imply two operators.
- **Canonical identity:** `domainDigest` hashes `domain || 0x00 || canonical sorted-key JSON`, rejecting unsafe integers and prototype keys. Work digest binds source `genesis:program:receipt`, occurrence `genesis:program:signature:outer:index`, original signed-wire SHA256, RPC metadata, an observed receipt snapshot, ledger evidence and destination. No generic user-provided 64-hex digest becomes authentication. **But:** the compact v1 Holochain record contains only witnessDigest, not independently readable nonce, recipient, blockhash, historic receipt hash, getBlock bytes or verification/code artifact references. These are inside upstream hashed source materials; the destination cannot independently audit them from a v1 record without the separately retained, immutable preimage manifest. An attacker who controls both unanchored local preimages and the local journal can rewrite them coherently.
- **Scope and delivery:** constructor freezes expected scope and destination (app, DNA, agent, role=`audit`, zome=`solana_audit`). Remote `client.preflight()` must exactly equal pinned destination; typed `read(source_id)` must return the identical full observation, four denial fields and a nonempty ActionHash. Distinct source IDs cannot ACK the same hash. Crucially this is **trust in the client implementation**: no real #44 HAM transport has been bound to this interface at the inspected SHA, so self-asserting mock preflight/ActionHash is insufficient.
- **Crash/ACK discipline:** local exclusive `.lock`, temp file, `fsync` file + parent dir, `pending -> uncertain` **before signed write**; after timeout/crash or ambiguous ACK, reads the same target first. Missing read on `uncertain` becomes `hold`, never blind retry. Same-source concurrent operations are denied. Existing 27 fixture/mock tests include changed occurrence, two out-of-order sources, cross-source ActionHash reuse, unavailable conductor and old-file rollback, but **none** are genuine remote signed tests.
- **Local-only uniqueness:** `#queueInternal` refuses same source changed fingerprint and occurrence reuse. `get_observation` in #44 looks up **local author's chain only**. Neither local lock nor on-chain local-author lookup is a globally unique receipt across agent forks, cells or host restore.
- **Hostile old-file rollback:** test 15 expressly restores a valid older outbox journal. `rollbackSecurityHold: HOSTILE_FILE_ROLLBACK_UNPROTECTED` is an **honest warning**, not prevention. External independent monotonic checkpoint/high-water mark absent; `fsync` is crash durability, not anti-rollback.
- **Refund history:** the durable OBS ledger still has a caller-controlled `historyCoveredByTwoRpcClaims:true` transition input; do not export it as authenticated, full-history refund proof. The 54 signed witnesses and 52 selected blocks are not exhaustive produced-slot history or a second operator's consensus. V1 is **deposit-only**, no historical refund commitment/revocation.

**P0 interoperability conflict:** #48 emits `proof.evidenceOrigin:'observer_reviewed_outbox'`, whereas #44 JS ABI, Rust DNA integrity and Rust HAM adapter each require **`'test_only_fixture'`** and explicitly refuse that origin. Do not fix this by merely changing the label: use a new reviewed producer-authenticated intake boundary and a versioned zome/capability. No current live authenticated outbox→DNA call is possible. A1's `demo/observation-contract.mjs` (`source/witness/destination`) also is **not** the #44 `root/source/proof` ABI. No silent field-dropping conversion.

**Additional reviewer tests required:** mutate and independently recompute upstream source `recipientCore`, nonce, blockhash, original receipt bytes and `getBlock` content, then check the outbox produces refusal before write (not just a changed digest); verify genuine Kit-backed `queueVerified` against original localnet artifacts at one SHA. Preserve original archive bytes and published original digest in an externally verifiable evidence bundle; bind all claimed preimages to the witness hash and exact verifier version. Prevent `status:'acked'` from being interpreted as independent finality or nonrefundable backing.

## 4. #44 Holochain audit-only call review (distinct from A0)

**Static code boundary seems deliberately narrow, but call authorization is REFUSED / tuple incomplete.** `integrity/src/lib.rs` uses `deny_unknown_fields`, verifies source domain from DNA properties, three literal economic-denial layers, base58 key lengths, canonical positive u64, source/occurrence form, `historyComplete:false`, deposit only, and currently allows only `test_only_fixture`. Update/delete/link registrations rejected. `coordinator/src/lib.rs` exports only `get_contract`, `get_observation`, `list_observations`, `record_observation`; same-author identical retry returns old ActionHash, conflict errors. `ham-adapter/src/main.rs` verifies app/one provisioned `audit` role/full CellId+agent, typed `get_contract`, uses pinned HAM `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4` with `LairCredentials::Node`, `CapGrantOptIn::Withheld`, fixed redacted error classes. It does not expose a published Unyt/economic zome call or implicit cap grant.

**No approved mutating call tuple yet:**

```text
source_commit = a0e5908a57d867a09abbc824b59db655b9052f62 (source candidate; not built)
integrity_wasm_sha256 = MISSING ; coordinator_wasm_sha256 = MISSING
dna_bundle_sha256 = MISSING ; holochain_dna_hash = MISSING ; happ_sha256 = MISSING
installed_app_id = MISSING ; role = audit
full_CellId = (MISSING_DNA_HASH, MISSING_AGENT_PUBKEY)
Lair = Node external credentials, CapGrantOptIn::Withheld (configured but NOT EXECUTED)
signer = MISSING (not independently allowlisted)
zome = solana_audit ; proposed_function = record_observation
ABI = solana-observation-demo-v1, version 1, fixture ONLY; canonical ABI/build hash = MISSING
authorized_source = test_only_fixture only; observer_reviewed_outbox NOT ACCEPTED
permission = no Unyt transactor / RAVE / credit / spend / grant / refund / withdrawal
last_real_ActionHash = NONE ; signed_readback/restart = NONE
SEC_call_scope_authorization = NOT GRANTED
```

The current `dna.yaml` still has placeholder network seed/source fixtures; neither Cargo lock exists. `build.sh` refuses both. Claiming compiled WASM, actual installed DNA identity, trusted 0.7.1 Lair signer or runtime duplicate/conflict semantics would be false. A **reviewed one-off fixture-only signed call** may be approved *later* against a fully populated exact runtime tuple and negative matrix, independently of approving A0 end-to-end; the reverse implication also fails. Published `unyt-sandbox` v0.117.0 coordinator source/ABI/capability equivalent remains inaccessible. Installing that signed release in a sandbox does not authorize a coordinator call.

## 5. Versioned A1/A3/A4 adversarial contract acceptance cases

These are **required independent integration tests, not claimed executed**. They must run against actual source-verified output from the same immutable integration SHA, on the real authenticated producer/transport boundary. Each failure must assert a stable *specific* error class and **zero new Holochain actions**, not simply a nonzero process exit.

| ID | Mutation / condition | Required result |
|---|---|---|
| SEC-A0-01 | Untrusted JSON `verifiedByRpcClaim:true`, `transactionVerified:true`, `evidenceOrigin:'observer_reviewed_outbox'` with forged values | Reject before queue; arbitrary JSON cannot enter reviewed origin |
| SEC-A0-02 | Original signed wire byte or required signer changed, or signed header accounts/fee payer/compiled program index changed | `SIGNATURE_INVALID` / precise `ATTR_*`; no queue/write |
| SEC-A0-03 | Correct wire with wrong signed program, genesis, mint, PDA, scope, depositor or recipientCore | Explicit scoped `SOURCE_SCOPE_*`, `SNAPSHOT_FIELD_*` or verifier-specific refusal |
| SEC-A0-04 | Change only nonce, `blockhash`, `receiptSnapshot.receiptDigest`, original getBlock entry/metadata, or alter `transactionHash` while keeping 64-hex shape | No digest substitution/field loss: upstream authenticated source mismatch, source witness digest mismatch, or original signed-wire/block attribution refusal |
| SEC-A0-05 | Valid receipt with changed signature/outer instruction index, duplicate source ID with changed amount, or two sources forced to share ActionHash | `OCCURRENCE_ID`, `SOURCE_FINGERPRINT_CONFLICT`, `REUSED_SIGNED_ACTION_HASH`; no ACK |
| SEC-A0-06 | Change one nested or root denial; inject missing/unknown field, negative/zero/fractional/overflow/leading-zero amount, invalid base58 key | `*_ECONOMIC_DENIAL`, schema/u64/key error; zero write |
| SEC-A0-07 | Valid source but wrong `appId`, DNA hash, full CellId, agent, zome, role, contract version, signer or Lair/grant mode | Distinct source/target/ABI/Lair refusal; **never** Unyt or economic call |
| SEC-A0-08 | Crash after durable `uncertain`, after signed write before ACK, after remote ACK before local ACK; unreadable conductor, conflicting remote record, forged action hash | Target-scoped typed read/reconcile; ACK exact record once only or durable HOLD, never blind second write |
| SEC-A0-09 | Restore a valid old journal after ACK, replay on new host/agent/cell, or fork local-author chain | **Document demonstrated vulnerability / HOLD**, not a fabricated global monotonic pass; require independent external anchor before B1 |
| SEC-A0-10 | Submit refund as v1 deposit, claim full history via public `historyCoveredByTwoRpcClaims`, or set `historyComplete:true` | Refuse; no durable refund/full-history/economic claim |
| SEC-A0-11 | Same signer claims two mutually inconsistent provider-finalized slots or signed metadata, v0 ALT without historic state, missing containing-block file | Fail closed with semantic contradictory/unsupported/history-missing class, not unexplained `ENOENT` |
| SEC-A0-12 | Re-execute entire producer, Observer Kit, authenticated outbox, own DNA HAM write, signed readback/restart and all negatives from one SHA | Passing manifest of **one candidate SHA**, public artifact SHA256/bytes, no unpinned source fallbacks, no skips; independently review actionable tuple and hashes |

**Actual commands to require on A1's future one-SHA CI** (not yet applicable to current #49):
```sh
node --test tests/solana/signed-message-fixtures.test.mjs
node tests/solana/verify-witness-bundle.mjs lifecycle
node tests/solana/verify-witness-bundle.mjs init-capture
node tests/solana/verify-witness-bundle.mjs u64-max
node tests/solana/verify-witness-tamper.mjs lifecycle
node tests/solana/verify-witness-tamper.mjs init-capture
node tests/solana/verify-witness-tamper.mjs u64-max
npm --prefix observer ci --ignore-scripts
npm --prefix observer run check
npm --prefix observer test
node --test observer/test/demo-outbox.test.mjs
node --test observer/test/indexer-metadata-handoff.test.mjs
node --test observer/ci/s0-signed-wire-evidence.mjs
node --test tests/holochain/demo/demo-abi.test.mjs
# On reviewed 0.7.1 runner only, after exact reviewed Cargo locks and disposable scope:
bash holochain/demo/build.sh
cargo +1.95.0 build --locked --manifest-path holochain/demo/ham-adapter/Cargo.toml
# A4-supplied real HAM Lair preflight + record_observation + same-cell get_observation
# + readback after restart + wrong-CellId/refusal/crash tests remain REQUIRED but absent.
```

No fixture-only test may be counted as an authentic original-wire runtime positive. All tests should report run ID, SHA, source blobs, archive ZIP SHA-256, in-bundle file hashes, IDL hash, deployed ELF hash, own DNA/WASM hashes, full CellId, signer identity, remote ActionHash and stable failure classes, or explicit `NOT RUN`.

## 6. Gate decision (separate from architecture research)

| Gate | Current outcome | Minimum evidence to open |
|---|---|---|
| **A0 audit-only basic E2E** | **NO-GO**. Individual SOL/#46 real replay and #49 RAVE successes do not combine into authenticated outbox→own DNA→restart at one SHA | Pinned final A1 SHA includes reviewed #43 + #48 + #44 if adopted, genuine Kit producer/replay, external-Lair own-DNA signed deposit audit call, exact preimage digest and same-CellId readback, crash/duplicate/conflict/tamper, explicit denials and separate independent reviewed approval. One independently accepted *fixture-only* audit call (if separately allowed) is not E2E acceptance |
| **B1 full finalized history / external checkpoint** | **NO-GO** | Original exhaustive produced-slot `getBlocks` enumerations for two genuinely independent operators, complete original `getBlock` entries and ALT historic state, authenticated refund transition, independent finality policy, external operator-controlled monotonic checkpoint and host rollback/recovery tests |
| **B2 published authorized Unyt** | **NO-GO** | Exact deployed Unyt coordinator release source↔WASM↔DNA identity, ABI, role/capability/grant/signer authority and independent approval of specific harmless call before execution |
| **C financial bridge** | **NO-GO / P0 STOP-SHIP** | Authorized governed/atomic Solana initialization + controlled upgrades, genuinely nonrefundable committed collateral and accounting/conservation including outstanding unpaid withdrawals; independent finality, fork/partition/recovery anti-replay, refund-after-credit exclusion, independent signer quorum and single-use claims, authentic Unyt credit/withdrawal permissions and formal security approvals |

**Security invariants preserved:** `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`, `historyComplete:false`; no one can infer `fully_backed` or economic finality from A0.

## 7. Formal independent reviewer bundle / stop-ship handoff

Reviewer must be a **different authorized GitHub account** from `ConorTttttt`, using an enforceable APPROVE on *the exact approved implementation commit* with actual repository branch protections. None exists in fetched review submissions for #33/#43/#44/#48/#49 at inspection. Ask that reviewer to cross-check: (1) #43 SHA, Actions job and artifact #14112679385 (ZIP hash above), precise SEC-38-1/2/3/4 dispositions and installer gap; (2) #48 source blob `47442de...`, 27 mock tests versus missing live Kit queue; (3) #44 Rust source/ABI and unfilled tuple; (4) #46 and #49 distinct immutable results; (5) A0/B1/B2/C table and known economic NO-GO.

**Stop-ship owners:** A2 — `SEC-38-3` precise missing-block reason and broader provenance negative matrix, `SEC-38-4` pinned installer expected digest; A3 — execute genuine Kit queue against original bundle, preserve all evidence preimages, source-authenticated v2 receipt and honest rollback/refund status; A4 — compiled locked disposable DNA/WASM, exact installed role/CellId/Lair signer, versioned OBS source admission and real signed readback/restart negatives (no Unyt call); A1 — one SHA integrating source-owned reviewed lanes, all relevant CI/RAVE jobs and complete actual artifact capture; independent authorized account — formal exact-SHA approval. No new custody ADR required: outstanding full history, independent operator finality, fork and restore, refund-after-credit, hostile-host rollback and governed irreversible custody already constitute the economic blocks.
