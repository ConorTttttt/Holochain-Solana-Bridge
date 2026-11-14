# A1 P0 real-witness CI review candidate — 14 November 2026

**Status:** REVIEW ONLY. No green claim; no trusted economic finality, no credit, no withdrawal. Base frozen PR #45 at `80f79e6c0499122f3b36762f63eac990dab50111`. Review child `integration/demo/2026-11-14-obs-replay-reviewed-source`.

## Historical exact failure that remains intact
- Shared CI 43590812005: six of six jobs passed at base SHA.
- Cross-agent CI 43590812095: real local-validator source producer and RAVE Rust PASSED; downstream 132437904785 FAIL.
- All original `lifecycle`, `init-capture`, `u64-max` Observer real signed-wire replays threw `Finalized indexer failed: getTransaction contradicts containing finalized getBlock` at `observer/src/indexer.mjs:110`. CI-only comparison already accepts **only** `meta.rewards:null` versus `[]`; production indexer didn't.
- Original artifact 14113085434, SHA256 `dfc4c82ec70cb16ff04a758f48bb3d78509c7bbbff1d319bf2f2e79ff026e6c8`: original three scenario archives captured in same run and public-only manifest. Prior archives must not substitute.

## Narrow A3 source-adoption review

This integration tree copies exact **git blob**, without modifying original A3 source:
- A3 #36 HEAD `2931c5fc51736e3c845cb9bedc55c578534b53a1`, `observer/src/indexer.mjs` git blob `8f1cdba2790bfd22a7f0235148ccb6a6ac7987e3`.
- A3 #36 original `observer/test/rpc-meta-equivalence.test.mjs` git blob `07b844a41d9179d249c5e2415ea3ae2734a8355c`.
- A1 old production indexer blob `03bb55c5ad8309f05d29b4d6dcda0ddacc6d0be7` was responsible for rejection. Review source version preserves signed wires, containing blocks, Ed25519 signature checks for *all* entries, strict transaction version + non-rewards execution metadata, and four top-level authorization denials. The exception is exactly empty rewards null/[].
- Verify source blob identity with `node scripts/ci/verify-integration-provenance.mjs` at the candidate SHA; the manifest's file hashes are executable constraints, not approval.
- Explicit A3 handoff requested on PR #36; A5 independent source review pending. A2 SOL #43 is NOT treated as adopted or approved.

## Real witness replay acceptance, no fallback

Run at a single candidate commit, no implicit branch-tip checkout:
```sh
npm --prefix observer ci --ignore-scripts
npm --prefix observer run check
npm --prefix observer test
# Requires exact-SHA original files from same CI producer:
node tests/solana/verify-witness-bundle.mjs lifecycle
node tests/solana/verify-witness-bundle.mjs init-capture
node tests/solana/verify-witness-bundle.mjs u64-max
node --test observer/ci/s0-signed-wire-evidence.mjs
```
The existing cross-agent workflow downloads *same-run* exact-SHA producer artifacts and fails missing, incomplete, tampered or source-mismatched archives; it does not use historical archive fallback.

**Scenario classification:** lifecycle includes actual successful deposit and later observed four-account receipt; a refunded snapshot is a later account observation and not gap-free history. **init-capture is archive-only** (attacker captured initializer, rightful admin init rejected); never fabricate a successful deposit. u64-max is an archive-only failure-boundary test; a successful unrelated transaction must not be promoted to deposit. Preserve exact on-chain failure classes and all seven tamper classes per mode.

## ABI, controlled DNA and no economic claims
- Current #45 `demo/observation-contract.mjs` is an IN-PROCESS **source-only staging** projection, not authenticated against arbitrary JSON. Its `source/witness/destination` shape does not match A4 #44 `root/source/proof` target.
- Target #44 is provisional until A3/A4/A5 agree on one authenticated outbox input. The HAM adapter permits *only* `test_only_fixture` with explicit environment opt-in. **Do not allow `observer_reviewed_outbox`** before reviewed source and independent security verdict.
- Actual externally Lair-signed write/readback/restart, genuine published own-demo DNA hash, caller role/cell/agent and signed ActionHash **not yet demonstrated**. No published Unyt DNA call.
- Persist/replay must be durable with read-before-retry; no global exactly-once or hostile-ledger rollback claims.

## Gate matrix (separate)
| Gate | Condition | Status |
|---|---|---|
| A0 audit demo | Real SOL signed deposit → production OBS replay → source identity → authenticated own-DNA HAM signed write/readback/restart/negatives, exact SHA | BLOCKED pending same-SHA replay + A3/A4/A5 and real Holochain |
| B1 history | Original complete two-provider getBlocks/getBlock every produced slot, signed refund and transition | BLOCKED; selected archived blocks ≠ complete history |
| B2 published Unyt | Exact coordinator source-to-WASM equivalence, authorized ABI/capabilities/agent role | BLOCKED; do not call Unyt |
| C economics | Nonrefundable governed custody, independent finality and quorum, authorized spend/withdraw | NO-GO |

**Next review:** inspect exact candidate Actions after run; do NOT infer green from an older shared CI result. Record exact run URLs, artifact hashes, expected negative error classes, signed action hash only if real, and all upstream source-owner approvals.
