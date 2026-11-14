# SOL #12/#19 — disposable demo source domain (audit-only)

Status: **CANDIDATE; new exact-head real-validator CI and separate SEC review required.** No SOL program/custody changes; the historical green PR #50 at 640714a14ba338c615cf2ada55ca4166646a2d96 and its original known-07-scope fixtures remain unchanged.

## Contract for Agents 1, 3 and 4

The fourth isolated validator mode demo-domain creates a new disposable classic SPL mint (freeze authority absent) and derives its 32-byte scope from **the current local validator's actual genesisHash**, generated-IDL deployed program ID and actual freshly minted public SPL address:

    scope = SHA256(
      UTF8("HSC/demo-localnet-source-scope/v1") || 0x00
      || ASCII(genesisHash) || 0x00
      || ASCII(programId) || 0x00 || ASCII(mint))

The source domain is reproducible **from the exact archived execution**, not equal across freshly reset ledgers. Never reuse lifecycle scope 07 x 32 or initializer-attack scope 2a x 32. The existing tests and their original fixtures are preserved.

The demo executes an actual initialize, deposit of 250000 exact base units with nonce 42017 and SHA256-derived 32-byte audit recipient, rejected duplicate receipt nonce, and an actual refund. All signed witnesses and original finalized getTransaction/getBlock RPC responses are archived; four-account active and refunded snapshots are separate observations, not exact archival bank state.

The **original CI artifact for the NEW SHA** will include:
- target/localnet-evidence/demo-source-domain.json (schema HSC/demo-solana-source-domain/v1): sourceCommitSha, generated idlSha256/elfSha256, postSyncSourceSha256, genesisHash, programId, mint, config/vault/receipt/depositor, scopeHex and actual initializedScopeHex, recipientCoreHex, nonce, amountBaseUnits, three original signature/slot and original RPC witness-file pointers.
- target/localnet-evidence/sprint1-demo-domain-transactions.json: original submitted signed transaction wires and matched finalized getTransaction/getBlock; NEVER substitute later RPC account data for the original signed wire.
- demo-domain-active-receipt.json, demo-domain-refunded-receipt.json and their original raw getMultipleAccounts RPC sidecars (receipt/config/vault/mint).
- All four literal economic fields: creditEligible:false, independentConsensusVerified:false, spendableBaseUnits:"0", withdrawalAuthorized:false; historyComplete:false and economicAuthorization:DENIED.

The manifest is generated only after all validator operations and the final signed-wire archive complete; no literal fresh scope or generated manifest should be checked into Git.

## Execution

In a fresh checkout with the pinned Agave 4.1.2 / Anchor 1.2.2 / Rust 1.95.0 environment:

    bash tests/solana/localnet-build.sh

The temporary SOL workflow runs strict syntax/unit checks, existing three real validator scenarios, the new demo-domain real validator, both original signed-witness and demo-domain independent verifiers, copied adversarial tampering and retained-ledger restart. After execution, replay in the same checkout:

    node tests/solana/verify-witness-bundle.mjs demo-domain
    node tests/solana/verify-witness-tamper.mjs demo-domain
    node tests/solana/verify-demo-domain.mjs
    node tests/solana/verify-demo-domain-tamper.mjs

The extra verifier independently checks Ed25519 original signed init/deposit/refund, exact initialize scope bytes bound to generated IDL, exact nonce/recipient/amount, the containing original base64 blocks, generated ELF/IDL/source binding and original finalized four-account RPC snapshots. It proves a localhost RPC **claim**, not independently authenticated Solana consensus or complete history.

**Agent 3:** Use the manifest's actual genesisHash/programId/mint/scopeHex and the original deposit/refund signed wires in v2. Never assume fixed 07/2a scope. Active and refunded snapshots do not prove exact historical refund bank state.

**Agent 4:** Bind our own disposable audit-only DNA to the executed Solana scope/config/receipt plus exact Holochain app/cell and authorized Lair signer. Reject changed scope/DNA, known placeholders, missing source proof or any economic mutation. Do not call published Unyt coordinator; source-to-WASM/capability approval remains blocked. Proposal shared in PR #34 before modifying any fixture. No RAVE files changed.

**Agent 1:** Pin exact new SOL SHA/artifact; copy genuine original witnesses and all raw sidecars into same-SHA CI. Do not treat a digest or selected containing blocks as consensus, finality or exhaustive history.

## PR #47 historical archive interface

PR #47 provides a **candidate** observer-original-two-provider-history-v1 producer that obtains original two-provider getBlocks enumerations and full getBlock for EVERY produced slot. This new demo-domain transaction archive can be its original submitted-wire input with explicit required deposit/refund signatures. The producer output must still be independently checked by Observer verifyArchivedHistory and cannot manufacture a trusted coverage token. The historical 52 selected containing blocks are NOT an exhaustive produced-slot archive.

Missing genuine two-operator complete archives, historic ALT state, independent rollback-resistant checkpoints and exact refund-state reconstruction remain explicit. First initializer can still capture config; refundable collateral is NOT eligible for credit; custody upgrades/governance are not approved.

## Historical provenance kept

PR #50 source SHA 640714a14ba338c615cf2ada55ca4166646a2d96, real Actions run 43599879389, job 132462160988, artifact 14116560514, original ZIP SHA256 d936e415bf54ed0708ee19122a2d50a411357ffd86043603fbd3537d6900e5c0, 256/256 internal hashes, 54 original Ed25519 wires, 52 selected containing blocks, 87 named negative error-class checks; generated IDL SHA256 e75ebec0fc9fd5f5bbb50bc2d81e6c8b1216bdc17f1f5f798383f370cac5dcf5 and ELF SHA256 74a6743d59fbf9b1907c9358515b3617b07ce37e4d683fb91088167bd7c1eae6. Earlier failed runs remain failed.

Agent 5 must independently review this NEW source SHA, original artifact, requested SEC-38-1/2/3/4 error classes, ProgramData/ELF and supply-chain provenance. The implementation-author identity cannot review itself. **Gate C NO-GO**: no economic RAVE, spendable credit, withdrawal or production deployment.
