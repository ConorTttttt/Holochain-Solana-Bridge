# A4 installed own audit DNA — genuine locked compiled runtime tuple (14 Nov 2026)

**Evidence verdict: PASS for the archived, stopped SOL #55 audit-only DNA; NOT same-run A1 integration, NOT an authorized mutating audit call. Gate C remains NO-GO.**

- PR #44 branch. **Exact tested source/workflow SHA:** `3339225550a8aa82c3256562d108e750ddab60dd`. The post-run branch contains subsequent evidence-only / redaction improvements; do **not** mislabel them as the tested SHA.
- [Actual GitHub Actions run 43647150236](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43647150236): **SUCCESS** all steps, including genuine locked Rust 1.95.0 native + both WASMs, original source archive check, pinned Holochain 0.7.1 packaging, disposable external Lair sandbox install and **signed read-only** HAM preflight.
- [Actual build/install artifact 14134364536](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43647150236/artifacts/14134364536): compiler logs, Rust tree/metadata, binary SHA checks, actual DNA/hApp binaries and hashes, Admin API lists, Lair signed get_contract read-only result, five refusal classes. Temporary keystore and passphrase were not uploaded; sandbox logs redact socket token.

## Immutable build provenance and actual artifact digests

| Thing | Actual value |
| --- | --- |
| Rust toolchain | 1.95.0; locked actual compile |
| Holonix Holochain | `a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da`, 0.7.1 |
| HAM Git pinned revision | `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4` |
| Reviewed native Cargo.lock SHA-256 | `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` |
| Explicitly reviewed corrected WASM Cargo.lock SHA-256 | `c5774a18ba821005d80e51c7bf1663062817ce06e585a2bc2245e09da3b4d6c6` |
| Native HAM release binary SHA-256 | `581ba3fc0285ac57006b739973f913b7c0e3dc54ec846db9f150ed35796ac71a` |
| Integrity WASM SHA-256 | `1e5bbdf9eeec4edfea66748e65bd539b5d69a17c3122c0ec361c8e212f46b4ca` |
| Coordinator WASM SHA-256 | `0d9fc68e7c4dfab31d5541a7b1fce26ea530b763985e52e3ec7f416fa1138c0c` |
| Packed DNA SHA-256 | `a78d5f1ae5d88108029cb6ef1069ca71e23893ecbeaa87990a204c6f88b6bde9` |
| Packed hApp SHA-256 | `5fbf09ca6736fb4ed336312829b8932b111c638bfea42c61b6f68fc3c66f8b82` |
| **Actual `hc dna hash`** | `uhC0kLCBli6ty_8tGAUNa1vwBZb4rEkI7o8FN7VrTkPwSvIIWz9p7` |
| Source archive ZIP SHA-256 | `33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018` |
| Source manifest JSON SHA-256 | `dcbee3b3402fac226a85281ea844e395d5a7d010844a34f4d53ed5860a502136` |

All 280/280 original SOL #55 archive files passed their recorded SHA-256 checks. Original source `c071e4c98e7b2dd04a18374f3792c0a90ce4b284` with exact **source properties in the compiled DNA**:

- `genesisHash = BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv`
- `program = 387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1`
- `mint = 3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig`
- `holochainScope = 85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7`

This is **stopped archived SOL #55**, not the fresh A1 same-run integration source and not independent finality. Do not substitute it for the required separately generated current-source DNA.

## Actually installed app, cell, agent and external Lair

- Installed app ID: `hsc-owned-audit-demo55-readonly`, enabled; role: `audit`; zome: `solana_audit`; **read-only** function: `get_contract`.
- DNA hash from independent `hc dna hash`, from installed app Admin API and from Admin `list-cells`: `uhC0kLCBli6ty_8tGAUNa1vwBZb4rEkI7o8FN7VrTkPwSvIIWz9p7`.
- Agent key: `uhCAkuCQN-6MV190EpmfVH4MMmB74IZcRlRGufYLr-VZVe5uvAmWh`.
- Full **ordered CellId** `["uhC0kLCBli6ty_8tGAUNa1vwBZb4rEkI7o8FN7VrTkPwSvIIWz9p7","uhCAkuCQN-6MV190EpmfVH4MMmB74IZcRlRGufYLr-VZVe5uvAmWh"]`.
- Actual config has `keystore: LairServer`; sandbox started separate `lair-keystore ... server --piped`. Pinned HAM used `LairCredentials::Node`, `CapGrantOptIn::Withheld` and signed a **read-only** `solana_audit/get_contract` call, result `DEMO_HAM_PREFLIGHT_OK`.
- Admin API `list-apps` and `list-cells` matched the full CellId in the restarted conductor.
- Runtime negatives all **PASS**: forbidden published-Unyt app; wrong DNA; wrong agent; missing Lair credential; missing conductor config. Original run lists all exact sanitized classes.
- **No mutating zome function, `create_cap_grant`, real Unyt zome, credit, allocation, withdrawal or token action was called.**

## Remaining independent gates

1. **A1 same-run manifest:** build a *separate* disposable DNA from authenticated A1 live source; the existing archived template must remain unchanged.
2. **A3 + A5 v2 agreement:** exact lossless typed field table, original complete signed wire, full containing block, receipt and OBS ledger evidence, canonical UTF-8 vector and witness digest. A3's source witness digest and any separate A4 destination binding digest cannot be conflated. Without independent authenticated admission and SEC sign-off, keep `record_observation_v2` disabled.
3. **A5 exact signed write authorization:** not granted for v1 or v2. This runtime tuple authorizes **read-only verification only**. No claim of global exactly-once, complete produced-slot history, hostile-rollback defense, released Unyt source-equivalence or economic functionality.
4. Four literal denials: `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`; gate C **NO-GO**.

Initial compiler failures and exact narrow fixes are retained in [REAL_LOCKED_BUILD_EVIDENCE_2026-11-14.md](REAL_LOCKED_BUILD_EVIDENCE_2026-11-14.md) and separate earlier failed run logs. The Native/HAM binary itself was SHA-256 checked by CI; only its digest/log, not its executable bytes, were uploaded in this run. The actual compiled WASM/DNA/hApp binary bytes **were** uploaded and hashed.
