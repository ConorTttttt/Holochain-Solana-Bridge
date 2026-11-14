# A4 source-bound disposable DNA properties — first independent archive review

**Date:** 2026-11-14. **Source candidate only; not a finalized own Holochain build or independent consensus.**

## Exact immutable source
- SOL PR #55 HEAD: `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`.
- Actual Rust 1.95.0 + Anchor/SBPF + four-mode local-validator Actions run: `43604140724`; SOL job `132475021174` **SUCCESS**.
- Source artifact `14118166967` (`solana-localnet-verification-evidence`); downloaded ZIP SHA-256 `33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018`, matches uploaded Actions SHA-256.
- Downloaded archive contains `localnet-evidence/demo-source-domain.json`; file manifest has **280/280** distinct entries present, all SHA-256 checks pass, and no unlisted `localnet-evidence/*` file other than the manifest itself. Two separate build outputs `idl/deposit_prototype.json`, `deploy/deposit_prototype.so` were checked directly against domain-declared hashes.

## Source-derived identity (selected example, not an installed Holochain CellId)

| Attribute | Actual inspected bytes / identity |
|---|---|
| genesisHash | `BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv` |
| program | `387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1` |
| mint | `3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig` |
| holochainScope | `85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7` |
| IDL SHA256 | `d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007` |
| ELF SHA256 | `13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647` |
| source SHA | `c071e4c98e7b2dd04a18374f3792c0a90ce4b284` |
| initialize transaction / slot | `2mk39P1WRM3YTSM9N2G414NUtm1P3mThEiMEUytHB5ZnAiTy2LEzGVQ1niY8QULhWW5X2z9QQXuJJXtXxhjQ1JLn` / 10 |
| deposit transaction / slot | `4ibizpAzc2BmXAMhoPy15KmrvREnQMXcDp3QZszMGJL8wmWnNLG8GhKVbPjiLCMpS98k6c5GnpDCCuMdUkPeKETp` / 42 |
| refund transaction / slot | `2fYdaQQ9SMDrFQfHShT27zgKfF9sa8fEPwiQ6dUxfE6jd1DayvLzj59qiAYykzXFNyAi3A7JvUyAWKoxeahEenQX` / 75 |
| amount / nonce | `250000` base units / `42017` |

### Independent byte checks

From each of the three original archived base64 `getTransaction` response objects, decoded legacy signed wire and verified its first Ed25519 signature against the message and first signer key (using Python `cryptography` verification), verified signature base58 matches the domain manifest, `result.slot` matches, and the outer instruction program key is the expected program ID. **The full signed initialize instruction data is** `afaf6d1f0d989bed` + the 32-byte exact `holochainScope`, so the scope is authenticated by the archived signed message, not fabricated from a manifest label. Original receipt and account RPC snapshots are also present; this exercise does **not** independently reproduce all A2 verifier proof checks or establish full chain history.

The DNA `network_seed` is fresh *public* disposable identity `hsc-audit-demo55-0a2c4d3d6dedf0dab61496349f61d9cd`. This changes the Holochain DNA hash at pack time; it is **not** a Lair key, secret or proof of an operating Solana validator. The archived source is a stopped disposable localnet, not production.

## Absolute stop gates
- The four literal denials remain `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`.
- **No own WASM/DNA/hApp hashes, no real `hc dna hash`, installed `CellId`, external Lair signer, audited ActionHash, signed write, or runtime readback** at this note's commit.
- Source publication by SOL and our archive checks are not independent Finality/SEC approval. PR #55 requires separate Agent 5 review; current collateral may be refunded and produced-slot history is incomplete. Do not accept refund as a v1 record.
- Existing v1 is solely `test_only_fixture`; v2 reviewed transport remains disabled. Never call `record_observation` or `record_observation_v2` before independent **exact** source + lock + artifact + app + CellId + signer + ABI + payload review. No published Unyt coordinator or economic mutation.
