# Agent 4 — authentic archived Solana domain inspection (14 November 2026)

**Status: READ-ONLY ARCHIVE EVIDENCE, NOT A BUILD OR DEPLOYMENT ATTESTATION.**
Source: Agent 1 integration PR #49 at immutable commit `a51e3354c74fbb61cd30a1ab6e41ed9da6211a40`, run [43594685052](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43594685052), artifact **14115074724** (`integration-localnet-evidence-NO-KEYS`). Downloaded GitHub Actions ZIP SHA-256 **`0ca07661a64a07e8b60b7dd86b93b81e85711652a9d00a2bdb73ebaf512acb92`** in this inspection. GitHub's published transport hash and individual original file hashes are different evidence layers; this is still one operator's local RPC testimony.

## Actually inspected, not inferred from a sample DNA manifest

Locally extracted the immutable archive; checked all **239/239** files in `target/localnet-evidence/evidence-manifest.sha256` against their recorded SHA-256, zero missing/contradictory entries. Cross-checked `active-receipt.json`, raw original `lifecycle-getMultipleAccounts-active-receipt.rpc.json`, packed `target/idl/deposit_prototype.json`, and `target/deploy/deposit_prototype.so`. IDL address equals archived program ID; receipt discriminator/layout agrees with IDL; four queried account bytes/owners agree with snapshot; receipt's mint/vault/config references match the exact account addresses. Checked classic SPL token-program ownership. A mutation of the archived receipt snapshot is rejected by the manifest digest; no ledger/wallet secret material was imported.

| Field | Archived local-validator value |
|---|---|
| Source commit | `a51e3354c74fbb61cd30a1ab6e41ed9da6211a40` |
| Genesis (RPC claim) | `5b7MXSeacLs8Zohvotk9heccnFz4oe1m8EaZ96QedRf2` |
| Program | `CH6xQMem263nvqHPKUg1bkPfQoxfFHXpzgefSfo4XMDZ` |
| Mint from raw receipt | `8tasqJZVTNFTjiMytSo2XHXt6Se1xQmjn3E3MgwtCXeP` |
| Receipt PDA | `3jMUHiTMZqdZ8LHgeTCDaEgybKhnJAQjgw1VUmxgBu7u` |
| Scope from raw receipt | `0707070707070707070707070707070707070707070707070707070707070707` |
| Nonce / amount | `42017` / `250000` base units |
| Archive snapshot slot | `22` |
| IDL SHA-256 | `f591dcbfc09536a64a6a1d424002342d36a714397730e8722217bd4ff1824d15` |
| ELF SHA-256 | `fb9efcb09c6b4252fcc02cf046fae7ae03d0d7cbccc8c3f111aacd1c65f38c7f` |

The **0x07 repeated scope is authentic in this executed older localnet receipt but is ALSO the known example/synthetic scope intentionally refused by `holochain/demo/build.sh`**. It must **not** be copied into the new demo DNA, and program/genesis/mint from this stopped ephemeral validator must not be silently reused as live runtime coordinates. Do not substitute made-up source values or claim archive verification proves independently verified Solana finality.

## Reproduction and missing acceptance evidence

Download original artifact ID 14115074724 from the run, preserve ZIP bytes and SHA-256, extract to a disposable directory, verify `sha256sum -c evidence-manifest.sha256` **from inside `target/localnet-evidence`**. Decode the first 218-byte `DepositReceipt` at `active-receipt.json.accounts[0].dataBase64` using the provided IDL (8-byte discriminator; 32-byte depositor/mint/vault/config/recipient-core/scope; two u64 LE; refunded bool; bump). Compare four account bytes to the original `getMultipleAccounts` RPC JSON.

**Required new A2/A1 handoff:** run a *fresh* controlled disposable classic SPL validator with a separately generated non-example 32-byte scope, preserve actual genesis/program/mint/receipt, signed wire, idl/ELF, four-account snapshot and complete source hash manifest. Sign off its exact immutable source revision. Only then select a fresh non-placeholder Holochain network seed, generate *two real* Cargo locks on the networked Rust 1.95.0/Holonix runner, commit them, and attempt `--locked` native/WASM compilations. **No current own-DNA WASM/DNA/hApp hash, installed CellId or external-Lair result exists.**

Mandatory non-economic denials at every future boundary:
`creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`.
**No `record_observation` permission. C NO-GO.**
