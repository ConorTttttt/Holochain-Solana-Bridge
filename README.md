# Solana → Holochain bridge: first development slice

**Status:** proof-of-concept source code for **localnet with disposable tokens only**. Not audited, not deployed, and not ready to hold funds. No SOL, USDC, mainnet assets, Token-2022, production Holochain credits or real-money withdrawals.

## What this repository actually implements

- An Anchor **1.2.2** Solana program restricted to the **classic SPL Token program** and **one mint per instance**.
- A config PDA (`["config"]`) storing administrator, mint, 32-byte Holochain application/network scope, pause flag and active-deposit total.
- A program-owned custody SPL token account PDA (`["vault", mint]`) authorized by the config PDA.
- `deposit(nonce, recipient_core, amount)`: transfer exact *base units* from a user token account, verify the vault's balance change, create a dedicated `DepositReceipt` PDA (only its refund status changes in this prototype) at `["deposit", depositor, nonce_le_bytes]`, and emit a log event.
- `refund()`: allow that depositor to reverse their **test** deposit exactly once; keep token accounting consistent. Refunds work while new deposits are paused.
- A dependency-free Node.js RPC **observer** that reads the receipt/config/vault in a single `getMultipleAccounts` snapshot at `finalized` commitment, checks owner/mint/vault/scope/state/amount invariants and checks the expected genesis hash. It can compare two RPC sources.
- Explicit disabled functions for Holochain credit issuance and Solana withdrawals, plus a test suite and research gates.

**The observer never issues credit.** Every observation contains `creditEligible: false`. A refund may occur after a finalized deposit observation; therefore a refundable deposit MUST NOT be used to issue mirrored Holochain value. There is no production bridge logic yet.

## Architecture of this deliberately limited phase

```
Disposable SPL token (localnet only)
           |
     deposit(nonce)
           v
  Anchor config + vault PDA
           |
  immutable-keyed receipt PDA [depositor, nonce]
           |
  observer: getGenesisHash + getMultipleAccounts(finalized)
           |
  checked, READ-ONLY JSON evidence
           X
  HOLOCHAIN CREDITING DISABLED  <-- not bridged value

Refund: depositor -> contract -> original user's token account
        receipt.refunded=true; active liabilities decrease
```

## Run the currently executable tests

Only Node.js 20+ is required for the offline evidence-parser tests:

```bash
cd observer
npm test
npm run check
```

These tests **have been executed** in the creation environment. The Rust/Anchor program has **not** been compiled or run here: the Rust, Anchor and Solana CLI toolchains are unavailable in this environment. See `docs/LOCALNET.md` for toolchain/setup guidance and the on-chain verification work still required.

## Read-only observer usage (after deploying your own localnet program)

```bash
node observer/src/cli.mjs \
  --rpc http://127.0.0.1:8899 \
  --genesis <LOCALNET_GENESIS_HASH> \
  --program <SYNCHRONIZED_PROGRAM_ID> \
  --receipt <DEPOSIT_RECEIPT_PDA> \
  --config <CONFIG_PDA> \
  --vault <VAULT_PDA> \
  --mint <DISPOSABLE_TEST_MINT> \
  --scope <64_HEX_DIGITS_OF_HOLOCHAIN_SCOPE>
```

Optional `--rpc2 http://127.0.0.1:8900` rejects disagreement in raw receipt bytes (two RPCs are *not* a cryptographic light client). Observations are not a proof of finality to Holochain, only a report based on the configured RPC endpoints. The current observer does **not** scan all deposits, verify the receipt PDA derivation, prove original transaction inclusion, or check a program-upgrade authority. Those are named unfinished security gates; do not treat this JSON as permission to mint.

## Why this initial boundary is intentionally narrow

- Solana finality and Unyt parked-spend validation are different kinds of evidence.
- Existing HOT/Unyt logic uses a bridge agent, credit-limit adjustment and independently validated signing—not a bare signed event.
- Refundability makes the prototype safe to practice with, but unsafe as backing for transferable Holochain credits.
- No production redemptions are written before verifying cross-network conservation, recovery, replay and fork resistance.

See `docs/SECURITY_GATES.md`, `docs/UNYT_HANDOFF.md` and `docs/LOCALNET.md`.

## Code structure

```
programs/deposit_prototype/src/lib.rs     Localnet Anchor deposit/refund contract
observer/src/decode.mjs                  Borsh/Anchor receipt and token-account readers
observer/src/verify.mjs                  Finalized RPC checks and two-source disagreement check
observer/src/cli.mjs                     Read-only CLI
observer/test/verify.test.mjs            Offline adversarial unit tests
holochain/evidence-gate.mjs              Deliberate safety interlock
```

## Source references for design assumptions

- [Anchor token transfer checked](https://www.anchor-lang.com/docs/tokens/basics/transfer-tokens)
- [Anchor PDA/token accounts](https://www.anchor-lang.com/docs/tokens/basics/create-token-account)
- [Solana versioned transactions including v1](https://solana.com/docs/core/transactions/versioned-transactions)
- [Solana token and authority semantics](https://solana.com/docs/tokens)
- [Unyt RAVE crate 0.15.0](https://crates.io/crates/rave_engine/0.15.0)
- [Unyt HOT bridge orchestration](https://github.com/unytco/raindex-orders)
- [Unyt system credit adjustment](https://github.com/unytco/smart_agreement_library/blob/main/library/__system_credit_limit_adjustment/execution_code.rhai)

Do not copy HOT Raindex/EVM authorization code directly into Solana. This package intentionally does not claim that Raindex can run on Solana.

## Development sprints and coding agents

This is an actively planned but **not production-ready** proof of concept. See the [six-sprint roadmap](docs/SPRINTS.md), [Sprint 0 tracker](https://github.com/ConorTttttt/Holochain-Solana-Bridge/issues/1), [agent profiles](.github/agents/), [launch instructions](docs/START_AGENTS.md) and [parallel-work rules](AGENTS.md).

**Start with #7 (SOL compile), #8 (OBS account audit), #9 (RAVE source mapping), #10 (SEC threat model) and #11 (CI workflows).** They can be worked concurrently by different agents on separate PR branches. The configured custom agents do not run automatically: assign tasks from GitHub's Issues / Agents interface when enabled. Do not enable Holochain credits or mainnet withdrawals to shortcut the security gates.
