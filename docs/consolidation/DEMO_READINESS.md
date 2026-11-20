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
| Observer | Finalized four-account snapshot, receipt/PDA, Ed25519 signed-wire verification, exact u64 arithmetic, durable ledger, indexer, replay/corruption refusals | COMPLETED · TESTED (156 unit + cross-lane + real signed-wire replay) · REVIEW PENDING |
| Observer | Kit v2 reviewed witness: nested economic denials, replay guard, UTF-8 bounds | COMPLETED · TESTED · REVIEW PENDING (v2 ABI is a *candidate*, not frozen) |
| Observer | Durable returned-ActionHash pin / terminal HOLD on the delivery path | **NOT IMPLEMENTED** in the consolidated outbox (#48 fix not ported). Must land before any transport activation |
| Observer → Holochain | v2 transport (deliver observations to a DNA) | **BLOCKED** (`deliveryAuthorized:false`; ABI unratified) |
| Holochain | RAVE shadow reviewer: quarantine-only, four literal denials | COMPLETED · TESTED |
| Holochain | Native HAM adapter + integrity/coordinator WASM, locked (`--locked`, Rust 1.95, Holonix `a6cdfbd`) | COMPLETED · TESTED **iff** the same-run job is green at this SHA (TEST_RESULTS.md) |
| Holochain | Source-bound DNA / hApp packaging (properties from the **same** Solana run) and artifact hashing | COMPLETED · TESTED under the same condition |
| Holochain | DNA installation, cell genesis, keystore provisioning, capability grants, signed audit write, read-back | **BLOCKED**: steps are `if: ${{ false }}`; no authorized request |
| Authorization | Canonical installation request, Ed25519 grant verification, one-use broker redemption, identity checks | COMPLETED · TESTED (34 synthetic-key refusal tests) · not exercised with any real authority |
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

## 4. Urgent: original #66 artifacts expire 2026-11-28

The historical installation request (`demo/installation/evidence/installation-request.prepared.json`) and `baseline.json` bind the ORIGINAL artifacts of #66 run 43648980986 at `03b567a`:

| Artifact | ID | ZIP SHA-256 | Expires (UTC) |
|---|---|---|---|
| `a0-same-run-source-bound-own-dna-03b567a…` (DNA, hApp, WASMs, native HAM) | 14136370324 | `5b28358b65c18eceda3f7162dae20d60c2c9f55b83f4dcbed7561d257a0c9f06` | **2026-11-28 22:58:31** |
| `integration-localnet-evidence-NO-KEYS` | 14135563715 | `3868dec9c708a656e5d127e902836b9170a81bc5c87fd13a51076182bdcef35b` | 2026-11-28 22:51:00 |
| `integration-cross-lane-js` | 14135966104 | `736e21680925f046c45e269d512585f6192b258db9b2e241827fbaf33238e438` | 2026-11-28 22:51:40 |
| `integration-rave-rust` | 14135311169 | `ab32fdd27e4f997af43cec308fd71042980fe2bf651f6f51980f4fbbf38337b0` | 2026-11-28 22:37:19 |

Expiry dates were read from the GitHub API on 2026-11-20.

After expiry, `installation-preparation.yml` (`scripts/installation/fetch-originals.py`) can no longer fetch the originals and will **fail closed**. The historical request will then no longer be independently re-verifiable from GitHub.

**Maintainer action before 2026-11-28 22:37 UTC:**

1. Download the four ZIPs.
2. Verify the SHA-256 values above.
3. Store them unmodified in operator-controlled, versioned/WORM storage, recording URI, version ID and retention, as SOL already did for PR55.

Rebuilding is **not** a substitute: a rebuild is a different execution with different bytes.

## 5. Consolidation and the historical authorization request

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

## 6. Preconditions to leave BLOCKED (none satisfiable by this PR)

1. A separately operated trusted authority, holding a key the implementation authors do not control, signs a grant for one exact request (host fingerprint, executor, tools, DNA, arguments).
2. A distinct SEC reviewer approves the exact tuple: source, binaries, app/DNA/CellId, role, signer, function, ABI.
3. The v2 ABI is ratified by OBS + RAVE + SEC, and the #48 durable-ActionHash fix is ported.
4. The historical sandbox install in A4 run 43647150236 (#44) receives SEC review.
5. Deployment-epoch identity and produced-slot history HOLDs are resolved, or explicitly accepted for an audit-only demo by SEC.
6. For anything economic: Gate C, which stays NO-GO and is out of scope.
