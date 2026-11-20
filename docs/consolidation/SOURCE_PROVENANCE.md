# Source provenance and source-of-truth table

Consolidation branch: `claude/holochain-solana-consolidation-3l2lqm` (PR #68). It was branched from `main` at `e1651fec77f1ed5c5f8e760e486c8757adc5e69c`.

The branch name follows the session-mandated `claude/…` convention instead of the suggested `integration/mainline-consolidation-2026-11-20` and the AGENTS.md `agent/<lane>/…` form. No other branch was modified.

## How provenance is established

1. **Git ancestry.** Every adopted specialist head was integrated with a real `git merge`, so `git merge-base --is-ancestor <head> <consolidation>` holds for 37 of the 39 pre-existing branch heads (BRANCH_INVENTORY.md). Original commits, authors and timestamps are unchanged. Nothing was rebased, squashed or force-pushed.
2. **Blob pinning.** `ci-integration-snapshot.json › fileProvenance` pins **168** paths to `{lane, sha (Git blob), sourceCommit}`. The re-pin commit `58c42d9` asserted, for every new or changed entry, that `git rev-parse HEAD:<path> == git rev-parse <sourceCommit>:<path>`. It also re-asserted every pre-existing pin against HEAD. CI enforces the pins with `scripts/ci/verify-integration-provenance.mjs`; locally that prints `PASS: 168 committed source-owned Git blobs …`.
3. **Byte digests.** The four reviewed lockfiles keep their recorded SHA-256 values (`reviewedLockSHA256`, unchanged). The preserved original PR55 ZIP is checked by size and SHA-256 in CI.
4. **Historical evidence is not inherited.** `consolidation.historicalEvidenceInherited: false`. The #66 and #67 runs prove what they proved at `03b567a` and `d0409a1` only. TEST_RESULTS.md lists runs at the consolidation SHA separately.

The integration lineage (#32 → #67) **copied** specialist blobs instead of merging branches. Ancestry therefore under-reports what #67 already contained. Each specialist tip was compared with #67 by a three-way classification against `merge-base(#67, tip)`: TIP-ONLY, TARGET-NEWER or BOTH-CHANGED, plus whether the tip's blob ever appeared in #67's history. The results are summarised in INTEGRATION_REPORT.md §2.

## Source of truth per subsystem

Blob = Git blob (short). SHA-256 = first 16 hex chars of the file bytes. Lane owners follow AGENTS.md. "SEC review" means an independent reviewer distinct from the implementation author; none has approved anything on GitHub (PR_INVENTORY.md).

| # | Subsystem | Paths (key files) | Authoritative source | Key blobs / digests | Tests that exercise it | Owner | Review requirement | Decision |
|---|---|---|---|---|---|---|---|---|
| 1 | Solana program | `programs/deposit_prototype/src/lib.rs`, `programs/deposit_prototype/Cargo.toml`, `Anchor.toml`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml` | SOL #55 `c071e4c98e7b2dd04a18374f3792c0a90ce4b284` (via #64 merge `b8b5a83`) | lib.rs `7d63ee0a`; Cargo.lock `a1b06220` / SHA-256 `9700366dc3e0219e…` (reviewed lock, unchanged) | `ci.yml` anchor-compile (host + SBF); integration-snapshot solana-lifecycle (4 isolated validator modes) | SOL | SEC: economic changes need independent review. SEC-38-3/4 remediation landed in #50/#55; no APPROVE exists | **Adopt unchanged.** Byte-identical to #67 and #66 |
| 2 | Solana validator tests and witness tooling | `tests/solana/**` (integration.test, localnet-build.sh, verify-witness-*, demo-scope, confirmation-recovery, restart-*) | SOL #55 `c071e4c` | integration.test `4c577329`; localnet-build.sh `ed89ba37`; package-lock SHA-256 `24ad69597db24252…` | localnet-build.sh (anchor test × 4 modes, witness + tamper verifiers, restart); `npm --prefix tests/solana test`; cross-lane sol-* suites | SOL | SEC | **Adopt unchanged.** Two previously unexecuted unit suites are now registered |
| 3 | Original signed Solana evidence | `security/evidence/solana-pr55-original-43604140724/artifact-14118166967-original.zip`, `tests/solana/verify-pr55-original-zip.py`, two review docs | SOL #64 `768f463a…` (ZIP), SOL #63 `02a89b79…` (verifier) | ZIP blob `eb7de4dd`, **968887 bytes, SHA-256 `33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018`** (original GitHub artifact 14118166967 from run 43604140724) | `ci.yml` preserved-original-evidence (size + digest + offline Ed25519 verifier) | SOL | SEC; deployment-epoch identity remains **HOLD** | **Adopt; bytes preserved unmodified** |
| 4 | Produced-slot archive producer (research) | `tests/solana/produce-history-archive{,.test}.mjs`, handoff doc | SOL #47 `9d62b8ee…` | producer blob per manifest | cross-lane `sol-archive-producer-mock-rpc` (4) | SOL→OBS | none (research tooling) | **Adopt as HISTORICAL_RESEARCH tooling** |
| 5 | Observer core (finalized snapshot, PDA, signed tx, ledger, indexer, history, refund) | `observer/src/{verify,decode,pda,transaction,ledger,indexer,history,refund,cli,producer-history-input}.mjs` | OBS #52 `a2338f96…` blobs (as adopted by #67) | verify `70ad8499`; decode `9c8e950e`; pda `c01cf542`; transaction `6dba578c`; ledger `0ecac7ad`; indexer `57dc6704`; package-lock SHA-256 `87578ffa1a3f0d1f…` | `npm --prefix observer test` (156); cross-lane observer-* suites; integration-snapshot real signed-wire replay + four-account snapshot replay | OBS | SEC (idempotency, replay, U64) | **Adopt unchanged** |
| 6 | Observer audit outbox and v2 witness / ABI review | `observer/src/{demo-outbox,demo-witness-v2,v2-binding-review}.mjs`, related tests and docs | demo-outbox: OBS #57 `38847cf1…`; demo-witness-v2 and v2-binding-review: **OBS #62 `e70a178a…`** | demo-outbox `fa80ac60`; demo-witness-v2 `0678d614` (was `228754b3` in #67); v2-binding-review `711cb7b1` (was `9cdf0c7e`) | demo-outbox.test (incl. #59 tests 44/45), v2-binding-review.test, replay-guard-boundary.test; integration-snapshot Kit v2 pending queue (NO-ACK) | OBS | SEC + A4 ratification of the typed v2 ABI (not frozen) | **Adopt #62** (new versus #67). #48's later outbox fixes deferred (INTEGRATION_REPORT §4) |
| 7 | Holochain evidence interlock | `holochain/evidence-gate.mjs` | `main` (unchanged since `4da2eee`) | blob `ffd7a081` (identical to main) | s0-shadow-handoff (CI), economic-attack-model | RAVE | **Maintainer only** (AGENTS.md rule 1) | **Unchanged**: `issueHolochainCredit` and `authorizeSolanaWithdrawal` always throw |
| 8 | RAVE shadow reviewer (JS) | `holochain/{shadow-review,transaction-shadow,test-only-adapter,shadow-cli}.mjs`, `tests/holochain/*.test.mjs`, `tests/holochain/sandbox/*` | RAVE #65 `7ccee3db…` (content first authored on #34 `e34e0f87…`) | shadow-review `cd588e4f` (was `824fd35` in #67); transaction-shadow `05b9c762`; test-only-adapter `1ffca1a8` | cross-lane rave-* suites (6 + 2 new); integration-snapshot real-snapshot shadow handoff | RAVE | SEC | **Adopt RAVE lane version** (#67 carried older 13-Nov copies) |
| 9 | Audit DNA source (integrity + coordinator), manifests, native HAM adapter | `holochain/demo/{integrity,coordinator,ham-adapter}/**`, `dna.yaml`, `happ.yaml`, `Cargo.lock`, `ham-adapter/Cargo.lock`, `build.sh`, `verify-native-lock.py` | coordinator and build.sh: RAVE #65 `f34fc175` / `7ccee3db`; locks: #44 `c6b60ac3`; manifests: integration adoption `c7964607` (per manifest) | integrity `44d1c6b7`; coordinator `3feb1b85`; Cargo.lock `caf6a2e7` / SHA-256 `c5774a18ba821005…`; HAM lock `6a2ef82e` / SHA-256 `08347c32d9f0fd5c…`; build.sh `ed46c5e2`; dna.yaml template `24c3807b` | integration-snapshot same-run job: locked native HAM + integrity/coordinator WASM + `hc dna/app pack`; a0-dependency-bootstrap | RAVE | SEC + A4 (lock review); no install authorization | **Adopt #65/#67 versions.** #44's coordinator variant and RAVE's hard-coded `dna.yaml` not adopted |
| 10 | Same-run integration pipeline | `.github/workflows/integration-snapshot.yml`, `scripts/ci/**`, `demo/a0-*.mjs`, `demo/observation-contract.mjs`, `tests/integration/**`, `ci-integration-snapshot.json` | CI #66 `03b567a9…` / #67 `d0409a1d…`, plus consolidation trigger retarget `3501e84` and re-pin `58c42d9` | integration-snapshot.yml `d30257cc`; a0-bind-same-run-dna `9479abbd`; verify-integration-provenance `ffb9c14f` | integration-snapshot (4 jobs) | CI | SEC for verification semantics (unchanged) | **Adopt**; triggers now include `main` |
| 11 | Installation authorization preparation | `demo/installation/**`, `scripts/installation/**`, `.github/workflows/installation-preparation.yml` | CI #67 `d0409a1d…` | authorization.mjs SHA-256 `37e22cf95097d7b3…`; execute-approved.mjs SHA-256 `a14d334fc8a4ab49…` (both equal the values bound in the historical request) | installation-preparation (34 synthetic-key refusal tests + original-artifact verification) | CI | Independent operator **and** distinct SEC approver for any real request | **Adopt unchanged**; historical request preserved byte-for-byte |
| 12 | Security tests, threat model, independent evidence | `security/**`, `docs/SECURITY_GATES.md` | SEC #33 `53bc4110…`; SEC #53 `da98cc24…` (2 fixtures); integration-only `f16e4613` | replay-ledger-adversarial `945afbeb`; ledger-corruption-boundary `2d48b411`; transaction-provenance-adversarial `f16e4613` (integration fix kept) | cross-lane security-* (11 + 1 new) | SEC | SEC cannot self-approve economic changes | **Adopt #33 + #53**; one integration-only patch retained |
| 13 | Shared CI | `.github/workflows/ci.yml`, `scripts/ci/{guard,record,toolchain.env,…}` | CI #32 lineage via #67, plus consolidation job `preserved-original-evidence` | ci.yml `0aec34e6` | ci.yml (7 jobs) | CI | — | **Adopt + one read-only job** |
| 14 | Reference skills | `.github/skills/**` | `main` `e1651fec` | tree byte-identical on main and #67 | — | — | — | **Unchanged** |

## Adopted specialist commits (all are ancestors of the consolidation)

| Lane | PR | Head commit | Merge commit on this branch |
|---|---|---|---|
| CI | #67 (contains #32, #37, #39, #41, #45, #46, #49, #51, #54, #56, #58, #61, #66) | `d0409a1d85bc377139285c39f9303f3b97470b29` | `c06886a` |
| OBS | #62 (contains #52, #57, #59) | `e70a178a927e74326abfff6732bf49e66df4f447` | `b904c88` |
| SEC | #53 | `da98cc24f6bda74c4282175c8e2d7cc0d7494f35` | `2b10aa0` (tree unchanged) |
| RAVE | #65 (contains #34) | `7ccee3db4a86125bd914a9821f62cba783af0660` | `bc43e92` |
| RAVE | #44 | `f0c0ec00653c9323a2e166f8687c1971c2098d72` | `d1df64b` |
| SOL | #64 (contains #35, #38, #40, #43, #50, #55) | `768f463a921998431f17007ffb1a79ac5577da6e` | `b8b5a83` |
| SOL | #63 | `02a89b799ca06dd656684799ddce94597a4c3f52` | `2db4d41` |
| SOL | #47 | `9d62b8ee5eb760092610193c77eeb49270dfc29e` | `0f6aa1c` |
| SOL | #42 | `f2491e0311e51879f8f22aad4d322b3e8f5946b7` | `a77a103` |
| SEC | #33 | `53bc4110583892e6d7bba5533025670e396e5ed7` | `45f75fc` |
| OBS | #36 | `2931c5fc51736e3c845cb9bedc55c578534b53a1` | `8bf0d74` (tree unchanged) |

## Evidence relationships

```
SOL #55 c071e4c ──(historical run 43604140724)──► original artifact 14118166967
        │                                         └─ committed ZIP (SHA-256 33a56159…) ── #63 verifier ── ci.yml preserved-original-evidence
        │
        └─ program/test blobs ──► EVERY same-run integration execution builds them fresh
                                  (localnet disposable program ID; IDL/ELF hashes are per run, never reused)

same-run integration (integration-snapshot.yml, ONE run at ONE SHA):
  solana-lifecycle ──► localnet evidence ──► cross-lane-js (OBS Kit v2 pending queue, NO-ACK) ──► own-dna-same-run-build
                                                                                               (source-bound dna.yaml rewritten
                                                                                                from THIS run; native HAM + WASM;
                                                                                                hc dna/app pack; install steps
                                                                                                `if: ${{ false }}`)

#66 run 43648980986 @ 03b567a ──► artifacts 14136370324 / 14135563715 / 14135966104 (expire 2026-11-28)
        └─ demo/installation/baseline.json ──► installation-request.prepared.json
           (executor 8ecbee6, DNA uhC0kCn-ld2PREMKI6nDVq4XssTKHgs8QHOszCC3a32pXCZjowgXt) = HISTORICAL, unapproved
```

The consolidation's own same-run build produces a **new** DNA hash, because the source-domain properties are bound to that run. It is **not** the DNA named by the historical request, and no grant may be transferred between them.
