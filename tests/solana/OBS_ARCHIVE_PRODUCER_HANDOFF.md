# SOL -> OBS original produced-slot archive handoff (P0, test only)

**Current status: archival producer supplied, but two-provider historical gate BLOCKED. SEC Gate C NO-GO.**

Verified SEC-38 source remains separately frozen at PR #43 SHA f9d65f1935f679d0052e19bc23960d5b2461452d, Actions run 43592157300, job 132438982232, artifact 14112679385, ZIP SHA256 d001f67b581ba61ca671f5caa5f6a54bf612328e887eeec72ba26b57bc2f5879. Its internal 255/255 file digests match. The 54 signed witnesses are **selected transactions, not all produced slots**.

The standalone Node 22 producer is **tests/solana/produce-history-archive.mjs**. It produces original raw RPC envelopes, an OBS-compatible observer-original-two-provider-history-v1 **candidate** and a gap-marked handoff. It never claims two URL aliases as independent consensus.

## Genuinely available archival RPCs

Use known deployment/start and finalized endpoint. Keep each range <= 4096 slots, and use a fresh empty output directory. Do not put provider API tokens into output artifacts.

    node tests/solana/produce-history-archive.mjs \
      --provider-a-id=providerA --provider-a-operator=operatorA --provider-a-url=http://127.0.0.1:8899 \
      --provider-b-id=providerB --provider-b-operator=operatorB --provider-b-url=http://127.0.0.1:9900 \
      --from-slot=5 --to-slot=300 --out=target/sol-archive-5-300 \
      --witness-bundle=target/localnet-evidence/sprint1-lifecycle-transactions.json \
      --required-signatures=DEPOSIT_SIGNATURE,REFUND_SIGNATURE \
      --refund-pre-json=target/refund-pre/refund-pre-four-accounts.json \
      --refund-post-json=target/refund-post/refund-post-four-accounts.json

**Those example ports do not establish two independent validators.** Two URLs sharing one RPC backend, upstream or operator must be classified dependent. Even genuinely separate operators' RPC agreement does not independently authenticate Solana consensus.

The script captures and hashes original JSON-RPC requests/responses for getGenesisHash, getFirstAvailableBlock, getSlot(finalized), inclusive getBlocks ranges, and complete base64 getBlock for EVERY returned produced slot, including failed/unrelated transactions. Absent slots are **UNCLASSIFIED**, never certified empty. RPC error, pruned result, missing/null block, malformed wire, incomplete transaction and provider disagreement must block OBS acceptance.

The original submitted wires must come from a genuine producer-exported signed witness bundle, not from reconstructed getBlock bytes. Supply explicit deposit/refund signatures in --required-signatures. Unknown original submitted wires stay missing. For versioned address lookups, provide provider-specific --alt-a-json and --alt-b-json containing arrays of historical {slot,contextSlot,lookupTableAddress,owner,commitment,rawBase64,space} from genuine at-slot replay. Current ALT state must NOT be relabeled historical.

## Refund pre and post four-account capture

Capture receipt, config, vault and mint (that exact order) on both sides of a genuine refund while validator is running:

    node tests/solana/produce-history-archive.mjs --capture-four-accounts=pre \
      --provider-a-url=http://127.0.0.1:8899 --provider-a-id=providerA \
      --four-addresses=RECEIPT,CONFIG,VAULT,MINT --out=target/refund-pre
    # Execute actual refund; preserve original submitted signed bytes and signature.
    node tests/solana/produce-history-archive.mjs --capture-four-accounts=post \
      --provider-a-url=http://127.0.0.1:8899 --provider-a-id=providerA \
      --four-addresses=RECEIPT,CONFIG,VAULT,MINT --out=target/refund-post

The JSON preserves the returned context slot, ordered account bytes and original envelope, **not a historical snapshot proof**. Ordinary getMultipleAccounts cannot query an exact past bank or the actual instruction-before/after states. Independent slot-indexed bank replay or checkable archival state proofs are required to certify those exact boundaries; this remains an explicit gap.

## Files and review gate

- **observer-history-candidate.json**: source claim in the OBS history verifier's data contract. OBS must independently verify it; a JSON object from this producer cannot manufacture the verifier's in-process trusted coverage token.
- **produced-slot-handoff.json**: original submitted wires and required identity, raw provenance file names, explicit errors/gaps, and a conservative fullHistoryGate=BLOCKED.
- **rpc/*.rpc.json**, **capture-status.json** and **evidence-manifest.sha256**: raw captures, failures, immutable local checksums. A checksum is not an independent source signature.

For the ordinary single localhost:8899 disposable validator, **partial archive is the truthful outcome**. To unblock full history, acquire actual two-operator archives, all produced blocks, parent continuity, v0 historical ALT and exact refund pre/post evidence, verify with real Solana Kit and independently review finality/checkpoint trust assumptions. Leave first-initializer capture as known negative.

This work does NOT change official SOL #35, SEC-38 review #43, OBS #36 or research-only custody ADR #42. No production deployment, main merge, Holochain spendable credit or withdrawal authorization.
