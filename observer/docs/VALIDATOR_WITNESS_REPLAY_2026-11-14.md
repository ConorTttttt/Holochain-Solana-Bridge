# OBS #36 — genuine validator witness gap and authenticated recovery proposal

**Date:** 2026-11-14 UTC. **Status:** P0 BLOCKED / draft; read-only shadow research. No issuance, withdrawal, production deployment or independent-consensus claim.

## 1. Actual artifact examination (do not substitute synthetic wires)

The integration snapshot at commit `cd4ab8dd61ec7353b330ba4a55f1d0ac5f5a9bf0` ran Actions [`43529253005`](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43529253005). Downloaded genuine ZIP artifacts:

- `integration-localnet-evidence-NO-KEYS`, artifact `14087460958`, archive digest `sha256:88c66481d34ea6fa901b21aee460ca15864ec07d00523b6593b8decab5650eae`.
- `integration-cross-lane-js`, artifact `14087710464`.

The localnet archive contains `target/idl/deposit_prototype.json` SHA-256 `ea6f78383e6fa9148a560f628fb7648bacede90388a4951c1f158f71c2b2cf83` and `target/deploy/deposit_prototype.so` SHA-256 `8162421ae2dd56927510d381bbe6c70ce760750e6d53ce2f02683ef106439928`, both genuine CI-built, alongside finalized account RPC snapshots at slots 17, 64, 102 and 136. The program ID for this **new disposable validator** is `B8WpDXUeH96FiWYmhqwpF3Hf4MKNagM5XpZJtaVuPvF`, genesis `6BYNMyYg7zCt3y9NMz9CvE9HyhqQDmrNwkjyv4vqh6je`. These differ from older OBS fixtures: **never combine evidence from different ephemeral validator runs**.

Positive receipt-account RPC snapshots show executable program ownership, classic SPL vault/mint bytes and PDA derivations at the observed slot; they cannot demonstrate the signed transaction or bank history that created the receipt. The expanded real local-validator lifecycle aborts in the multi-wallet test with on-chain `Custom 6004` (`MintFreezable`) and the evidence-saving function is not reached. Therefore the downloadable ZIP has **no** `sprint1-*-transactions.json` manifest, **no** complete `getTransaction-base64-*.rpc.json` and **no** `getBlock-*.rpc.json`. This blocks independently replaying transaction identity, SPL CPI, exact pre/post balances, rejected signatures, block inclusion and historical checkpoint restart.

The separate 55-test Observer run in the cross-lane suite **passed 55, failed 0, skipped 0** with the real pinned Kit SDK. It covers existing synthetic signed wires and genuine account snapshots but **not validator-backed signed-wire creation**. New OBS code below is committed after that integrated result, and therefore is NOT part of the 55/55 tested SHA.

**Subtle wire-format incompatibility:** SOL `tests/solana/integration.test.mjs` presently captures `getBlock(...,{encoding:'json',maxSupportedTransactionVersion:0})`. OBS full-block Ed25519 policy needs an **additional** `getBlock` with `encoding:'base64', transactionDetails:'full', commitment:'finalized', maxSupportedTransactionVersion:1`. JSON-only block entries cannot be transformed into authentic signed wire bytes. SOL #35 and CI #37 were notified without modifying their lanes.

## 2. New fail-closed SDK replay intake (OBS-owned)

`observer/scripts/replay-validator-witness.mjs` now consumes **only archived Solana RPC responses**, independent pinned deployment bindings and exact generated IDL/ELF bytes. It refuses:

1. Absent per-scenario transaction manifest; missing successful or included rejected signatures; missing/invalid original JSON-RPC response; JSON-only containing blocks; missing signed base64 transaction; unsupported versions; noncanonical base64 or inconsistent RPC execution/slot/block metadata.
2. Manifest, generated IDL or compiled program hash not matching the trusted **out-of-band** deployment binding; different source commit, genesis or disposable program ID across account snapshots, transaction manifest, IDL and the witness.
3. Any forged required Ed25519 signature, including failed or unrelated transactions in a claimed full containing block: it reuses the unchanged indexer verifier (exported as `signatureOf`) for **every entry** in every supplied block. It compares JSON/full-base64 block membership and matched transaction bytes, versions and metadata.
4. Successful target instruction with wrong depositor/nonce, PDA, generated Anchor IDL discriminator, token transfer CPI, exact source/vault balances, scope or Holochain recipient: it uses existing real-SDK `verifyDepositCandidates`, `verifySnapshot` and `attachReceiptObservation`. A real finalized four-account snapshot must match the candidate receipt and pinned config/vault/mint; no keys are required or exported.

This is **single-deposit provenance replay**, NOT the complete historical indexer. A finalized block reported by RPC is an RPC assertion, not a consensus proof. The replay does not advance the ledger checkpoint. Refunds in later transactions remain an **unresolved lifecycle condition**: successful refund instructions encountered by the full indexer still cause a fail-closed halt. This script does not establish that an already-observed deposit is unrefundable.

Example trusted operator manifest (values intentionally placeholders, never fill from an untrusted candidate without independent deployment binding):

```json
{
  "genesisHash": "<pinned validator genesis from same tested run>",
  "programId": "<pinned deployed program ID>",
  "sourceCommitSha": "<40 hex chars from tested checkout>",
  "idlSha256": "<64 hex chars from independently pinned IDL>",
  "elfSha256": "<64 hex chars from independently pinned deployed SBPF ELF>",
  "trustedDeploymentSlot": 1,
  "expected": {
    "program": "<same programId>",
    "mint": "<pinned classic SPL mint>",
    "config": "<pinned canonical config PDA>",
    "vault": "<pinned canonical vault PDA>",
    "scope": "<32-byte hex Holochain scope>"
  }
}
```

After SOL has captured a **complete** run, from a fresh integration checkout with the pinned npm dependencies installed and the matching public IDL/ELF:

```sh
NO_DNA=1 npm --prefix observer ci --ignore-scripts
NO_DNA=1 npm --prefix observer run check
NO_DNA=1 npm --prefix observer test
node observer/scripts/replay-validator-witness.mjs \
  target/localnet-evidence lifecycle \
  trusted-localnet-deployment.json \
  target/idl/deposit_prototype.json \
  target/deploy/deposit_prototype.so \
  '<successful finalized deposit signature>' > /tmp/solana-deposit-shadow-evidence.json

# CI/RAVE owns the target binding and shadow adapter; the Observer never
# invokes issuance. Run only in integrated checkout including RAVE's code.
node holochain/test-only-adapter-cli.mjs trusted-rave-binding.json \
  < /tmp/solana-deposit-shadow-evidence.json
```

**Required output:** adapter verdict `quarantined`, `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:'0'`, `withdrawalAuthorized:false`. Negative/replayed/conflicting evidence must be rejected. The Node-only OBS test `observer/test/validator-witness.test.mjs` checks structural rejection of the already available genuine account-only archive, mismatched IDL digest and unpinned program, **not** a fictitious signed-wire success. Full command execution for the new script against the actual SDK and genuine wire is pending the missing SOL capture.

## 3. What the indexer still needs for durable validator-backed replay

To claim `indexFinalizedRange` history acceptance, CI must additionally archive both providers' complete `getBlocks` produced-slot enumerations from trusted deployment slot, all corresponding **base64 full getBlock** responses, finalized genesis/tip/first-available-block checks, all historical containing blocks and matched four-account snapshots at the indexed observation slots. A transaction-only set of blocks is **not** gap-free. The current two-provider equality check is not proof against collusion, shared RPC upstreams, withheld produced slots or a fork; preserve the separate independent archival/gap-monitor gate.

With the actual bytes, tests must exercise: first indexing; abruptly killed process; deliberate operator recovery after stale-lock investigation; checkpoint+1 replay; duplicate delivery; repeated receipt observations; same receipt with changed origin; contradictory blockhash/parent; omitted enumerated block; malformed any-block required signature including failed transaction; pruned history; corrupted ledger; refund. **Never advance the checkpoint over invalid history.** Existing synthetic checks cover these state-machine invariants; genuine local-validator runs have **not** yet exercised them.

The SOL runner uses CLI 4.1.2 and records legacy/v0 transactions with `maxSupportedTransactionVersion:0`. Retain OBS legacy/v0/v1 decoding and numeric `maxSupportedTransactionVersion:1` on reads. Genuine v1 generation needs a separate reviewed 4.2+-capable validator/feature gate; do not relabel a legacy transaction as v1 or change the pinned SOL toolchain silently.

## 4. Persistence-integrity review — SEC-assessment proposal, not implemented authority

SEC's actually executed `security-ledger-corruption.log` (same integrated run) has 3 passing subtests: unsynchronized bit changes are detected; a local administrator can replace the unkeyed persisted blockhash/checkpoint; and an attacker with write access can edit evidence plus recompute its ordinary SHA-256 fingerprints. This is expected: the fingerprint is stored in the **same editable JSON**; it detects accidental corruption, not a malicious write, rollback or independently authenticated consensus. Atomic rename/fsync and exclusive lock prevent partial writes/concurrent accidental writers but do not resist a privileged file attacker.

**Proposed independently reviewable checkpoint-anchor protocol:**

1. Define a canonically encoded and strictly versioned, domain-separated `OBS_CHECKPOINT_V1` record containing pinned genesis/program/mint/scope/IDL/build identity, deployment slot, last finalized slot and blockhash, digest of sorted receipt+occurrence records, previous anchor hash, monotonically increasing sequence, validator/source-provider observation identity, signer-set epoch and explicit `creditEligible:false` / `independentConsensusVerified:false`. Use deterministic canonical CBOR or RFC 8785 JSON and stable byte-level test vectors; **never** sign unordered JSON.
2. Publish each anchor to an **independent append-only / retention-locked store** and obtain a threshold of signatures from externally controlled hardware-backed reviewer keys, with public-key roster and rotations pinned outside the ledger. Prefer independent systems/administrators and explicit quorum rules. One local service holding all signing keys does not defend against the threat.
3. Write local checkpoint atomically, then request/sign/publish the corresponding external anchor. Treat an unanchored local advancement as **provisional only**. A crash between local write and external anchor is recovered by replaying from the last externally verified anchor, not by accepting the unanchored cursor as authenticated.
4. On restart, retrieve the latest trusted anchor **from independent storage**, verify signature threshold, signer epoch, immutable sequence, previous-link continuity, field bindings and inclusion/receipt digests. Reject local state that is rolled back, rewritten, ahead of the trusted anchor without replay data, or inconsistent. Recover only from independently preserved full blocks plus receipt history; when recovery data is missing or provider history conflicts, **halt for human review**.
5. Threat-test: recomputed SHA after unauthorized edit; complete rollback to older valid JSON; branch/fork block substitution; forged signature; missing/rotated reviewer; anchored-head replay; withheld archive; mid-commit crash; anchor publication failure; mirrored adversarial provider. Require SEC independent review and recovery runbook before treating anchoring as a checkpoint-integrity defense.

**Scope limit:** a threshold-signed hash of RPC data authenticates the signing reviewers' checkpoint decision, **not Solana consensus**. The signers must independently verify history or clearly disclose reliance on correlated RPC claims. These anchors cannot make refundable custody nonrefundable or authorize Holochain credit, and cannot prove deployed DNA/fork finality. No change to economic authorization is proposed.

## 5. Ownership and acceptance state

- **SOL PR #35:** fix observed `MintFreezable` lifecycle failure without weakening program checks; emit public-only, true finalized transaction wire and complete base64 block archives, with successful/rejected signatures and exact hashes.
- **CI PR #37 / #32:** preserve build/test source SHA and archive allowlist; execute new OBS replay and strict current-head tests with the actual SDK; test historical backfill and restart on *contiguous* real block captures; run RAVE shadow CLI and publish results.
- **RAVE PR #34:** verify schema handoff and stay shadow-only, with no economic authority transfer.
- **SEC PR #33:** audit the independent checkpoint proposal, all required signer checks and refund/rollback threat assumptions.

**Gate:** leave #36 draft. Current genuinely proven output is 55/55 previously integrated Observer tests and real account-snapshot verification, not a completed validator-backed signed-wire/indexer/shadow end-to-end test. Full source+runtime provenance is still required.
