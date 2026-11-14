# Sprint 1 SOL — adversarial custody & initialization assessment

**Status: TESTS IMPLEMENTED, LATEST LOCALNET EXECUTION NOT YET VERIFIED.**
This file documents an executable test plan, code-level assessment and exact
handoff. It does **not** claim the expanded scenarios passed CI. The last
independently inspectable passing localnet run is
[43499386297](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297),
on the earlier commit `bc4c907a4fc8e0ef5af073c06285ad248225f017`.
Run the expanded suite on the latest SOL branch before promoting any result.

## Invariant and state transition design

`vault.amount >= config.total_active == sum(receipt.amount where !receipt.refunded)`
must hold for every active receipt in the single mint/config namespace. All
amounts, including maximum `u64`, are unsigned integer **base units**.
Source and vault token account balances are checked separately. Failure to
observe an actual confirmed transaction with `getTransaction().meta.err` is
a **test failure**; a JavaScript instruction construction error, simulation
failure or rejected preflight is not valid on-chain attack evidence.

The normal lifecycle mode independently enumerates all existing
218-byte receipt accounts with `getProgramAccounts`, decodes them from RPC
bytes, rederives each canonical PDA and reconstructs the aggregate of all
non-refunded receipt amounts. That scanned sum must equal `config.total_active`
and the classic SPL vault amount after every major state transition. It
also asserts the exact account data and canonical depositor+nonce receipt
PDA for every tracked receipt after both-wallet
deposits, negative transactions, partial aggregate refunds, concurrent
same-wallet nonce competition and final refunds. Negative tests compare raw
config, vault, token account and target receipt data and lamports before and
after failure. Two distinct funded wallets submit deposits concurrently
against the same mutable config/vault. Two competing transactions from one
wallet attempt the *same* receipt PDA using different amounts: exactly one
must succeed and one must be rejected by the validator.

Separate clean-ledger modes avoid false negatives from the singleton config:
`init-capture` proves the *attacker can initialize first* with an
attacker-controlled mint, administrator and Holochain scope. The legitimate
operator then cannot initialize or pause, while the attacker can. This is
**positive evidence of an existing vulnerability**, not proof initialization
is secure. `u64-max` creates a disposable mint with exactly
`18446744073709551615` token base units, deposits the entire amount with
the maximum nonce, verifies exact config/vault/receipt bytes, refunds it and
rejects supply overflow and repeated refund. No assumption is made that a
config-`total_active` overflow is independently reachable in a canonical
SPL token ledger whose total supply is itself bounded by `u64`.

### Reproduction on a clean isolated build host

Verified *historical* toolchain for the old run: Rust 1.95.0; Anchor CLI and
Rust crates 1.2.2; Solana CLI 4.1.2; SBPF platform-tools v1.57/arch v3;
Node.js 22.16.0. See `VERIFIED_LOCALNET.md` for historical outputs.

```sh
# In a disposable checkout with pinned CLIs installed.
cargo check --workspace --all-targets
bash tests/solana/localnet-build.sh
# The runner builds a fresh program and invokes these three isolated validator
# runs in order; it fails closed if a fresh config PDA is already present:
BRIDGE_TEST_MODE=lifecycle NO_DNA=1 anchor test --skip-build --validator legacy --provider.cluster localnet
BRIDGE_TEST_MODE=init-capture NO_DNA=1 anchor test --skip-build --validator legacy --provider.cluster localnet
BRIDGE_TEST_MODE=u64-max NO_DNA=1 anchor test --skip-build --validator legacy --provider.cluster localnet
# Additional two-process retained-ledger restart (run by the shell runner):
bash tests/solana/restart-validator.sh
```

The shell runner also passes `--provider.wallet` pointing at an ignored
local-only keypair. Do not reuse the same ledger between modes or run against
public RPC. The mode-specific data under `target/localnet-evidence/` contains
public transaction signatures, confirmed `meta.err` results, runtime logs,
finalized account-byte snapshots and observed upgrade authority, **not**
keypairs. Record latest tested SHA, test summary, exact genesis/program ID,
IDL SHA-256, ELF SHA-256 and all rejected/accepted transaction signatures
**from the new run**; never reuse the older hashes as fresh results.

## Material security findings

### Critical — unpermissioned singleton initializer

`Initialize` uses `config = PDA(["config"], program_id)` with `init`
and `admin: Signer` but has **no fixed governance-root check or authority
capability**. Anyone able to execute first can atomically claim config,
select any classic SPL mint without a freeze authority and set an arbitrary
nonzero Holochain scope. Then `has_one = admin` makes their selected
administrator permanent in this prototype. This is a real public-deployment
configuration-capture vulnerability. Test it on localnet; keep the code
economic policy unchanged until independent SEC review.

**Mitigation design for a future, separate reviewed PR:** hard-code or
otherwise anchor a governance root at deployment and require its signature
during a *single atomic initialization*, including commitment to exact
genesis, program ID, mint, scope and intended vault PDA; independently
validate that initialization arguments cannot be supplied by an adversary.
Use threshold-controlled upgrade administration and audited transfer
procedure with explicit acceptance, delay and revocation. A public mempool
race alone must not be able to choose the administrator. A nonce does not
fix first-initializer capture without precommitted authorization.

### High — upgrade authority remains a trust root

The local-validator program is normally deployed under the Solana
Upgradeable BPF Loader. The tests now decode the actual Program ->
ProgramData account and archive the observed optional upgrade-authority
public key. A successful deployment does **not** prove authority governance:
an upgrade key can replace the complete program and invalidate IDL,
PDA accounting semantics and past audit conclusions. Before economic use:
reviewed immutable/threshold upgrade policy, signed artifacts and delay,
on-chain upgrade monitoring and independent code hash attestations are
required. Actual unauthorized program upgrades are not exercised by these
tests and remain a security integration gate.

### High — SPL mint authority can create unbacked test-token supply

The test mint is intentionally created with `freezeAuthority = null` and
a normal keypair as its **mint authority**. No on-chain condition in this
prototype establishes the economic value of these minted units. A depositor
or administrator controlling a permitted mint authority could mint arbitrary
new tokens up to supply limits and obtain receipts. The test rejects
`MintTo` signed by an unrelated actor and records freeze-authority absence,
but this is **not** proof of real-world collateral or independent mint trust.

The vault token authority is the canonical `config` PDA; receipt PDAs use
`["deposit", depositor, nonce_u64_le]`; the vault uses
`["vault", mint_pubkey]`. The Rust accounts restrict
`token_program: Program<Token>` to the classic token program. Negative tests
exercise substituted vaults, token program IDs, source owners and attempted
SPL AccountOwner rotation signed by a non-PDA authority. Further tests
against the independently built generated IDL are required with OBS/SEC.

### Economic blocker — deposits remain refundable

The original depositor can refund while paused. Holochain credit eligibility
must remain `false`; these token balances are **not** irreversible collateral
for a separately transferable claim. This test-only program does not
implement withdrawals, burn/mint interlocks or production value transfers.

## Explicit gaps / coordination

- This checkout has no approved resolved `Cargo.lock` or
  `tests/solana/package-lock.json`. CI must resolve, review and commit a
  lockfile intentionally in the coordinated SOL/CI work; do not fabricate one
  or misrepresent exact top-level dependency versions as transitive locking.
- Retained-ledger restart test **implemented, not yet executed in CI**:
  `bash tests/solana/restart-validator.sh` starts an independent disposable
  `solana-test-validator --reset --ledger target/restart-ledger`, deploys the
  existing compiled SBPF, creates a live 12,345-unit deposit and archives
  actual finalized public bytes. It then stops that process, starts a
  **new validator process against the identical ledger WITHOUT --reset**,
  requires an identical genesis and byte-for-byte persisted accounts, and
  re-enumerates program receipts to reconstruct the live liability. This
  is executable code, **not passing recovery evidence until CI runs it**.
  Crash/power-loss consistency and adversarial forks remain untested.
- Not proven: program upgrade attack rejection, validator fork/finality,
  Holochain issuance, independent cross-chain collateral solvency, or
  production redemption.
- Existing OBS handoff `OBSERVER_HANDOFF.md` has a **real historical**
  generated IDL hash, two receipt byte snapshots and canonical bump/address
  pairs from run 43499386297. A subsequent run uses a new disposable
  program ID and thus generates new addresses/bump values and hashes. Share
  the *new* assets with OBS after its successful CI run.
- Agent 1 owns `.github/**`, global integration and snapshot promotion;
  do not edit integration PR #37 or merge main. Agent 4 / SEC must
  independently review the above initialization and custody authority risks.


## 13 November 2026 — SOL verifier hardening (NOT validator-tested)

The SOL test source has been strengthened since the last passing run
`43499386297` (old source `bc4c907`). The enhancements are **not yet
execution evidence**, even though the changed JavaScript was checked for
syntactic validity in the agent's V8 environment.

- After each serial successful or **actually included and rejected** program
  transaction, the test reads the config and vault from RPC, enumerates all
  218-byte program receipt accounts, rederives canonical depositor+nonce
  identities, validates each receipt's scope/mint/config/vault/bump, sums
  active amounts as exact BigInts, proves `total_active == sum(active)`
  and `vault.amount >= total_active`. It permits donated vault surplus.
  Concurrent transactions are reconciled after both outcomes settle;
  RPC snapshots are not atomic cross-request consensus proofs.
- For every `sendAndConfirmTransaction` success, the test now requires
  `getTransaction().meta.err === null`, a real signature, execution slot
  and validator logs. Negative transactions already use signed raw sends
  with preflight bypass and require `meta.err !== null`.
- At the end of each mode the harness re-reads each unique transaction at
  `finalized` commitment, compares confirmed/finalized `meta.err`,
  requires a finalized `getBlock(slot)` response and archives blockhash,
  previous blockhash, parent slot, logs and token balance metadata. These
  records are localnet RPC observations, not independent finality proofs.
- All three modes archive actual Upgradeable Loader ProgramData upgrade
  authority and SPL mint/freeze authorities. The prior freeze-authority
  negative test had signed with the *wrong wallet*, risking a client-side
  signature failure; it now signs as the claimed unauthorized actor so an
  on-chain Token Program rejection is required.
- The independently reviewable **design-only** mitigation proposal is
  `tests/solana/INITIALIZATION_MITIGATION_PROPOSAL.md`. Rust custody policy
  and Holochain issuance controls are unchanged.

**Outstanding:** The current SOL branch has no passing new validator run;
`anchor`, `solana-test-validator` and Cargo are unavailable in the
current agent container. The earlier Actions workflow path has been removed,
so a new run must be orchestrated by the CI lane on a combined checkout
pinning the current SOL head. Until then: do not mark expanded/restart tests
passing, do not claim first-initializer localnet attack executed, and do
not copy the old IDL/ELF hashes into a new manifest. npm/Cargo lockfiles
cannot be accepted without real resolution and review.


## 13 November 2026 — raw RPC fixture capture (code only; validator re-run required)

The test harness now makes localhost-only JSON-RPC requests and archives the **verbatim
response JSON** to `target/localnet-evidence/`:

- `getTransaction-<signature>.rpc.json` includes the full finalized signed
  transaction, message account keys/instructions, version, `meta.err`, logs
  and transaction metadata for **both successes and rejected included txs**.
- `getBlock-<slot>.rpc.json` includes the full finalized block/transactions,
  not merely a blockhash; the harness asserts the signed transaction occurs
  in that block with the same execution error.
- `getMultipleAccounts-<label>.rpc.json` includes the unmodified context,
  account data `[base64, "base64"]`, owners, executable flags, lamports,
  rent epochs and account metadata. Normalized legacy `<label>.json` snapshots
  remain available and identify the raw-response companion file.

The JSON-RPC response is stored as received, rather than reserializing an SDK
object, so large `u64` RPC integer literals are not inadvertently rounded
during fixture capture. These outputs are **generated at validator execution**;
they do not yet exist for the latest SOL commit and must not be described as
executed or independently finalized. All signing keys are excluded.

## 13 November 2026 — missing signature incident and regression (source changes only)

**Failure provenance:** integration snapshot
`4949b5693dccba1ff373a276a75c27db2f045005`, Actions run
`43520697998`, local-validator lifecycle scenario. Five lifecycle
subtests passed before the enhanced sixth test aborted at JS transaction
serialization, with `Signature verification failed / Missing signature`
from `submitOnChain`. The stale snapshot's freeze-authority instruction
named the **owner** as required authority but signed only as the **attacker**;
this was not an on-chain rejection. It does not invalidate earlier executed
transactions, but the expanded lifecycle suite did **not** pass.

**Source correction:** the SOL branch already changed the freeze-authority
fixture to name/sign as the attacker (current authority deliberately
invalid), requiring a real included transaction with
`getTransaction.meta.err !== null`. Additional regression coverage now:

- `sdk-compat.test.mjs`: independently proves that a fee payer **and**
  transfer owner must sign; missing owner and wrongly substituted owner
  signatures fail locally and are **not** counted as on-chain denials.
- `integration.test.mjs`: additionally submits a fully signed attacker-
  depositor transaction referencing a token source owned by a different
  wallet. Anchor's `token::authority = depositor` constraint must reject
  the included transaction; the harness requires non-null execution
  `meta.err` and an absent receipt.

**Verification status:** These new assertions are **source commits, not
validated localnet results**. This editing environment lacks Cargo, Anchor
and `solana-test-validator`; a stale workflow rerun against the old
integration snapshot cannot verify them. CI must pin a new immutable
integration snapshot containing this newer SOL head, then execute
`cargo check --workspace --all-targets` and
`bash tests/solana/localnet-build.sh`, capture all three isolated validator
modes and retained-ledger restart, and publish freshly generated signed
`getTransaction`, `getBlock`, `getMultipleAccounts` fixtures with
IDL/ELF hashes. Mark the suite PASS only after matching tested source SHAs
and zero unexplained failures. Do not auto-merge or enable issuance.
