# A1 source-domain decision — first genuine audit demo (review candidate)

**Decision:** DYNAMIC SAME-RUN DISPOSABLE SOURCE DOMAIN. Do **not** substitute the archived PR #55 validator identity into a new disposable validator execution.

**Status:** A1 implementation candidate only. Requires review by A2/A3/A4/A5. Not Holochain write approval, economic authorization or proof of independent Solana consensus.

## Immutable source and evidence chain

1. The genuine SOL job runs the validator and produces `target/localnet-evidence/demo-source-domain.json`, generated Anchor IDL/ELF, signed initialize/deposit/refund wires, original finalized containing-block/account RPC responses and full public source archive manifest. It binds `sourceCommitSha` to its executed Git HEAD.
2. The cross-lane consumer downloads original bytes from the *same workflow run* and executes the real @solana/kit signed-wire/ledger/outbox verifier. Its success includes a persisted **pending** witness and explicit `REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED`, **not** a Holochain acknowledgement or complete source history.
3. A separate CI job depends on **both** successful jobs and downloads their original same-run artifacts. It verifies original archive manifest entry, exact original source domain JSON embedded in OBS output, original signed deposit identity, executed producer SHA, Observer consumer SHA, generated IDL/ELF digests, and all four economic denials.
4. The A1 CI binding script derives `holochain/demo/dna.yaml` genesis/program/mint/initialized scope plus a deterministic public network seed from those original bytes. It saves original Git-tracked DNA template, derived ephemeral checkout YAML, source and replay SHA-256s and producer/consumer SHAs separately. **It never commits an unrelated source domain into A4's static DNA.** Valid source properties alone do not imply compiled or installed DNA.
5. Build only from reviewed exact A4 source blobs plus *both* committed lockfiles; compile locked native HAM + integrity/coordinator WASMs, package real DNA/hApp, and preserve hashes. Missing native lock fails the required job.
6. Install the own disposable app and read back genuine complete CellId and DNA hash via Admin API. The temporary sandbox's *in-process* Lair is **not** proof of an external HAM/Lair signing preflight. An independently reviewed external signer remains blocked.
7. The seven-stage report may promote runtime installation only after actual evidence; independently authenticated exact binary/cell/signer/zome/function/payload approval is required before any mutating zome call. Stages 4–7 remain blocked without it. There is no capability grant, Holochain economic call, Unyt coordinator mutation or fabricated ActionHash.

## Explicit SHA distinction

In this first same-SHA demonstration, `sourceProducerCommitSha` and `observerReplayConsumerCommitSha` are separately captured and required to equal the exact integration checkout. This equality is a **same-run execution policy**, not permission to rewrite historical producer provenance. A future frozen archival replay needs a separately reviewed producer/consumer provenance ADR.

## Source-owner handoffs

A2: original genesis/program/mint/scope and signed wires. A3: strict lossless v2 witness and incomplete history. A4: reviewed *native* `holochain/demo/ham-adapter/Cargo.lock` matching standalone workspace and actual build/ABI. A5: independent exact-call approval, external Lair, capability refusal and security gate. No agent's branch or main is modified.

**Mandatory denials:** `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. **Gate C: NO-GO**.
