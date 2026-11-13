# Localnet build / validation guide

**No on-chain build has been run by the authoring environment.** This is the next reproducibility task, not a completed test. Commands may need adjustment to your installed Anchor/Solana toolchain.

1. Install Rust, Solana CLI, and a compatible Anchor CLI. The source is pinned to `anchor-lang = =1.2.2` and `anchor-spl = =1.2.2`; use Anchor CLI 1.2.2. Verify versions with `rustc -V`, `solana --version`, `anchor --version`.
2. Configure a local validator: `solana config set --url localhost` and run `solana-test-validator` in a separate terminal.
3. Generate a **new program keypair locally** (do not commit private keys). Example:
   ```bash
   mkdir -p target/deploy
   solana-keygen new --no-bip39-passphrase -o target/deploy/deposit_prototype-keypair.json
   anchor keys sync
   anchor build
   ```
   Inspect `declare_id!` and `Anchor.toml` to confirm that `anchor keys sync` replaced the placeholder with your actual key.
4. Deploy only on localhost: `anchor deploy --provider.cluster localnet`. Verify the program ID and upgrade authority. Do NOT change `provider.cluster` to mainnet or devnet as a shortcut.
5. Create a disposable test SPL mint using the classic Token Program and **no freeze authority**, fund a test wallet, derive `["config"]` and `["vault", mint]` PDAs, and call `initialize` to establish the only supported mint and a nonzero 32-byte Holochain scope.
6. Call `deposit` with a unique nonce, exact base-unit amount, and nonzero 32-byte recipient core. Query the receipt PDA `["deposit", depositor_pubkey, nonce_le_bytes]` and vault.
7. Run the read-only observer with your expected localnet genesis, program, config, vault, mint, receipt and scope. Ensure the output is `active_refundable`, `creditEligible: false`.
8. Call `refund` as the original depositor. Run the observer again and ensure it reports `refunded`, `creditEligible: false`. A second refund MUST fail.
9. Attempt deposits when paused, duplicated nonces, wrong mint, wrong signer, zero recipient and zero amount. Confirm all fail without partial state changes.

## Tests still to write and run with a validator

- Integration test for all lifecycle steps above, including atomic rollback on failed SPL transfers.
- Token balance and `total_active` reconciliation across simultaneous deposits and refunds.
- PDA derivation and account discriminator conformance using generated IDL.
- Program upgrade authority monitoring and tamper tests.
- Local validator restart, RPC faults, chain rescan and receipt-update detection.
- Solana v1 transaction ingestion (`maxSupportedTransactionVersion: 1`), before any future transaction scanner.

No generated keypairs, wallet private keys or mnemonic phrases are included in this archive.
