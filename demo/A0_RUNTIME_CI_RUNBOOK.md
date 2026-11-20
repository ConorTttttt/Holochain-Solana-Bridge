# A0 integration-owned runtime CI runbook — non-economic / blocked until approvals

**Source:** `demo/a0-runtime-source-pins.json`, immutable parent A1 PR #51
`1c4bd936e82a759c53fe3fd9d6916b4adca245ff`. All newer candidates need
new exact-SHA CI evidence. This is not Agent 4 source, an A3 ABI decision,
SEC approval or Unyt coordinator authorization.

## Available now: exact-SHA, reproducible refusal/readiness inventory

At the current checkout, run:

```bash
node --test demo/a0-runtime-gate.test.mjs
A0_EXPECTED_SHA="$(git rev-parse HEAD)" node demo/a0-runtime-gate.mjs \
  --out ci-artifacts/a0-runtime-readiness.json
A0_EXPECTED_SHA="$(git rev-parse HEAD)" node demo/a0-runtime-gate.mjs \
  --out ci-artifacts/a0-runtime-readiness.json --require-write
```

The last command **intentionally exits 3**. This is not a test failure to
work around: there is no approved signed write. Report names correspond to
the required `source_verified`, `outbox_queued`, `audit_record_written`,
`readback_verified`, `history_incomplete` and `blocked` stages; statuses never
promote source-only JSON to live chain evidence.

The new `.github/workflows/a0-own-dna-runtime.yml` checks out the exact
PR-head SHA, runs Node 22.16.0 refusal tests, and uploads an immutable-source
readiness manifest. Manual `workflow_dispatch` additionally requires *both*
Agent 4 reviewed, **committed** lockfiles and all own-DNA sources in the SAME
checkout, refuses placeholders, and uses pinned Rust 1.95.0 plus
`holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da` to invoke Agent 4's
unchanged `holochain/demo/build.sh`. It captures actual WASM and bundles,
`hc dna hash`, compiler versions and file SHA-256 if and only if compilation
really succeeds. It makes NO signed zome calls or published-Unyt calls.

## Exact remaining source/runtime inputs — owners must supply

1. **A4:** reviewed copies of own audit-only DNA and native HAM adapter,
   *both committed* `holochain/demo/Cargo.lock` and
   `holochain/demo/ham-adapter/Cargo.lock`; pin HAM commit
   `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`. Replace placeholder
   `dna.yaml` only using source-verified disposable Solana genesis, actual
   program, mint and Holochain scope from the producer in this same SHA.
   A1 must not edit specialist zomes or regenerate unreviewed lock graphs.
2. **A3/A4/A5:** ratify `demo/A0_OBSERVER_DNA_V2_CONTRACT_PROPOSAL.md` and A3
   PR #52 complete signed-wire, finalized block/metadata, nonce/recipient,
   receipt snapshot and exact DNA/CellId/signer proof. A3's v2 cannot be
   relabelled as v1 and is deliberately not admitted to A4's fixture-only ABI.
3. **A4/A5:** prove *read-only* installed own-app CellId and external Lair
   signer first. Request a distinct, independently attributable review of
   immutable source, WASM/bundle SHA-256, real DNA hash, app/CellId/agent,
   zome/function, signed-record ABI and capability policy. Without that
   approval, `record_observation` is prohibited even on disposable fixtures.
4. **A1 after approval only:** implement the in-process A3 outbox→signed HAM
   path; never accept imported JSON or an origin-string override. Obtain a
   genuine ActionHash, typed readback, verified no-blind-retry after conductor
   restart, wrong wire/signature/scope/amount/nonce/recipient/DNA/agent/signer
   negatives, and a same-SHA GitHub Actions artifact. The current workflow
   deliberately contains no mutating job, pending authorization.

## Reproduction and acceptance

The passing PR #51 shared 6/6 and real cross-agent 3/3 are separate evidence:
[43597279497](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43597279497),
[43597279450](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43597279450).
PR #49 already passed a five-job **published Unyt** read-only RAVE workflow;
that is NOT our own-DNA signed audit proof. Rerun all required jobs at the new
exact SHA after adopting reviewed specialist source; preserve old artifacts.
No `A0 ACCEPTED` until a real source-bound, independent-security-approved,
external-Lair-signed own-DNA ActionHash and typed read/restart proof exist.

**Always** `creditEligible:false`, `independentConsensusVerified:false`,
`spendableBaseUnits:"0"`, `withdrawalAuthorized:false`, B1 produced-slot
history incomplete, B2 Unyt source/authorization blocked, C economic NO-GO.
No real assets, actual Unyt mutation, spendable credit, withdrawal, or merge.
