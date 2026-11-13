# Solana → Observer S0 account contract (PROVISIONAL)

**Status: source-derived only; NOT a verified generated IDL.** Source reviewed at
`programs/deposit_prototype/src/lib.rs` on 2026-11-13. Neither Rust/Anchor/Solana
compilation nor local validator execution was available. OBS must not accept this
file as deployed-program/source equivalence evidence. Generated IDL handoff is
**BLOCKED** until `anchor build` succeeds and its artifact is reviewed.

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

## Serialized layout derived from Rust

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

This is a **provisional source-based interface fingerprint**, not a hash of
a generated IDL, compiled binary or deployed program. Recompute and replace
after actual compilation and human review.

## Blocked verification/handoff gate

After a genuine build, OBS and CI should receive `target/idl/deposit_prototype.json`,
the localnet program ID (public only), exact command/tool versions and binary
hash, and the generated IDL's account schema/discriminators. Check all the
above against generated metadata and live account bytes. Do not fabricate an
IDL or label the source-derived schema verified.

Offline serialization compatibility exercises are in
`tests/solana/layout.test.mjs`; validator tests are
`tests/solana/integration.test.mjs`. Neither test can prove chain finality,
and `creditEligible: false` stays mandatory.
