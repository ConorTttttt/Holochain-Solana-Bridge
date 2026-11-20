# Holochain audit demo — source-only staging (NOT Unyt credit integration)

> **Economic gate C: NO-GO.** This folder is an integration contract and
> fail-closed rehearsal, not a complete Solana-to-Holochain live demonstration.
> Do not publish it as a token bridge or claim any spendable Holochain balance.
> All tokens must be disposable SPL local-validator test tokens.

## Current implementation status (14 November 2026)

The executable `observation-contract.mjs` accepts only an in-process,
Observer-shaped signed-transaction + later account-snapshot handoff and returns
`solana-observation-demo-v1`, with authentic source identity fields,
a signed-wire SHA-256, original `getTransaction` execution-meta SHA-256,
receipt digest, exact decimal amount and nonce strings, and a stable event
identity. It does **not** independently authenticate the input. A caller
can fabricate its shape; therefore it must NEVER accept arbitrary imported
JSON, and is only called *after* the Observer's actual Ed25519, transaction,
block, CPI, account-state and program/mint/scope validation. The original
signed-wire CI suite prepares an envelope from genuine disposable validator
artifacts, if and only if that suite passes.

`historyIndexed:false` is mandatory until a full source-produced-slot archive
has been independently checked. `destination.state='not_bound_or_written'`,
`dnaHash:null`, and `actionHash:null` are deliberate. No fake Holochain
write or simulated action hash is used as positive integration evidence.

Every top-level and nested record includes:

```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

## One-command available **contract-only** check

From the repository root, with Node 22.16.0:

```sh
node --test demo/observation-contract.test.mjs
```

These are synthetic schema/mutation tests: **not signed Solana deposits**,
not a real Holochain conductor, and not an end-to-end demo.

## Reproducible real localnet → Observer source rehearsal

This rehearsal requires source-pinned Ubuntu CI with Anchor/SBF, a disposable
validator, real `@solana/kit` dependencies and the original 3-mode producer
artifacts from the *same commit*. The existing CI integration workflow is the
documented reproducible producer (it must run at an exact PR head):

```sh
npm --prefix observer ci --ignore-scripts
npm --prefix observer run check
npm --prefix observer test
# After genuine SOL builder/validator archive has generated
# target/localnet-evidence/** and target/idl/deposit_prototype.json:
node --test observer/ci/s0-signed-wire-evidence.mjs
```

Only a zero-exit replay may write the CI-only prepared observation artifact
`ci-artifacts/demo-source-only-observation.json`. This artifact is **not**
Holochain acceptance, and its proof is a provider-claimed finalized block,
not independently authenticated Solana finality. If produced-slot history is
missing, leave the history gate blocked.

## Full one-command Solana → Holochain demo: **BLOCKED**

A truthful one-command **real conductor** demo is not yet available. Do not
substitute JSON mocks, the test-only shadow adapter or the published Unyt
`transactor`. Agent 4 must provide and independently test an own-controlled
Holochain 0.7.1 DNA with a real Lair-signed `record_observation`, typed readback
and action hash. Integrator must then add a CLI runner whose exact target
app/cell/DNA/signing identity is allowlisted. The control path must fail closed
for wrong genesis, program, mint, scope, receipt, destination DNA, signer,
proof/digest, disconnect, replay and conflicting duplicate.

The intended operator demonstration (3–5 minutes) is:

1. Create a disposable localnet SPL mint; execute genuine signed deposit.
2. Observe the validator-provided finalized claim with original transaction,
   containing block, signature/CPI evidence and receipt four-account snapshot.
3. Persist the resulting *non-economic* event in a durable, idempotent outbox.
4. Deliver by signed HAM/Lair call **only to the independently built demo DNA**;
   read back the matching record and show its real Holochain action hash.
5. Restart sender and conductor, replay same event, show no duplicate audit
   action; exercise wrong genesis/program/mint/DNA and tampered witness denials.
6. Execute and independently observe a genuine Solana refund; append separate
   refunded/revocation audit entry, disclose history incompleteness; never
   authorize credit, value spend or Solana withdrawal.

A manual failure to run any of these stages is **BLOCKED**, not a pass.

## Acceptance milestones

| Gate | Requirement | Status |
| --- | --- | --- |
| A | Local validator + real signed-wire OBS replay + durable reopen | **IN TEST / not accepted at latest same SHA** |
| B1 | Complete original two-provider produced-slot history and refund lifecycle | **BLOCKED** |
| B2 | Own demo DNA signed Lair write, readback, restart, replay, negatives | **BLOCKED on Agent 4** |
| Unyt | Source-equivalent, independently approved released Unyt coordinator call | **NOT VERIFIED / prohibited** |
| C | Nonrefundable governed custody, independently verified security and spend/withdraw approval | **NO-GO** |

## Primary-source dependencies and handoffs

- Agent 3, OBS PR #36: adoption of `sameSolanaExecutionMeta` in actual
  `fetchFinalizedTransaction`, real Kit replay and authenticated archival bounds.
- Agent 2, SOL PR #40: fix `ATTR_INSTRUCTION_ACCOUNTS` source-account privilege
  attribution, pass full exact-head validator/producer and obtain SEC approval.
- Agent 4, RAVE PR #34: own-DNA source/build hash, exact signed zome contract,
  Lair signer, `CapGrantOptIn::Withheld`, authorized readback and action hash.
- Agent 5, SEC PR #33: explicit exact-SHA SOL/OBS/HAM boundary verdict; no
  self-approval, economic issuance or withdrawal.

Unyt `ham`, `raindex-orders` and `watchtower` provide implementation
references only. Source existence is not proof of released Unyt authorization.
Do not copy unrelated GPL Watchtower Rust code. Never call released-Unyt
zomes, create capability grants or mutate any Unyt financial state.

See the uploaded research brief
`holochain_solana_bridge_external_research_2026-11-14.md` for
source-linked architecture and limits (research, not implementation approval).
