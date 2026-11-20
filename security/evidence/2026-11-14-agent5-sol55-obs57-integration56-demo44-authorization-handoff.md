# Agent 5 — exact-source security decision and independent reviewer handoff

Date: 2026-11-14 (UTC). Lane: security #10/#15/#21. **NO MUTATING AUTHORIZATION; economic Gate C NO-GO.**
Connected GitHub principal: ConorTttttt. That principal is the implementation author and **is not an independent authorized reviewer**. This document records an executed read-only technical review, not a human-independent signature, Holochain capability or permission.

## Exact evidence and status

| Lane | Evidence SHA | Actual result |
| --- | --- | --- |
| SEC #33 | 49d224686b8c93dd65268a7c7354e9e0a18db109 (pre-report) | Security branch; no write authorization |
| SEC #53 | da98cc24f6bda74c4282175c8e2d7cc0d7494f35 | Run 43602667565 shared CI 6/6; 176/176 cross-lane |
| SOL #55 | c071e4c98e7b2dd04a18374f3792c0a90ce4b284 | Run 43604140724, job 132475021174 SUCCESS; original artifact 14118166967 |
| OBS #57 | 38847cf1399c59fd1a1665c8bef2249479d7da03 | Newest reviewed branch state; newer run 43630245420 was running when checked. Prior run 43627513044 5/6, two SEC fixtures failed. |
| A1 #56 | b7379764f9ba7b20c2e72898df73e181c8ec2380 | Same-SHA SOL original + production Kit Observer admission PASS; Holochain build FAIL, installation SKIPPED |
| A4 #44 | 990bd4e4d67d0f5f4ab8851ee1397be3ca62f20a | v1 fixture-only Rust/HAM, later documentation revisions; no proven own-DNA build/install/write |

### Independently executed original byte audits

1. **SOL #55 original 14118166967** ZIP SHA-256 33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018. Original 280/280 internal manifest entries match. Generated IDL d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007; ELF 13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647 and exact deployed ProgramData bytes. Independently recalculated config/vault/deposit PDAs; decoded original complete signed wire, checked Ed25519, instruction data, unique containing-block occurrence and metadata, and raw four-account snapshots. Signed initialize slot 10, deposit slot 42, included rejected duplicate slot 74, refund slot 75. Genesis BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv; program 387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1; scope 85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7; nonce 42017, amount 250000 base units, recipient b15cdf711a9c383f25701696276b79f71110ebeefe73cc33b60bd4a9b2dffadb. Original deposit signed-wire SHA-256 7dd4f34251059c1c13f01c29087ac1e619111a4bc65910de62210c9a77ba02bc. Active vault and totalActive 250000; later both zero and receipt refunded. Source run reports 29 named tamper cases and 8 scope negatives, **not re-executed in this independent audit**. **LOCALNET SOURCE ACCEPT only**; selected containing blocks are NOT complete produced-slot history or independent consensus. ZIP expires 2026-11-28.

2. **A1 same-SHA integration** 43627399927: original localnet job 132546266432 success; Observer job 132550193067 success. Original integration source artifact 14126184156 ZIP SHA-256 39b7cca589bfb40425f4975cd50a98e80764f0b34c78e10cccd91d8610de9c41; independent 268/268 internal manifest, Ed25519 original initialize slot 11, deposit slot 43, refund slot 76, IDL/ELF/ProgramData, three PDAs and original account snapshots pass. **Different live localnet**: genesis G7wbD5BJhHTFjqF51zTTKJKUo7CVSmws7v7p1mqtcq7H; program 7in44ykL5jMTydhPBwmiDbjWZT5tevHGuVRWWKBn9eC8; scope 18ccb0177178b9668f12f2c6d6c0582ab1918cb7673ec1c150315cd63b471999. The integration cross-lane artifact 14127143551 ZIP SHA-256 983d0ef4d32031326838aa67bee0fb0760413f7f62218cea0c82f329d06bdea6, 176/176 pass and 0 skipped. Actual log says FRESH_DEMO_DOMAIN_ORIGINAL_KIT_V2_QUEUED_NOT_DELIVERED; HISTORY_INCOMPLETE; REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED. There is **no Holochain ACK or ActionHash**. This is source/Observer admission ACCEPT, not Holochain delivery.

## Observer ABI / adversarial decision: CHANGES REQUIRED

Reviewed OBS code blob f6638a2bf78595cf0581dc16d23bc08f8dc359d0 (initial v2 review source; later branch adds duplicate raw JSON key guard and six pinned primitive vectors, not signed ingress). Observer typed proposal binds source, original canonical A3 witness JSON, raw four-account RPC sidecar, digest commitments, destination full ordered CellId and literal denials. Synthetic canonical primitive has length 1484, unsigned SHA 97c3f9f018b74d7f91c4c44e65d26d5c18697abc1172394eca1c8578033f68ec, destination-binding SHA 206c010fae05f66b0b3e807a39e97bc869a851e6e7799d2ab0962cadec42ca5e, domain HSC/solana-audit-demo-v2/source-to-dna + NUL. **Synthetic self-hashes are not source authentication or authorization**. A4 actual Rust coordinator implements v1 record_observation **only**, evidenceOrigin=test_only_fixture; it cannot receive A3 authenticated reviewed v2. No cross-language actual Kit witness vector / compiled v2 function.

Required production negative matrix: forged original source identity; nonce/recipient/amount and source epoch changes; contradictory RPC/block metadata; recomputed attacker self-hashes; wrong installed app/DNA/CellId/agent/function or binary digest; duplicate occurrence/replay; lost ACK and crash between send/readback. Test on actual source/real conductor, not only synthetic transport mocks. Require independent trusted producer admission, raw preimage retention, source ProgramData epoch, exact destination read-only binding, mutually reviewed Rust/TS ABI and fail-closed persistence. No independent Solana consensus proof.

OBS #57 previous run 43627513044 failed SEC legacy replay-ledger-adversarial.test.mjs and ledger-corruption-boundary.test.mjs, both 'Indexer ledger failed: invalid or authoritative deposit evidence', cross-lane job 132549458525 exit 1; those SEC fixtures pass on a **different exact integration SHA**. Never combine unrelated green results.

## Holochain build/runtime: BLOCKED

Integrated required Holochain workflow 43627400018: build job 132546342739 FAIL **exit 3**, installed-DNA job 132546418209 **SKIPPED**. Missing tracked WASM and HAM Cargo.lock, exact source scope / ABI review. Separate dependency bootstrap 43627399999 artifact 14126981827 (ZIP SHA 160f9e9d7dd142af6e4cd8e949a4529eec22bcc4db2b8ead5e0f77852cdad5d5) generated unreviewed Rust 1.95.0 lock proposals, **NOT compilation**. A4 later committed the WASM lock (Git blob 6a0a3da541a6c1333d56367994725e64b2e295a4) but HAM native lock was not present when inspected. A4 dna.yaml binds **old archived SOL #55 BvMf/387eq/85738 scope**, not the new integrated G7wb/7in44/18ccb execution. No actual two reviewed Cargo.lock builds, WASM hashes, DNA/hApp bundles, installed DNA hash, full CellId, external Lair read-only identity, withheld grant runtime refusal, signed write, genuine ActionHash, typed readback, restart/replay evidence. Do not substitute historical RAVE/Unyt conductor success.

## Two separate decisions and reviewer requirement

**Milestone A — fixture-only Holochain audit write: BLOCKED.** Proposed *non-authorizing* allowlist after independent scoped approval: own disposable 0.7.1 audit DNA; role audit; coordinator solana_audit; function record_observation; v1 test_only_fixture deposit only. Need reviewed immutable source, both locks, exact source-matched compiled WASM/DNA/hApp SHA, actual installed DNA hash and full ordered CellId, external Lair signer/agent identity, CapGrantOptIn::Withheld, no implicit grant, specific complete canonical payload and digest, and an attributable independent human/security reviewer. **Not permitted now.**

**Milestone B — authenticated Observer v2 write: BLOCKED / CHANGES REQUIRED**, independently of A. Need Milestone A prerequisites PLUS a lossless compiled v2 ABI, trusted authenticated production ingress and source epoch, unchanged original raw witness and RPC sidecars, actual installed destination binding, signed HAM transport, action/readback/ACK and restart/lost-ACK/idempotence tests, and an entirely separate call-scoped independent approval. Milestone A never automatically grants B.

**Exact Holochain mutating tuple: UNPOPULATED / NOT APPROVED.** Require immutable source SHA, native/WASM/bundle/ABI hashes, installed DNA hash and CellId=[DNA,agent], signer and external Lair config fingerprint, app/role/zome/function, complete typed payload canonical bytes and SHA, capability policy, explicit approved operation and expiry; before a call ActionHash cannot be fabricated.

**Independent reviewer needed:** a separately authorized reviewer who is **not** ConorTttttt or an author/principal of the implementation. Must independently authenticate exact source, binary, installed cell, agent and payload and record per-call signed authorization. An automated review under implementation-author credentials does not satisfy this.

**A0 full demo BLOCKED; B1 BLOCKED** (not full produced-slot history); **B2 BLOCKED** (no Unyt released coordinator source equivalence/capability); **Gate C NO-GO** (no independent consensus, externally anchored hostile-ledger rollback protection, irrevocable collateral, custody governance, released Unyt coordinator mutation). No main merge, economic deployment, issued credit or withdrawal.

Mandatory literal: creditEligible:false; independentConsensusVerified:false; spendableBaseUnits:"0"; withdrawalAuthorized:false.

This file is a technical security report only, not an implementation-author self-approval.
