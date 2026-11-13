# Solana → Observer S0 account contract: verified Anchor IDL + real localnet account bytes

**Status (2026-11-13): compiled and validated on an isolated Solana local validator.**
The exact Rust source, program ID, generated Anchor IDL, public account bytes and
deposit/refund signatures were checked in actual GitHub Actions run
https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297 .
This is **NOT** proof of mainnet source equivalence, independent finality or
Holochain economic authorization. OBS PR #36 still needs a combined full-checkout
test of its maintained Solana SDK and new `isNative` validation.

## Verified run 43499386297: public handoff data

- **Full evidence bundle:** https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297/artifacts/14073462857
  (real ELF/SBPF, generated Anchor IDL, cargo/build logs, finalized localnet
  account snapshots and transaction signatures; no keypairs).
- **Program ID (one disposable localnet run only):**
  `FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG`.
- **Localnet genesis:** `FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8`.
- **IDL SHA-256:** `a81ccda8b91e90d1522cc922bac88aecae71e872d4b22ead9196ccceaf9d41f9`.
- **SBPF ELF SHA-256:** `ddbc9a56d1d7d2d0edc55153f099ed016dc6a26b30057b7bd8703c8ac7dd9dd5`.
- **Config PDA address:** `8cgyh99E7fmUyAFshwss8ZQZacpxWTyCm1ApFJFC7999`,
  stored bump `255`. **Vault PDA address:**
  `FsTLDdsAHYtbFCRXk1Px6mi47t1tYQadF42qQP5DWebT`.
- **Receipt PDA address:** `BdR4H8M6pYafRkmEM57ydhH4yGKw2q1KokyvUkxLZ2VH`,
  depositor+nonce seeds, stored bump `248`. **Mint address:**
  `7t6r6MTjf6RBMoLtkPmEpK9RkG3fdw28JoimYP61hKy9`.
- **Receipt nonce (u64):** `42017`. **Holochain recipient core:**
  `09` repeated 32 bytes; **scope:** `07` repeated 32 bytes.
- **Actual public deposit signature:**
  `5n2zYM3uEhP4EGLHRJWT8f2wYaR55TC1z3gygcevZe47jkrN4Nd3kgACYL9abv1jN96qkMg9AFLSrCAsUWMkE5eQ`.
- **Actual public refund signature:**
  `67rG62EX4xiDnCb6uqfmZyZwuwsFNbfnoSbuRPs2FP4gSfhE6KNRRTuBxUkvkCHAyeaA9bTKVZ4uNNwWoJsRPdC9`.
- **Account fixtures:** `target/localnet-evidence/active-receipt.json` at
  local finalized slot **33**, `refunded-receipt.json` at slot **67**.
  Each contains base64 bytes for receipt (218), config (114), vault (165),
  mint (82). Observer should independently decode these fixtures with its
  compiled IDL and validate every PDA bump and canonical address.
- Active: `receipt.refunded=false`, `receipt.amount=250000`,
  `config.total_active=250000`, `vault.amount=250000`.
  Refunded: `receipt.refunded=true`, `config.total_active=0`,
  `vault.amount=0`. Byte comparison found only receipt byte offset
  **216** changed; the mint's 82 serialized bytes were identical.

**Important:** All above addresses are scoped to this specific ephemeral
local-validator ledger. Generate new IDs for fresh runs and always bind them
to the exact current genesis and code binary. Never reuse these disposable IDs
as mainnet trust anchors.

## Address derivation (classic SPL Token only)

For an ephemeral **localnet** program ID `P`, derive each PDA using
`PublicKey.findProgramAddressSync(seeds, P)` (not ad-hoc SHA-256):

- `config = PDA(["config"], P)`, bump stored in `BridgeConfig.bump`.
- `vault = PDA(["vault", mint_pubkey_bytes_32], P)`; mint is the single
  `BridgeConfig.mint`. Its **SPL Token Account owner/authority** is
  `config` PDA (not the vault PDA).
- `receipt = PDA(["deposit", depositor_pubkey_bytes_32, nonce_u64_le_8], P)`;
  bump stored in `DepositReceipt.bump`. `nonce` is **unsigned u64 little-endian**.
  This is unique per (depositor, nonce), even after a refund.
- A placeholder program ID exists on `main` and is **not valid for
  deployment/observer trust**. Run `anchor keys sync` only after generating
  a disposable LOCAL program keypair outside Git, then distribute the resulting
  exact program ID and IDL to OBS.

## Serialized layout confirmed against actual generated IDL and localnet bytes

`BridgeConfig`: exactly **114 bytes** including 8-byte Anchor discriminator;
`SHA256("account:BridgeConfig")[0..8]` = `28ce33e9f628b255`.

| Inclusive byte offset | Field | Encoding |
|---|---|---|
| 0–7 | discriminator | 8 bytes |
| 8–39 | admin | Pubkey (32) |
| 40–71 | mint | Pubkey (32) |
| 72–103 | scope | bytes[32] |
| 104 | paused | canonical bool (u8 0/1) |
| 105–112 | total_active | unsigned u64 little-endian |
| 113 | bump | u8 |

`DepositReceipt`: exactly **218 bytes** including discriminator;
`SHA256("account:DepositReceipt")[0..8]` = `40af18b78a6d464e`.

| Inclusive byte offset | Field | Encoding |
|---|---|---|
| 0–7 | discriminator | 8 bytes |
| 8–39 | depositor | Pubkey |
| 40–71 | mint | Pubkey |
| 72–103 | vault | Pubkey |
| 104–135 | config | Pubkey |
| 136–167 | recipient_core | bytes[32] |
| 168–199 | scope | bytes[32] |
| 200–207 | nonce | unsigned u64 little-endian |
| 208–215 | amount | unsigned u64 little-endian |
| 216 | refunded | canonical bool (u8 0/1) |
| 217 | bump | u8 |

The vault is an **SPL Token legacy account**, 165 bytes, *not* an Anchor account.
Its `mint` is bytes 0–31; `owner`/authority is bytes 32–63;
`amount` is u64 LE at 64–71; initialized state is at byte 108. The
Token Program owner must be `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`.

The on-chain `TransferChecked` call verifies exact base units, matching mint
and decimals; `total_active` uses checked u64 arithmetic. Vault balance
is required to stay >= total_active. This is *not* proof of backing for
Holochain credit: depositors can always refund and no issuance is authorized.

## Source-derived layout fingerprint (NOT an IDL checksum)

Canonical UTF-8 text (two lines, separated by exactly one LF, no trailing LF):

```text
BridgeConfig|114|admin:pubkey,mint:pubkey,scope:bytes32,paused:bool,total_active:u64le,bump:u8
DepositReceipt|218|depositor:pubkey,mint:pubkey,vault:pubkey,config:pubkey,recipient_core:bytes32,scope:bytes32,nonce:u64le,amount:u64le,refunded:bool,bump:u8
```

SHA-256 of that string:
`b0ecd68cd1c39075a63ab7615b7c1eff98486be398bc4e55b3206397e40ece1f`.

This is a **source-based interface fingerprint**, distinct from the actual
verified generated IDL and ELF hashes documented above. Do not substitute it
for artifact/source equivalence or production trust.

## Remaining cross-lane acceptance gates

SOL has now supplied the generated IDL, the **localnet-only** public program ID,
actual source-binary/IDL hashes and two finalized RPC account fixtures. The
standalone SOL build and validator integration suite **PASSED** as documented
in `tests/solana/VERIFIED_LOCALNET.md`.

**Still required for OBS #8:** run its v2 `@solana/kit` PDA derivation and
`isNative` tests against this exact IDL and the above *real* account bytes
in a fully combined checkout; confirm noncanonical addresses and substituted
mints/accounts are rejected. Verify an actual `getTransaction` inclusion
record and scanner behavior separately in S1/S2. Localnet RPC `finalized`
is not independent cryptographic proof of Solana consensus. Do not enable
credits: `creditEligible: false` remains mandatory, and refunds remain possible.

SOL offline serialization checks: `tests/solana/layout.test.mjs`.
SOL actual validator tests: `tests/solana/integration.test.mjs`.
