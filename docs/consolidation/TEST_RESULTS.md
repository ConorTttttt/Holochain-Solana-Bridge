# Test results: consolidation

## Identity

| Item | Value |
|---|---|
| Validated code commit | **`8bf0d7411a05380e76284db2356d1555ab97f636`** (branch `claude/holochain-solana-consolidation-3l2lqm`, PR #68) |
| Base | `main` `e1651fec77f1ed5c5f8e760e486c8757adc5e69c` |
| Commits after `8bf0d74` | documentation only (`docs/consolidation/*.md`, `README.md`, `docs/LOCALNET.md` banner). Their own CI runs are listed in the PR #68 description; `git diff --stat 8bf0d74..<head>` touches no code, workflow, lockfile or fixture |
| Historical evidence | #66 `03b567a` / #67 `d0409a1` runs are **not** cited as evidence for this commit |

## Toolchain at the validated commit

Read from CI job logs, not from configuration:

| Tool | Version | Source |
|---|---|---|
| Node / npm | v22.16.0 / 10.9.2 | `anchor-compile` "Toolchain evidence" |
| rustc / cargo | 1.95.0 (59807616e 2026-04-14) / 1.95.0 (f2d3ce0bd 2026-03-21) | same |
| Solana CLI / test validator | 4.1.2 (src:182084b8; feat:c763ae0a, client:Agave) | same |
| Anchor CLI | 1.2.2, built from `otter-sec/anchor` rev `8d9d1488d9b8af41b266d7513eea2e668adf15a2` (`--locked`) | same |
| Holochain / lair-keystore / hc | 0.7.1 / 0.7.1 / holochain_cli 0.7.1 (Holonix `a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da`; hc SHA-256 `7062a571…57fd`) | installation-preparation runtime inventory |
| Runner | ubuntu-24.04 (24.04.5) | job logs |
| Local (this session) | Node v22.23.5, Python 3.13.18 (`cryptography` 50.0.1); no Anchor / Solana / hc locally | local shell |

## GitHub Actions at `8bf0d74`

| Workflow | Run | Result | Jobs |
|---|---|---|---|
| Sprint 0 CI (fail-closed) | [44714083657](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/44714083657) | ✅ **success** | **7/7** |
| S0 cross-agent integration snapshot (same-run) | [44714083624](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/44714083624) | ✅ **success** | **4/4** (install/identity steps skipped by `if: ${{ false }}`) |
| Original installation evidence and authorization denials | [44714083662](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/44714083662) | ✅ **success** | 1/1 |
| A0 non-authorizing Cargo dependency bootstrap | [44714083641](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/44714083641) | ✅ **success** | 1/1 |
| A0 own-DNA reproducible build gate | [44714084009](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/44714084009) | ❌ **INTENTIONALLY BLOCKED** | static-readiness ✅; own-dna-build ❌ by design (exit 3); install job skipped (`if: ${{ false }}`) |
| RAVE Unyt v0.117.0 release proof | **not run** | — | contains a disposable conductor install of the third-party Unyt hApp; outside this task's authorization |

### Sprint 0 CI jobs (run 44714083657)

| Job | Result | Evidence |
|---|---|---|
| Observer unit tests and syntax | ✅ | `# tests 156 # pass 156 # fail 0 # skipped 0`; `npm run check` OK |
| Reviewed committed dependency lockfiles (required) | ✅ | four reviewed lock SHA-256 values |
| Commit secret and generated-file guard | ✅ | guard tests + scan |
| Required Rust host and Anchor SBF compilation | ✅ | `cargo check exit=0; anchor build exit=0`; `PASS: IDL address matches ephemeral localnet program key`; IDL SHA-256 `18f2867691dbec83b16636295d13acbc965c40d5a327aca07e56c540efde153f`, `.so` SHA-256 `d49c5ac81938f84de00e747f272f6c9d07ed66eb5dbf4033722fa15719103484` (disposable per-run program ID; never reused) |
| Available SOL layout, SEC and RAVE fixture tests | ✅ | `CROSS_LANE_MODE: INTEGRATED_REQUIRED`; **31 suites, 204 tests, 204 pass, 0 fail, 0 skipped** (parsed from the job log; artifact 14618508563) |
| Ephemeral Solana validator RPC smoke | ✅ | liveness + invalid-RPC negative |
| Preserved original PR55 Solana evidence (new) | ✅ | size 968887 and SHA-256 `33a56159…a018` check; verifier `PASS: exact original ZIP, 280/280 manifest, original IDL/ELF/ProgramData, 4 Ed25519 wires and blocks, 2 snapshot sidecars` |

### Same-run integration jobs (run 44714083624)

| Job | Result | Notable steps |
|---|---|---|
| Real local-validator Anchor lifecycle (SOL runner; disposable only) | ✅ | SHA-256-pinned Agave 4.1.2 archive. `localnet-build.sh`: real `anchor build` and deploy, then four isolated `anchor test` validator modes, each followed by the witness-bundle and tamper verifiers:<br>• `lifecycle`: freeze-enabled mint rejected with atomic rollback; initialize pins one classic SPL mint + PDA authority; deposit creates nonce-keyed receipt and conserves base units; duplicate nonce / wrong signer / wrong mint / wrong source fail atomically; admin-only pause; refund works once; concurrent deposits, rollback and authority attacks<br>• `init-capture`<br>• `u64-max`<br>• `demo-domain`: source-bound initialize / deposit / refund + demo-domain tamper verifier<br>Then a retained-ledger validator restart and reconcile |
| RAVE 0.15.0 real crate tests (NOT deployed DNA) | ✅ | crate integrity verified; published-crate harness |
| Required SOL layout / SEC adversarial / RAVE shadow fixtures (real SDK) | ✅ | provenance (168 pinned blobs, 4 locks); IDL / ELF vs disposable program ID; all offline cross-lane suites, no skips; original Anchor key-sync patch replay; **complete 54-transaction finalized witness inventory + tamper denials**; genuine signed-wire replay through OBS; real Kit-reviewed v2 **pending** queue + explicit NO-ACK; fresh same-SHA demo-domain → OBS Kit v2 (no ACK); seven-stage preauthorization runner (no write); real finalized snapshots → OBS → **quarantine-only** shadow; SHA-bound A0 BLOCKED inventory |
| Same-run SOL/OBS-bound real Holochain 0.7.1 build and admin-only install | ✅ | prerequisites ✅ (this run's SOL/OBS artifacts retrieved; original bytes, source domain and derived-DNA binding negatives verified; both A4-reviewed locks committed). **Locked native HAM** (`cargo build --locked`, release, 5m38s) and **integrity + coordinator WASM** (47.49s) compiled with rustc/cargo 1.95.0 and `holochain_cli 0.7.1`. `hc dna pack` / `hc app pack` wrote the source-bound bundles; all 7 digests re-checked `OK`. **Install** and **seven-stage publish** steps were **skipped** (`if: ${{ false }}`); the mutation-boundary step printed `STOPPED_BEFORE_ANY_HOLOCHAIN_MUTATION` |

### Same-run build artifacts (run 44714083624, job 136218800217)

Build source printed by `build.sh`: `8bf0d7411a05380e76284db2356d1555ab97f636`.

| Artifact | SHA-256 |
|---|---|
| `holochain/demo/ham-adapter/target/release/solana-audit-ham-adapter` (native HAM) | `e3e40f1c3d50959082569206a0f5cd6e1f72a3c20751ec9a26dbe13aba60b5b9` |
| `target/wasm32-unknown-unknown/release/solana_audit_integrity.wasm` | `1e5bbdf9eeec4edfea66748e65bd539b5d69a17c3122c0ec361c8e212f46b4ca` |
| `target/wasm32-unknown-unknown/release/solana_audit.wasm` (coordinator) | `552d0392d33004e18e8f0533866a470c7e03afce4eabac4c19717a48e6f7a7ba` |
| `holochain_solana_audit_demo.dna` | `eb0d7bc50bd371247e4cc4fec83e194e0f9ac44dc697956b49b45b820b5db720` |
| `holochain_solana_audit_demo.happ` | `8b273581491f4c7bd698fa65f1daece5c9df31ce90d7351f0fe9f28e5b8f7bd1` |
| `holochain/demo/Cargo.lock` (reviewed) | `c5774a18ba821005d80e51c7bf1663062817ce06e585a2bc2245e09da3b4d6c6` |
| `holochain/demo/ham-adapter/Cargo.lock` (reviewed) | `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` |

- **Holochain DNA ID** (`hc dna hash`, not the bundle SHA-256): **`uhC0khasELjjRHDaRK7qAXjSCPbOvPbb8rjDfgH7qg_J5E5IyUFWS`**.
  - This differs from the historical #66 DNA `uhC0kCn-ld2PREMKI6nDVq4XssTKHgs8QHOszCC3a32pXCZjowgXt` **by design**: `dna.yaml` properties are bound to *this* run's disposable Solana execution.
  - No grant or request for either DNA applies to the other.
- **Uploaded artifacts:**

  | Artifact | ID | Digest |
  |---|---|---|
  | `a0-same-run-source-bound-own-dna-8bf0d74…` | 14618799354 | `sha256:dcfe70141693c4054ab53ca1a62c54d1df727c6ce7ea5b505d3dc74a80c84ae4` |
  | `integration-localnet-evidence-NO-KEYS` | 14619651251 | `sha256:4cb7bde99c6a6a29d602a1a450fcc5b82f1f2dcbf359a98f1b244c2d4f643841` |
  | `integration-cross-lane-js` | 14619197515 | `sha256:8e4fcdc71373b6d5e5c560cb19afbcdb0f41d8d0a0a210eb5ea8805fdef42778` |
  | `integration-rave-rust` | 14618172874 | `sha256:7eb39ede0e8e75baf1fdb80b88680f0d48e068f11f260d04b8b5404db9cb3c66` |

  All four expire **2026-12-04**. Preserve them before then if this build is ever proposed for an authorization request.
- The build log states: `BUILT ONLY: external Lair, installed CellId, SEC-scoped write approval, signed ActionHash and readback remain separate gates.`

### A0 gate refusal (run 44714084009, job 136213005946): intentionally BLOCKED

```
{"sourceCommit":"8bf0d7411a05380e76284db2356d1555ab97f636","buildInputsTracked":false,"a0":"BLOCKED_NOT_ACCEPTED",
 "blockers":["UNVERIFIED_DISPOSABLE_SOLANA_SCOPE","V2_OBSERVER_DNA_CONTRACT_NOT_INDEPENDENTLY_APPROVED",
 "REAL_LAIR_SIGNED_AUDIT_WRITE_NOT_AUTHORIZED","NO_INSTALLED_DNA_CELLID_AGENT_AND_ACTIONHASH",
 "SOLANA_PRODUCED_SLOT_HISTORY_INCOMPLETE"]}
##[error]Process completed with exit code 3.
```

These are the same five blockers as #66 run 43648980995. The workflow comments describe this as an intentional failure, and no Nix / Rust install or zome call is attempted on refusal. This is an **authorization denial, not a build failure**.

### Installation preparation (run 44714083662)

- `ORIGINAL_ARCHIVE_BYTES_VERIFIED` for the #66 originals (artifacts 14136370324 / 14135563715 / 14135966104).
- Original DNA hash recomputed with pinned `hc`: `uhC0kCn-ld2PREMKI6nDVq4XssTKHgs8QHOszCC3a32pXCZjowgXt`.
- **34/34** synthetic-key authorization refusal tests pass.
- A **new, unapproved** request candidate was emitted as artifact 14618467092 (digest `5f6faf757d564c4751888e9baf94fb686f39f76de46becd402551c9f4ed5cb5d`):
  - `requestState: CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED`
  - `executorSourceCommit: 8bf0d74…`; the historical request has `8ecbee6`
  - `baselineSourceCommit: 03b567a`
  - `hostFingerprint: null`
  - `allowSignedZomeCalls: false`, `allowCapabilityGrants: false`, `v2TransportApproved: false`
  - all four denials
- The candidate is **not committed and not approved**. The committed historical request is unchanged.

## Local execution at `8bf0d74`

Run in this session; every command is invoked exactly as its workflow does.

| Suite | Command | Result |
|---|---|---|
| Observer | `npm --prefix observer test` | 156/156 |
| Observer syntax | `npm --prefix observer run check` | OK |
| SOL unit (npm) | `npm --prefix tests/solana test` | 20 pass + 1 skip (no local Anchor IDL) |
| Cross-lane | `node scripts/ci/run-cross-lane-tests.mjs` | 203 pass + 1 skip (same IDL reason) → exit 1 locally by design; CI: 204/204 |
| A0 static refusal | `node --test demo/a0-*.test.mjs … tests/holochain/demo/demo-abi.test.mjs` (A0 job 1 list) | 63/63 |
| Installation authorization | `node --test demo/installation/*.test.mjs demo/a0-mutation-boundary.test.mjs demo/a0-runtime-gate.test.mjs` | 34/34 |
| Demo contract / evidence summary / preauth runner | `node --test demo/observation-contract.test.mjs` etc. | 21/21, 3/3, 14/14 |
| Guard | `node --test scripts/ci/guard.test.mjs`; `node scripts/ci/guard.mjs` | 3/3; `REPOSITORY_GUARD_OK` |
| Provenance | `node scripts/ci/verify-integration-provenance.mjs` | `PASS: 168 committed source-owned Git blobs, integration-only fixtures, four reviewed dependency locks` |
| PR55 original ZIP | `python3 -I tests/solana/verify-pr55-original-zip.py <zip>` | PASS |
| A0 gate | `node demo/a0-runtime-gate.mjs --require-build` | exit 3, `BLOCKED_NOT_ACCEPTED` (expected) |

### Adversarial / negative coverage newly executed versus #67

| New in this consolidation | Tests |
|---|---|
| OBS #59 nested economic denials on rehashed v2 witnesses; proof-kind pinning | demo-outbox.test 44, 45 |
| OBS #62 replay guard (archived fetch only in Node test child + opt-in) | replay-guard-boundary.test (3) |
| OBS #62 UTF-8 byte bounds; authority-field binding digest changes | v2-binding-review.test (2 new) |
| RAVE four-field literal denials at evidence and receipt layers | shadow-review, transaction-shadow (new negatives) |
| RAVE scale guard, two-conductor preflight (synthetic) | 4 + 3 |
| SEC external checkpoint quorum / rollback reference | 5 |
| SOL confirmation-recovery, demo-scope (previously run by no workflow) | 7 + 3 |
| SOL archive producer mock RPC, contradictory providers, gaps | 4 |
| Original PR55 ZIP re-verification | CI job |

## Failed / blocked / not run (honest list)

| Item | Status | Reason |
|---|---|---|
| A0 own-DNA build gate | BLOCKED (red by design) | five authorization / review blockers |
| Install, genesis, Lair, capability grant, zome call | BLOCKED (`if: ${{ false }}`) | no independently authorized exact request |
| RAVE Unyt release proof incl. conductor probe | NOT RUN | performs a disposable Unyt cell genesis; not authorized by this task |
| #48 durable returned-ActionHash tests | NOT INCLUDED | fix not ported; its 2 tests fail on the consolidated outbox (INTEGRATION_REPORT §4) |
| Cross-lane artifact download for re-hash | NOT DONE | egress proxy blocks `*.blob.core.windows.net`; counts were taken from job logs |
| Local Anchor / validator / Holochain builds | NOT RUN LOCALLY | toolchains unavailable in session; executed in GitHub Actions above |
