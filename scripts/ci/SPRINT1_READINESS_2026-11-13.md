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

# Sprint 0/Sprint 1 — CI source lock and integration readiness (13 November 2026)

**Gate: P0 RED — DRAFT ONLY.** No main merge, no Holochain credit, no economically authoritative withdrawal, no public-network deployment. This is a report of **actual Actions execution**, not a claim that the new CI source commit has passed. Frozen snapshot remains `24b60e72ac78afbab5562c605094c3146bddd653` until the specialist owners supply corrected, independently tested commits. Do not overwrite the old manifest with untested source SHAs.

## Immutable failing snapshot (PR #37)

| Lane | Source SHA in snapshot | Newer lane head inspected on 13 Nov | State |
| --- | --- | --- | --- |
| CI #32 | `70161c6b5fda0fddb4efb44485385e9358886d19` | `ff7c892a3d6ad276196de1e44cf4cb3ecca6b799` | New 16th required suite; not integrated/tested yet |
| SOL #35 | `3d48f9335a23344d3a24625d2c6b9a8ead116751` | `2a547acaaaf61fbed5e15baa2a084fc3ac16960c` | Still imports unavailable web3 CommonJS named export |
| OBS #36 | `60137aedc878eaf5428362a9a83cb44467a19736` | `8306fb11a06b31f673f31d53eda92ab33ce7196c` | SDK signature/test variable source fixes present; no current-head passing CI evidence |
| RAVE #34 | `df8753b4e108b596c5b6cf40354e29e33d083139` | `b8881bd436b3068faf2b37d4b39133e259d2a153` | Same failing published-crate large-decimal test source |
| SEC #33 | `aaa590dcfa93e7cc10f14c2607b601cb402db5a5` | `aaa590dcfa93e7cc10f14c2607b601cb402db5a5` | Offline adversarial suite green at frozen SHA; no economic signoff |

Snapshot [required shared CI run 43510726021](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43510726021) and [validator/RAVE integration run 43510726154](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43510726154) each checked out **exact PR head SHA** `24b60e72...` in all jobs. This is one logical source checkout per job, not divergent merged PR refs. Source locks were Git tracked with approved digests and used in dependency installation. Real host Rust/Anchor/SBPF build, local validator RPC smoke, dependency-provenance and secret guard steps **passed**.

## Executed test counts, failures and skips

The **15-suite cross-lane offline runner** (job 132185410993, failed) produced:

| Suite | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| OBS account verification | 15 | 0 | 0 |
| OBS generated IDL contract | 5 | 0 | 0 |
| OBS signed-wire transaction verification | 0 | **7** | 0 |
| OBS finalized indexer | 9 | 0 | 0 |
| OBS durable ledger | 6 | 0 | 0 |
| OBS localnet account fixtures | 3 | 0 | 0 |
| SOL layout/IDL | 7 | 0 | 0 |
| SEC adversarial | 19 | 0 | 0 |
| SEC solvency reference model | 7 | 0 | 0 |
| SEC Sprint 1 economic attacks | 6 | 0 | 0 |
| RAVE shadow review | 12 | 0 | 0 |
| RAVE shadow CLI | 2 | 0 | 0 |
| RAVE economic attack model | 5 | 0 | 0 |
| RAVE test-only adapter | 6 | 0 | 0 |
| RAVE transaction shadow | 8 | 0 | 0 |
| **Total** | **110** | **7** | **0** |

OBS standalone `npm test` job 132179960441 separately reported **38/45 pass, 7 fail, 0 skip**, with the *same seven* signed-wire failures (not 7 additional distinct defects). Six tests failed on `missing signed transaction signatures`, because Kit 8.6 decoded address-keyed signature objects, not `Map`; the seventh exposed `ReferenceError: signature is not defined` in a negative test. OBS current-head changes are **unverified**.

RAVE published-crate Rust job 132179959342: `cargo test --locked --all-targets`, **7/8 pass, 1 fail**, no ignored tests, compiled against verified published `rave_engine 0.15.0`. Failing `sprint1_published_crate_adversarial::exact_reserve_over_javascript_safe_integer_limit` at `src/lib.rs:98` expects `ReserveUnits.accepts(UnitMap::try_from(json!({ "1":"-9007199254740993", "0":"9007199254740993" })))` true; distinguish published crate numeric limits from a faulty fixture without weakening conservation safety.

SOL localnet job 132179958788: generated genuine SBPF and IDL, then layout tests **7/7 pass**, zero skips, but its *first enhanced transaction scenario* aborted on `SyntaxError: Named export 'BPF_LOADER_UPGRADEABLE_PROGRAM_ID' not found` from `@solana/web3.js` CommonJS. **The three real scenario lifecycles, successful finalized deposit/refund and retained-ledger restart in this snapshot are NOT passing and cannot be counted as run.** Prior older-source passing localnet results do not count for this source.

New CI commit `ff7c892...` expands integrated offline matrix from **15 to 16** to require `tests/holochain/transaction-provenance-journal.test.mjs` from newer RAVE #34. That new case is **not part of the frozen 117 tests**, and the CI-only branch does not contain the source-owned test file; it becomes mandatory on next integration snapshot. The runner already fails on missing declared files, any `node:test` skip/todo/cancel, test zero, or nonzero exit in integrated mode.

## Binary and IDL provenance from this exact frozen source

Two disposable program IDs/builds produced **different legitimate hashes**; never substitute historical or different-program hashes:

| Run / job | Generated IDL SHA256 | Compiled SBPF `.so` SHA256 | Evidence artifact |
| --- | --- | --- | --- |
| 43510726021 / 132179958790 (compile, SUCCESS) | `7b3a63c3deabdb47603e105977243280f70ac602152928583c6891a8188494e4` | `842320f90d9d85227f4c51166b2bc7c1a83800464437667cb75341ddfe33f295` | `14079186496` |
| 43510726154 / 132179958788 (localnet build, lifecycle FAILED) | `6e816e7c4ce20463041b36c4985e7c33208b38e0b1fe0b9d5ea38b428f0fcd6c` | `bb6d9afee5650f5eab5c2053d9375b212cbd131a550f73b1a5bc9779e6df90f2` | `14079505827` |

The localnet build used public-only program ID `2vcjptr3iRECmdZCXMHFbU3smqUegxub1GkUf9zXVxLQ`. Log-verified IDL address matched the ephemeral program ID / synchronized Rust declaration and Anchor.toml. This establishes real build outputs, **not** deployed DNA equivalence, localnet lifecycle passing, or byte-identical rebuilds.

## Committed dependency graphs, in the frozen integrated manifest

| Lock input | SHA256 |
| --- | --- |
| `Cargo.lock` | `9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24f0a24f5` |
| `observer/package-lock.json` | `87578ffa1a3f0d1f0102f58ac649e25cd2a9d2902889bc946213fb2f136f0f62` |
| `tests/solana/package-lock.json` | `24ad69597db242528c87a98d8bc2299574e09eb52e77e026281db01e1c9889c6` |
| `tests/holochain/rave-engine/Cargo.lock` | `e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001` |

The frozen integration contains all four tracked locks and `npm ci` / `cargo test --locked` execution; **SOL source PR #35 still does not own its npm lock**, so ownership/review remains a merge block. The registry checksum for published `rave_engine=0.15.0` is `7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde`. Host pins: Node 22.16.0, Rust 1.95.0, Anchor CLI/program 1.2.2, Solana CLI 4.1.2, SBPF platform-tools v1.57, arch v3. No reproducible byte-for-byte binary claim because disposable ID changes source.

## Next owner handoffs / re-freeze gate

1. **SOL #35:** repair SDK named export without dropping upgrade-authority validation; source-own and use committed npm lock; prove actual validator execution across lifecycle/init-capture/u64-max/two-process restart, including adversarial on-chain failures; archive public-only raw finalized base64 `getTransaction`, full containing `getBlock`, token balances/inner CPI meta, signatures, genesis and exact build hashes.
2. **OBS #36:** send corrected head SHA + actual `npm ci && npm run check && npm test` green dependency-backed logs; validate signature/v1/ALT, ledger/backfill/restart; ingest SOL's genuine finalized witnesses; never elevate untrusted provider claims.
3. **RAVE #34:** resolve real published `ReserveUnits` boundary as an executable and documented Rust test, with source SHA and `cargo test --locked` green; retain non-economic shadow-only journal.
4. **SEC #33:** independently review new SOL bootstrap/custody and cross-epoch replay assumptions, signed transaction provenance and durable ledger integrity. No authorization gate self-approval.
5. **CI #32/#37:** after tested specialist commits exist, create *new* atomic integration snapshot with actual source blob overlay, update `ci-integration-snapshot.json` to their immutable SHAs, retain provenance exceptions, and run the **entire 16-suite offline gate + standalone OBS + genuine SOL and RAVE jobs + independent Security/shadow test jobs** on that same new HEAD. Reject skips or missing artifacts; preserve both workflow runs, tool logs, public signature/block fixtures, generated IDL and .so SHA256. Only then request human/security review.

**Disposable-token automated pipeline after this gate:** local validator deposit of a classic SPL token → observe a successful *finalized signed transaction and containing block* → verify canonical PDA + four-account receipt state → commit durable OBS receipt/occurrence with checkpoint → pass non-economic `solana-deposit-evidence-v1` into quarantine-only Holochain shadow journal → on-chain refund → reconcile immutable receipt and shadow-only tombstone → kill/restart both indexer and validator with persistent test ledger → replay backfill and assert exactly one receipt and occurrence, zero credit grants, zero payout authorizations, and no duplicate processing. Include disagreement, failed deposit, replaced/absent block, v0 ALT inconsistency, refund race and corrupt ledger as negative assertions. **This is an acceptance target, not an implemented passing end-to-end pipeline.**

Even when all technical tests are green, refundable prototype collateral and first-initializer admin capture are independent **P0 economic gates**; economic issuance and withdrawal restrictions remain enabled.


## Integration refresh handoff — 13 Nov 2026

Both reviewed skill directories were copied as Git tree from main `e1651fec` (`solana-dev` 2.8.0, `holochain` 1.0.0-rc.2). Skills are reference guidance only, not authorization to upgrade Rust/Anchor/Solana/Holochain toolchains. Source CI now declares 23 independent cross-lane offline suites (including SEC checkpoint, SEC numeric ingress, SOL signer/SDK tests). On this **CI-only** branch specialist paths may be unavailable: the required full no-skip matrix is evaluated on the integrated PR #37, whose manifest pins all four specialist heads. The integration CI also captures signed base64 `getTransaction` and complete base64 `getBlock` from the actual disposable validator and exercises OBS replay; both required full GitHub Actions workflows must pass **on the exact integrated commit** before any green claim. Current execution pending. Conductor provenance and live Unyt tests remain blocked. No mint/withdrawal authorization or main merge.


Source CI now requires **24** offline suites on combined checkout: SEC ledger corruption was added after the 23-suite checkpoint. Shared CI and integration PR #37 must verify the exact merged source SHA; no locally assumed green status. The integrated OBS signer-regression test currently rejects missing signatures correctly but uses an overly narrow expected error text (reported to OBS PR #36).
