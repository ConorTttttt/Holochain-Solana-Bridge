# Unyt/Holochain handoff — strict evidence boundary

This phase has NO RAVE execution, no Holochain zome mutation and no credit issuance.

## Relevant Unyt research

- `rave_engine` 0.15.0 is a published crate, but this project has not independently verified the deployed production Unyt DNA and zomes.
- The HOT bridge Rust orchestrator uses `rave_engine = =0.15.0` and handles credit-limit adjustment through a dedicated Unyt agreement.
- The current HOT withdrawal signer uses an independently connected Holochain node and checks `ParkedLinkStanding` for the exact parked withdrawal.
- RAVE deterministic accounting does not, alone, independently prove a Solana finalized deposit or Solana collateral state.
- A user can refund the on-chain deposit in **this** prototype. It is mathematically UNSAFE to create a redeemable Holochain claim against such collateral.

## Future handoff format (observation, NOT attestation)

`observer/src/verify.mjs` emits a JSON observation with:

- `kind`, a schema version; `id`, unique by genesis+program+receipt
- `genesisHash`, `program`, `receiptAddress`, `configAddress`, `vaultAddress`, `mint`
- `depositor`, `recipientCore`, `holochainScope`, `depositNonce`, `amountBaseUnits`
- `finalizedSlot`, `receiptDigest`, `refunded`, and `state`
- `creditEligible: false` **always**

Future independently authorized credit proofs will need more than this RPC observation: verified deposit transaction identity, source-program upgrade and custody rules, deterministic receipt PDA derivation, consensus/authority trust assumptions, replay-state persistence across migration, independent signers, and a binding to the exact Holochain DNA, unit index, agreement and deployment epoch.

## Promotion gate

Before connecting to Unyt, prove all of the following against exact deployed DNA/zomes:

1. One finalized, irreversible collateral deposit creates at most one economic entitlement.
2. A credit cannot be minted after an external refund or other vault outflow.
3. Multiple source-chain forks cannot create two redeemable Unyt claims for the same unit.
4. Parked-spend status consulted by independent signers is sufficiently authoritative for Solana payouts.
5. External payout and Unyt accounting remain consistent across lost receipts, crashes and migrations.
6. Recovery agreements and reserved commitments have global (not merely per-agreement) anti-replay semantics.
7. Every issuance and redemption uses a domain-bound, one-time identity and a reconciled collateral invariant.

The disabled stubs in `holochain/evidence-gate.mjs` are safety features, not unfinished plumbing to bypass.
