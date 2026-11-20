# Demo readiness

Two different questions, kept apart deliberately:

1. **Build readiness.** Does the consolidated source compile, package and pass its fail-closed tests at its own SHA?
2. **Authorized runtime demonstration readiness.** May anyone install the audit DNA and perform a signed audit write?

**(1) is answered by CI at the consolidation SHA (see TEST_RESULTS.md). (2) is BLOCKED.** A green build grants no authority. Neither does a test-generated signature or anything in this repository.

## 1. Status vocabulary

| Status | Meaning |
|---|---|
| COMPLETED | Implemented in the consolidated tree |
| TESTED | Exercised by a test that ran **at the consolidation SHA** (TEST_RESULTS.md) |
| REVIEW PENDING | Implemented and tested, but the independent review required by AGENTS.md / SECURITY_GATES.md is absent |
| AUTHORIZED | An independent, distinct authority approved the exact operation. **Nothing in this project is AUTHORIZED** |
| BLOCKED | Deliberately prevented until named preconditions are met |
| NOT IMPLEMENTED | Does not exist |

## 2. Capability matrix

| Stage | Capability | Status |
|---|---|---|
| Solana | Anchor 1.2.2 deposit/refund program: classic SPL, one mint, config/vault/receipt PDAs | COMPLETED · TESTED (host + SBF compile; 4 isolated real-validator modes) · REVIEW PENDING |
| Solana | Deposit, refund, duplicate/replay, malformed-account, authority/PDA-substitution and attribution negatives pinned to exact program errors | COMPLETED · TESTED (`tests/solana/integration.test.mjs` under `localnet-build.sh`) · REVIEW PENDING |
| Solana | Original signed PR55 evidence (exact ZIP) re-verified offline | COMPLETED · TESTED (`preserved-original-evidence`) |
| Solana | Deployment-epoch identity; complete produced-slot history | **BLOCKED / HOLD** (SOL #63/#64 reviews) |
| Observer | Finalized four-account snapshot, receipt/PDA, Ed25519 signed-wire verification, exact u64 arithmetic, durable ledger, indexer, replay/corruption refusals | COMPLETED · TESTED (164 unit + cross-lane + real signed-wire replay) · REVIEW PENDING |
| Observer | Kit v2 reviewed witness: nested economic denials, replay guard, UTF-8 bounds | COMPLETED · TESTED · REVIEW PENDING (v2 ABI is a *candidate*, not frozen) |
| Observer | Durable returned-ActionHash pin / terminal HOLD on the delivery path; path-scoped `uiTokenAmount.uiAmount` rules | COMPLETED · TESTED (ported from #48 in `98db651`; 8 new adversarial tests + test 18 strengthened; blob-pinned as **integration-only** provenance) · **REVIEW PENDING (OBS + SEC)**. Transport stays refused |
| Observer → Holochain | v2 transport (deliver observations to a DNA) | **BLOCKED** (`deliveryAuthorized:false`; ABI unratified) |
| Holochain | RAVE shadow reviewer: quarantine-only, four literal denials | COMPLETED · TESTED |
| Holochain | Native HAM adapter + integrity/coordinator WASM, locked (`--locked`, Rust 1.95, Holonix `a6cdfbd`) | COMPLETED · TESTED (same-run run 44714083624 at `8bf0d74`; digests in TEST_RESULTS.md) |
| Holochain | Source-bound DNA / hApp packaging (properties from the **same** Solana run) and artifact hashing | COMPLETED · TESTED (DNA `uhC0khasELjjRHDaRK7qAXjSCPbOvPbb8rjDfgH7qg_J5E5IyUFWS` at `8bf0d74`; install skipped) |
| Holochain | DNA installation, cell genesis, keystore provisioning, capability grants, signed audit write, read-back | **BLOCKED**: steps are `if: ${{ false }}`; no authorized request |
| Authorization | Canonical installation request, Ed25519 grant verification, one-use broker redemption, identity checks | COMPLETED · TESTED (34 synthetic-key refusal tests) · not exercised with any real authority |
| CI supply chain | Shared-CI Agave 4.1.2 installed from a SHA-256-pinned archive (no remote installer script) | COMPLETED (`8b22ac4`) · TESTED in Sprint 0 CI at the PR head (see TEST_RESULTS.md) |
| CI authorization | `rave-unyt-release.yml` conductor install probe: dispatch removed, job `if: ${{ false }}`; repository-wide static gate on install/genesis/mutating-zome steps | COMPLETED (`b6b0711`) · TESTED (`workflow-install-gates.test.mjs`, negative control on pre-lock file) · REVIEW PENDING (RAVE + SEC) |
| Economics | Holochain credit, settlement, withdrawals, redemption, mainnet assets | **NOT IMPLEMENTED and BLOCKED** (`evidence-gate.mjs` throws; Gate C NO-GO) |

The invariants hold across every stage listed above:

```
creditEligible: false · independentConsensusVerified: false · spendableBaseUnits: "0" · withdrawalAuthorized: false
```

A finalized RPC observation is **not** independent economic consensus. A Holochain write, if one were ever authorized, would **not** prove settled Solana collateral.

## 3. What a demonstration can honestly show today

All of it is non-mutating:

1. A real disposable local-validator lifecycle: deposit, refund, every pinned negative.
2. Genuine signed transactions and finalized snapshots replayed through the Observer, ending in a durable **pending** v2 queue with explicit NO-ACK.
3. Same-run compilation of the native HAM and both WASMs, then packaging of a DNA/hApp whose properties are bound to *that* run's Solana evidence, with hashes.
4. The A0 gate refusing with five named blockers.
5. The installation pipeline preparing (not approving) an exact request and refusing synthetic forged, replayed or mismatched grants.

**It stops at the mutation boundary.** "Install the DNA and record an audit observation" is **BLOCKED** and must be presented as such.

## 4. Seven-stage status (A0/A1 report vocabulary)

This uses the same stage names as `demo/a0-preauthorization-runner.mjs` and `demo/a0-report-installed-readonly.mjs`. The state given is the most advanced state any CI run **at a consolidation SHA** has actually produced. Nothing is inferred from static tests.

| # | Stage | State at the consolidation | Evidence / blocker |
|---|---|---|---|
| 1 | `source_verified` | **EXECUTED** (`EXECUTED_SAME_SHA_ORIGINAL_SIGNED_SOURCE_KIT`) | same-run integration snapshot: real disposable validator, signed source kit at the PR SHA |
| 2 | `observer_evidence_admitted` | **EXECUTED** (`EXECUTED_KIT_V2_DURABLE_PENDING_NO_ACK`) | Kit v2 reviewed witness → durable **pending** queue, explicit NO-ACK |
| 3 | `holochain_runtime_installed` | **NOT EXECUTED (BLOCKED)**. Build and packaging are executed; install is `if: ${{ false }}` | DNA/hApp built and hashed at the same run; installation requires an independent exact-call authorization that does not exist |
| 4 | `exact_call_approved` | **BLOCKED** (`BLOCKED_PENDING_INDEPENDENT_EXACT_TUPLE_APPROVAL`) | no independent SEC reviewer or trusted authority key |
| 5 | `signed_audit_action_executed` | **NOT EXECUTED** (`NOT_EXECUTED_APPROVAL_ABSENT`) | no Lair provisioning, signing or zome write; no ActionHash exists |
| 6 | `typed_readback_verified` | **NOT EXECUTED** | depends on 5 |
| 7 | `restart_replay_verified` | **NOT EXECUTED** at runtime | the outbox restart/HOLD logic is unit-tested only (164 OBS tests) |

The A0 gate (`a0-own-dna-runtime.yml`) is **expected to fail** with `BLOCKED_NOT_ACCEPTED` (exit 3, five blockers). That refusal is the correct result and must not be "fixed" to get green CI.

**Milestone reached by this PR:** original evidence **verified and restore-tested**, with the **durable copy blocked on owner action** (§5), and the consolidation **ready for independent review**. This is **not** "installation authorized", **not** "economic bridge ready" and **not** "demo ready".

## 5. Original #66 artifacts: preservation status (expire 2026-11-28)

The historical installation request (`demo/installation/evidence/installation-request.prepared.json`) and `baseline.json` bind the ORIGINAL artifacts of #66 run 43648980986 at `03b567a992bcd31930b49d08f594a4ef7ff58680`:

| Artifact | ID | Bytes | ZIP SHA-256 | Expires (UTC) |
|---|---|---|---|---|
| `a0-same-run-source-bound-own-dna-03b567a…` (DNA, hApp, WASMs, native HAM) | 14136370324 | 7,871,538 | `5b28358b65c18eceda3f7162dae20d60c2c9f55b83f4dcbed7561d257a0c9f06` | **2026-11-28 22:58:31** |
| `integration-localnet-evidence-NO-KEYS` | 14135563715 | 1,003,860 | `3868dec9c708a656e5d127e902836b9170a81bc5c87fd13a51076182bdcef35b` | 2026-11-28 22:51:00 |
| `integration-cross-lane-js` | 14135966104 | 133,821 | `736e21680925f046c45e269d512585f6192b258db9b2e241827fbaf33238e438` | 2026-11-28 22:51:40 |
| `integration-rave-rust` | 14135311169 | 13,164 | `ab32fdd27e4f997af43cec308fd71042980fe2bf651f6f51980f4fbbf38337b0` | 2026-11-28 22:37:19 |

| Preservation step | Status |
|---|---|
| Independent authenticated download; size, SHA-256, CRC and entry count | **DONE 4/4**, locally 2026-11-20 15:57 UTC and in CI ([run 44769530794](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/44769530794)) |
| Restore → **unchanged** `verify-originals.mjs` → inventory equals the committed `original-build-inventory.json` | **DONE**, both locally (19/19 fields) and in CI |
| Interim copy | Actions artifact 14647505072 (`sha256:fcabb33d…5729f47`, 9,031,141 bytes; expires 2027-02-18). **Not durable**: same retention class and access as the originals |
| **Durable, access-controlled copy** | **BLOCKED: owner action required.** The repository is public, and no owner-authorized private storage was available. See `demo/installation/preservation/README.md` |

**The evidence must not be described as durably preserved** until an owner records a durable location and passes the round-trip `verify` and restore test from that location.

Rebuilding is **not** a substitute: a rebuild is a different execution with different bytes.

## 6. Consolidation and the historical authorization request

**Bound inputs, unchanged by consolidation:**

| Bound input | Historical request | Consolidation |
|---|---|---|
| Baseline source / DNA | `03b567a` / `uhC0kCn-ld2PREMKI6nDVq4XssTKHgs8QHOszCC3a32pXCZjowgXt` | unchanged; not rebuilt |
| `scripts/installation/execute-approved.mjs` | SHA-256 `a14d334f…` | **identical bytes** |
| `demo/installation/authorization.mjs` | SHA-256 `37e22cf9…` | **identical bytes** |
| Executor source commit | `8ecbee6818b6b1aba355bf8bcbbefd3fd68666f8` | consolidation is a **different** commit |

The committed request is **preserved byte-for-byte** and remains `CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED`: unapproved, `hostFingerprint:null`.

`installation-preparation.yml` regenerates a request at every PR head with `executorSourceCommit = <that head>`. The run at the consolidation SHA therefore emits a **separate, new, UNAPPROVED candidate**, uploaded as an Actions artifact only and never committed. It names the same historical DNA but a different executor commit. It must be reviewed independently as its own exact request if anyone ever wants to use it.

**No signed grant may be reused between the historical request, that candidate, or any request for the consolidation's own (different) same-run DNA.**

## 7. Preconditions to leave BLOCKED (none satisfiable by this PR)

1. A separately operated trusted authority, holding a key the implementation authors do not control, signs a grant for one exact request (host fingerprint, executor, tools, DNA, arguments).
2. A distinct SEC reviewer approves the exact tuple: source, binaries, app/DNA/CellId, role, signer, function, ABI.
3. The v2 ABI is ratified by OBS + RAVE + SEC, and the #48 durable-ActionHash port (`98db651`, integration-only provenance) is reviewed by OBS + SEC.
4. The historical sandbox install in A4 run 43647150236 (#44) receives SEC review.
5. Deployment-epoch identity and produced-slot history HOLDs are resolved, or explicitly accepted for an audit-only demo by SEC.
6. For anything economic: Gate C, which stays NO-GO and is out of scope.
7. The original #66 archives are durably preserved by the owner (§5) **before 2026-11-28 22:37 UTC**. Otherwise the historical request cannot be re-verified after that date.
