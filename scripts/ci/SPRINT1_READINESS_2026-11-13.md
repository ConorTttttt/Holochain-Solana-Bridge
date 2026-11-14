# P0 cross-agent handoff — 14 November 2026 (authoritative newer evidence)

**Status: RED / DRAFT / NO MERGE OR ECONOMIC AUTHORIZATION.** The original integrated snapshot `cd4ab8dd61ec7353b330ba4a55f1d0ac5f5a9bf0` is immutable. It is NOT a passing combined baseline. Older dated sections below are retained as historical evidence, not current conclusions.

## Exact-head executed evidence (`cd4ab8dd`)

| Workflow / run | Job | Outcome |
| --- | --- | --- |
| Shared Actions 43529253015 | Secret/generated-file guard; disposable validator RPC smoke; reviewed lockfiles; OBS SDK unit tests; real host Rust + Anchor/SBPF; available SOL/SEC/RAVE offline suites | **6/6 jobs PASS** |
| Integration Actions 43529253005 | Real Solana local validator lifecycle, init-capture, u64-max and restart runner | **FAIL** in lifecycle subtest 6; later scenarios never ran |
| Integration Actions 43529253005 | Required real SDK offline fixtures and source-RPC/wire/shadow gate | **FAIL** (three mandatory missing transaction archives) |
| Integration Actions 43529253005 | Actual published RAVE 0.15.0 Rust | **PASS 12/12** |

Real local-validator evidence artifact **14087460958** uploaded **24 public-only files**. Disposable program `B8WpDXUeH96FiWYmhqwpF3Hf4MKNagM5XpZJtaVuPvF`; generated IDL SHA256 `ea6f78383e6fa9148a560f628fb7648bacede90388a4951c1f158f71c2b2cf83`, SBPF SHA256 `8162421ae2dd56927510d381bbe6c70ce760750e6d53ce2f02683ef106439928`. These hashes belong to this disposable build **only**. Its 14-day Actions artifact retention expires approximately **27 November 2026**; preserve audit evidence separately without keys.

**Actual P0 root:** `tests/solana/integration.test.mjs:592` test `independent wallet accounting, concurrent deposits, rollback and authority attacks` fails after the first five lifecycle subtests succeed: `InstructionError: [0, { Custom: 6004 }]`. Generated IDL maps 6004 to `MintFreezable`, but this is not sufficient to attribute the exception to an instruction/program without its raw transaction signature, ordered account metas and `meta.logMessages`. The uploaded files contain real finalized four-account snapshots and the public signed signatures for earlier successful transactions, **not** the failing transaction. SOL must publish a reproducible failing signature/log/account bundle. Do **not** weaken mint safety to make the test green.

**Artifact loss is producer-side at this SHA:** `saveTransactionEvidence()` writes `sprint1-lifecycle-transactions.json` only at the end of the failed subtest. `tests/solana/localnet-build.sh` uses `set -e`, so `sprint1-init-capture-transactions.json` and `sprint1-u64-max-transactions.json` are never produced either. GitHub uploaded partial evidence successfully; the download succeeded but cannot recover files that never existed. The downstream signed-wire/ledger/shadow milestone is **UNPROVEN**.

**CI-only remedy already staged on PR #37:** explicit downstream SOL source-owned witness-bundle validation bound to checked-out SHA, generated IDL/ELF/program/genesis for all three modes; add the previously excluded public snapshot paths `sprint1-two-wallets-live.json`, `sprint1-initializer-capture.json` and `sprint1-u64-refunded.json` to the upload allowlist. Original finalized `getTransaction` (JSON + base64 signed bytes), full `getBlock` (JSON + base64), execution metadata, and account RPC snapshots remain mandatory. These changes are **not** proof that the upstream producer bug is fixed.

## Owner requests and next exact-head gates

SOL #35: recover the exact `6004` transaction/issuer/signature, source-own its fix and test diagnostics, backport base64 block capture/witness-regex changes; run all three disposable-validator scenarios and retained-ledger restart. OBS #36: backport narrow test assertion/secondary-signer restart corrections, exercise SDK-backed signed-wire and durable-ledger tests. SEC #33: backport valid-message Ed25519 tamper fixture and independently validate checkpoints and numeric/ledger attacks. CI #32/#37: pin verified owned source SHAs, download same-run genuine archives, rerun every required suite at the exact new integrated SHA; **both required workflows must be fully successful** before green is claimed.

Still blocked beyond a passing JS shadow path: actual Unyt conductor + compatible DNA/zomes under an authenticated, reproducible runtime; multi-agent consistency and migration/partition recovery; independently authenticated Solana consensus/finality rather than a single localhost-RPC claim; economic policy, administration/upgrade controls, security signoff, production credit and withdrawal authorization. The JS quarantine-only adapter is **not** real conductor execution and must never issue credit or withdrawals.

---

# Sprint 1 integration readiness — 13 November 2026

**P0 RED / integration-only DRAFT; never merge or authorize economics.** The previous tested SHA `4949b5693dccba1ff373a276a75c27db2f045005` remains immutable. Actions `43520698081`: Anchor/SBPF compiler, lock provenance and validator RPC smoke PASS; standalone OBS 47/48 and cross-lane 124/125 FAIL. Actions `43520697998`: published RAVE Rust 12/12 PASS; real SOL lifecycle FAILED at missing signer, downstream suites not fully exercised. Earlier failed snapshot `24b60e72ac78afbab5562c605094c3146bddd653` is also retained.

The newer specialist source heads are pinned in `ci-integration-snapshot.json`: SOL `db3692c0`, OBS `a38362a7`, RAVE `f7318f32`, SEC `b3416244`. SOL fixed its malformed freeze-authority negative test, and captures complete raw JSON-RPC transactions, blocks and account data. OBS has newer ledger tests but did **not** repair the `getBlocks(21,21)` mock; CI overlays an explicitly integration-only test-fixture fix pending source-owner backport. Do not report it as a verified OBS source correction.

## Acceptance evidence needed on the exact new immutable HEAD

- Shared and integration GitHub Actions workflows both fully green, no hidden skipped suites. All lanes must check out the exact PR SHA, not a merge ref.
- Actual Rust/Anchor build and deployed localnet SBPF + generated IDL/program key agreement; preserve newly generated **current-run** binary and IDL hashes (random disposable program IDs make historical hashes nontransferable).
- Full OBS npm test/check with real `@solana/kit`, 20 required offline suites including four new independent SEC adversarial tests, real validator three fresh-ledger scenarios, persistent validator restart, original RPC transaction/block/account witness coherence, genuine locked published RAVE Rust tests, quarantine-only Solana→OBS→RAVE shadow account-state tests.
- Review four committed lockfiles and pinned SHA256 digests; new lock graphs are never silently approved. Preserve real SOL signing/accounting negative tests and independent SEC review.
- Current SOL RPC JSON fixture signatures are not complete Ed25519 wire witnesses. Do not call the captured finalized transactions cryptographically authenticated by OBS until a separate source-owned base64 wire fixture + observer replay test passes.
- The real Unyt conductor/Sweettest gate is **BLOCKED**, not a justified skip or PASS; source-to-WASM/DNA correspondence, compatible conductor, actual zome API call and multi-conductor consistency/recovery remain unavailable. See `scripts/ci/SHADOW_MODE_CONDUCTOR_HANDOFF.md`.

**Security:** SEC still identifies first-initializer capture, refundable custody, historical ALT/finality trust, and global cross-DNA replay as open economic P0 risks. Retain `creditEligible:false`, `CREDITING_DISABLED`, `WITHDRAWALS_DISABLED` and no production deployments.

## Latest P0 refresh (13 November 2026; execution not yet verified)

Skills from main @ `e1651fec` copied into the integration branch without any toolchain upgrade. The exact new specialist heads are SOL `fef1a8ce0e5958814914d973a366c6ca3c26fdf1`, OBS `1638ada9ab8fa8156a45f6db4392eedcebaeabea`, RAVE `d752c284dfdef19f873c5da75c66559d87f69b4e`, SEC `d8cbff0f5ab3d3e734fb14de944a8024d05f87cd`. The OBS slot-list restart correction is now source-owned, so the obsolete CI-only OBS fixture patch was replaced by its owning blob. The SOL signer fix and SDK negative-test regressions are also source-owned. Source-owned SEC checkpoint and numeric ingress regression suites are newly mandatory, bringing the offline matrix to **23 suites**.

The real validator currently generates JSON-format finalized transaction/block RPC witness pairs, which are insufficient for Observer signed-wire checks. To avoid claiming synthetic evidence as real, this integration candidate adds CI-only evidence capture of **base64 signed getTransaction and complete finalized getBlock** RPC responses during SOL's disposable validator run and a mandatory OBS replay test. The test authenticates signatures, entire-block inclusion and a positive deposit candidate while remaining `creditEligible:false`. The capture should be backported by SOL PR #35 before source-ownership is considered closed. These are RPC-provider observations, **not independent Solana consensus proof**. Until the exact-head workflow passes, this remains P0 RED. The real Unyt conductor stays **BLOCKED**, not silently skipped; `holochain/research/UNYT_CONDUCTOR_COMPATIBILITY_GATE.md` records the version/provenance gaps. Previous failed commits `4949b569` and `24b60e72` and their runs remain preserved.

## Second specialist synchronization / source-owned signed wires

Snapshot inputs advanced again: SOL `a6316b78`, OBS `babf3c43`, RAVE `f27f8262`, SEC `6933d360`. SOL now owns the finalized base64 `getTransaction` capture and immutable git/IDL/ELF witness bindings; its validator runner additionally fails on missing/on-chain negative witnesses in each of three modes. OBS adds signed second-signer restart cases. SEC adds persisted ledger tampering (required security suite #24). RAVE adds a separate signed-release verification and compatible CLI asset-inventory workflow; it is **not** a conductor acceptance test. The integrated evidence test now uses SOL's source-owned field `getTransactionBase64RawFile`, with only a supplemental base64 `getBlock` capture. An independent source-owner fix to `verify-witness-bundle.mjs` filename regex is pending; an explicitly tracked integration-only test correction avoids a known false failure and must be backported before merge. The CI base `47c58c1db37b14f0d01abd16c7ea5545b4e7df1e` is recorded as an integration merge parent, not altered. **No CI passing assertion until exact-head results.**

### First exact-head execution: evidence-based regression

On integrated SHA `19bf4878`, [Actions shared run 43527503901](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43527503901) executes OBS **54/55 pass, 1 failure, 0 skips**. The missing-second-signature fixture expects only an `invalid Ed25519` diagnostic although production verifier correctly rejects it as `missing required signer signature`. The integration-only test adjustment selects the specific expected rejection per fixture, retains durable checkpoint assertions, and awaits OBS source backport. The full validator/RAVE outcomes from this intermediate SHA remain separately reportable. Next snapshot merges CI branch `4a97505d` (24 required suites), without modifying the specialist branch.

### Required signed-wire replay packaging correction

The new CI-only Observer signed-wire replay test was relocated from `tests/integration/` to `observer/test/` so Node resolves the **already pinned** `observer/node_modules/@solana/kit` in the real CI job. No new dependency, SDK upgrade or production implementation change. The workflow still runs the dedicated explicit test against original SOL validator artifacts, and missing artifacts remain fatal. SEC's latest independent evidence-only commitment `b5b8c4b9` is included in the frozen input manifest; no independent economic authorization implied.

**Test discovery safeguard:** The dedicated signed-wire replay was moved further into `observer/ci/s0-signed-wire-evidence.mjs` (not `observer/test/*.test.mjs`). This preserves access to Observer's pinned `@solana/kit` while preventing the standalone OBS `npm test` from accidentally discovering an E2E test requiring real validator artifacts. The integrated workflow explicitly runs `node --test observer/ci/s0-signed-wire-evidence.mjs`, so it remains a mandatory stage, not a skip.

### Real localnet witness → persistent ledger → non-economic shadow (required test)

The explicit `observer/ci/s0-signed-wire-evidence.mjs` test now takes the **same cryptographically verified deposit candidate** identified in the original finalized base64 transaction/containing block, checks the genuine four-account finalized receipt snapshot, binds it using OBS `attachReceiptObservation`, commits the immutable evidence into a fsync/rename `DepositLedger`, closes/reopens it, proves duplicate idempotency and conflicting receipt/block rejection, then runs `reviewShadow` for active, identical duplicate, contradictory same-slot digest and a real refunded receipt snapshot. All outputs remain `creditEligible:false`, `spendableBaseUnits:'0'`, `withdrawalAuthorized:false`. The persistent ledger is **local and unkeyed**, not distributed Holochain consensus or authorization; this is a required CI demonstration **not yet executed successfully**.

### Observed failures from integrated run 43527503883

The real SBPF compiled and RAVE Rust passed, but SOL lifecycle's sixth concurrent-wallet/authority subtest failed on-chain with `InstructionError Custom 6004` (`MintFreezable`), after five lifecycle subtests passed. This is an **UNRESOLVED SOL SOURCE ISSUE**, reported to PR #35. Separately the SEC forged-message fixture changed the instruction-count byte and caused a codec parse error, not an Ed25519 rejection. The integration-only correction changes the last blockhash byte and retains the stronger Ed25519 assertion, reported to PR #33. Historical run logs are retained. No latest-head green or conductor/economic authority.

**Error-code correction:** the source `BridgeError` enum maps `6004` to `MintFreezable` (while `AlreadyRefunded` is `6007`). The integrated failure was an on-chain `6004`; the emitting program and intended call must be reconstructed from validator transaction logs by SOL owner. The prior misclassification was corrected in PR #35 follow-up comment.
