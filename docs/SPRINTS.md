# Delivery roadmap — Solana ↔ Holochain bridge

**Planning baseline:** 13 November 2026. **Status:** planned, no coding agents are automatically running. Work is tracked by GitHub issues tagged `[S0]` to `[S5]` and `[SOL]`, `[OBS]`, `[RAVE]`, `[SEC]`, `[CI]`. The first live transfer must be **disposable tokens only**.

## What does “working” mean?

- **M0 — Solana localnet works:** build + deploy a pinned Anchor program; exercise initialize, deposit, single refund; observer accurately detects refundable receipts. No Holochain credit.
- **M1 — finalized evidence works:** deterministic deposit identity, transaction-aware finalized scanner, multiple deposits per transaction, v1 parsing, checkpoints, backfill, RPC disagreement handling. Evidence still not authorization.
- **M2 — isolated Holochain shadow mode:** run verified `rave_engine` / Unyt sandbox with evidence-shaped test inputs; produce audit trail, but no spendable credits or collateral claims. Fork, replay, parked-link and migration issues explicitly tested.
- **M3 — two-way **development-network** demo:** a *separate nonrefundable* custody implementation and a tested, domain-bound one-time withdrawal protocol, only after security gates pass. Not suitable for real-value tokens.
- **M4 — production candidate:** independent audits, source/deployment equivalence, operational separation of duties, security incident plan, disaster-recovery drills and sustained monitoring. Requires explicit separate release approval.

## Time-boxed sprints (durations are planning targets, not delivery guarantees)

| Sprint | Duration | SOL | OBS | RAVE | SEC | CI | Exit gate |
|---|---|---|---|---|---|---|---|
| **S0 — Establish ground truth** | 1 week | compile/pin versions | audit receipt decoder/PDA layout | obtain source + set harness | threat model/invariants | Node/Anchor CI smoke | actual Anchor compilation; reported tests reproducible |
| **S1 — Localnet proof** | 2 weeks | run real deposit/refund on validator | finalized account/transaction evidence spec | run RAVE unit tests; validate Unyt contracts | fork/recovery test vectors | local validator CI, artifacts | M0 demonstrated; issues from failure tests fixed |
| **S2 — Evidence and shadow mode** | 2 weeks | program authority/custody hardening | complete finalized indexer incl. v1 and backfill | shadow RAVE integration, no issuance | adversarial external-proof review | restart/fault injection harness | M1 + M2 with auditable logs |
| **S3 — Economic escrow proof** | 2+ weeks, **conditional** | separate nonrefundable test-token vault | verification + reconciler | prove conservation and commitments | formal approval of issuance assumptions | integration tests | no external credit unless fork/recovery/finality P0s pass |
| **S4 — Two-way devnet** | 2+ weeks, **conditional** | one-time Solana claim/release | withdrawal status tracking | irreversible Holochain spending evidence | replay/cross-epoch audits | crash-consistent end-to-end demo | M3: at-most-once payout + solvent accounting |
| **S5 — Security/release readiness** | open-ended | upgrade/custody governance | monitoring/backfills | deployed DNA equivalence | independent review, audits | reproducible builds + disaster drills | M4 candidate; explicitly **not** automatically mainnet |

Agents overlap **within each sprint**. For example, in S0 SOL compiles while OBS audits account layouts, RAVE builds a sandbox harness, SEC writes attack cases, and CI sets up automated checks. Contracts converge at a weekly checkpoint. Later sprints do **not** override failed gates.

## Key handoff dependencies

```
[S0 SOL] compile + IDL ----> [S1 SOL] localnet validator tests ---+
         |                      |                                   |
         +---> [S0 OBS] layout -> [S2 OBS] finalized indexer -------+--> [S2 CI] evidence replay
[S0 RAVE] source map -------> [S1 RAVE] executor/fork tests -------+--> [S2 RAVE] SHADOW ONLY
[S0 SEC] threat model ------> [S1 SEC] adversarial cases ----------+--> [S3 SEC] issuance gate
[S0 CI] build matrix -------> [S1 CI] localnet runner -------------+--> [S3 CI] cross-network tests

**STOP:** no spendable credit or production withdrawal until S3's independent approval.
```

## Definition of done for each issue

- Actual commands and versioned logs in PR; no simulated success.
- Positive test + at least one negative/adversarial test.
- Explicit state after crash/retry where economic state changes.
- Risks and assumptions disclosed; related issues linked.
- Tests green on relevant branch and an independent reviewer has signed off.
- PR follows lane ownership in `AGENTS.md`; user (human) merges.

## Agent concurrency and coordination

- **5 lanes are independent roles, not 5 active sessions.** Assign an automation service, Codex session, or human to each ready issue. Keep a maximum of one open feature branch per lane at a time, except separate review-only research.
- SEC reviews *all* P0 economic changes from SOL/OBS/RAVE, never self-approves.
- CI should run after each merge, not simply claim green from other agents' notes.
- Coordination meeting/checkpoint: end of each sprint; summarize accepted test evidence, blocked issues and current solvency invariant.
- Work can run in parallel when it edits different modules. If a downstream gate is blocked, lanes continue with mocks, adversarial fixtures and documentation, **not** by bypassing the gate.

## Immediate priority

Start S0 first. The prototype's Rust/SBPF build has not been independently validated. SOL must obtain a compiled program/IDL and CI must record real tool versions; OBS and RAVE can develop isolated tests while that happens.

## Security gates

1. **Finalized source custody:** prove unique confirmed & finalized on-chain deposits and real spendable collateral.
2. **Holochain economic safety:** prove a parked/retired spend cannot generate duplicate redeemable credit across forks, recoveries or DNA migration.
3. **Authorization:** independently verified domain-bound withdrawal signatures, unique nonces, expiry and durable revocation/pause policy.
4. **Accounting:** `outstanding claims + outstanding authorized-but-unpaid obligations <= spendable collateral` without double counting.
5. **Operational:** crash/replay/missing-RPC and independent key management; exact deployed bytecode/DNA source equivalence.

See `docs/SECURITY_GATES.md` and `docs/UNYT_HANDOFF.md`.
