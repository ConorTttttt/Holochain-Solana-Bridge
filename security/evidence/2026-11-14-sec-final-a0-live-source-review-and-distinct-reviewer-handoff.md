# SEC / Agent 5 — exact-source P0 review and A0 authorization boundary (2026-11-14)

**Technical security assessment only; NOT formal independent GitHub approval, NOT authorization to write, NOT permission to merge.** Connected GitHub user ConorTttttt authored implementation PRs. A separate authorized principal must perform and record the eventual enforceable review. Gate C is NO-GO.

## Immutable source and CI inventory

Checked GitHub source heads and exact run identities on 2026-11-14:

| Lane | PR | Reviewed HEAD | Observed real evidence | Technical disposition |
| --- | --- | --- | --- | --- |
| SEC | #33 | 4b916c426259b91efa3d107d7ed8a4bdbdf059a5 (pre-report) | Existing independent source assessments | SEC report only |
| SEC fixture | #53 | da98cc24f6bda74c4282175c8e2d7cc0d7494f35 | 43602667565: 6/6 success; cross-lane job 132473110587: 176/176, 0 fail/skip | ACCEPT fixture sync only |
| SOL baseline | #50 | 640714a14ba338c615cf2ada55ca4166646a2d96 | 43599879389; original 14116560514 | SEC-38-1/2/3/4 limited technical accept |
| SOL fresh | #55 | c071e4c98e7b2dd04a18374f3792c0a90ce4b284 | 43604140724, job 132475021174 success; original 14118166967 | ACCEPT non-economic localnet origin |
| OBS reviewed v2 | #52 | a2338f965916ffac982527f6dc7696e9c5706345 | 43603678118 shared CI 5/6, cross-lane failure 132475785120 | TEST-ONLY SOURCE REVIEW, v2 signed admission CLOSED |
| Holochain own DNA | #44 | 294c523f8ebbebc6ff499831b07e6a1a0c39255d | No actual own-DNA build/install or signed runtime result | WRITE CLOSED |
| CI integration | #54 | 093a7454a36c3a26cc107b06b1334a289940811e | 43603110341 own-DNA build gate failure / exit 3 | A0 CLOSED |

SEC #53's two and ONLY two changed source paths:
- security/test/ledger-corruption-boundary.test.mjs: Git blob 2d48b411af5bf46d83eb6b7d983e117b4484cdcd.
- security/test/replay-ledger-adversarial.test.mjs: Git blob 945afbeb664272d71bc42699cd6a5a2832491c32.

Agent 1 should import these exact blobs, without weakening observer/src/ledger.mjs, replay, fork, contradictory-evidence assertions, or altering unrelated branches. The successful #53 checkout began at the older OBS #52 source 3c919624ae9cd747501f8cb48a1f12bd8908561c. The *current* OBS #52 head a2338f... has six additional commits and a FAILED cross-lane job against its own old SEC fixtures: both SEC-LEDGER and SEC-LEDGER-CORRUPT throw 'Indexer ledger failed: invalid or authoritative deposit evidence'. **Never claim the 176/176 #53 run exercised current OBS a2338f.** Re-run the current OBS plus exact two SEC blobs on the new combined immutable candidate.

## Fresh SOL #55 original artifact independently inspected

Actual downloaded original Actions ZIP: https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43604140724/artifacts/14118166967

- GitHub API exact source run head: c071e4c98e7b2dd04a18374f3792c0a90ce4b284; event push; completed success; verified in run metadata, not just PR text.
- Original ZIP SHA-256 recomputed locally: 33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018, identical to published Actions artifact digest.
- Original localnet-evidence/evidence-manifest.sha256 independently recomputed: **280/280 unique regular files, zero missing, duplicate or mismatched entries**.
- Original source-commit.txt and domain sourceCommitSha: c071e4c98e7b2dd04a18374f3792c0a90ce4b284.
- Original generated IDL SHA-256: d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007; generated IDL address 387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1.
- Original compiled ELF SHA-256: 13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647. All four raw deployment ProgramData accounts have state discriminant 3 and byte-identical ELF at byte offset 45; Program accounts have state discriminant 2 with a ProgramData pointer. Upgrade authority is PRESENT and reported upgrade slot is 0 in the local validator (not fixed governance).
- Independently parsed each legacy signed wire and shortvec/message header, validated original Ed25519 signatures with the actual signed message key (cryptography Ed25519), matched the exact canonical base64 wire to original getTransaction and its unique original getBlock containing entry, matched finalized slot, blockhash and execution metadata (normalizing ONLY rewards null/empty). Total **58/58 distinct signed originals**: lifecycle 45, initializer capture 4, u64-max 5, new demo-domain 4. Total 56 selected (mode,slot) containing blocks, **NOT exhaustive produced-slot history**.
- Fresh demo genesis BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv; program 387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1; fresh classic SPL mint 3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig.
- Source-derived scope SHA256(UTF8('HSC/demo-localnet-source-scope/v1') || 00 || ASCII(genesis) || 00 || ASCII(program) || 00 || ASCII(mint)) equals 85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7; initialized scope agrees and excludes prior 07/2a placeholders.
- Independently decoded **signed** initialize/deposit/refund instruction discriminators against generated IDL: original initialize embeds exact 32-byte derived scope; deposit embeds nonce 42017, recipient b15cdf711a9c383f25701696276b79f71110ebeefe73cc33b60bd4a9b2dffadb and amount 250000 base units (u64 little-endian); refund has empty data. All three original fees are paid by the documented depositor and original transaction meta.err is null. The fourth signed demo original is a genuine included duplicate-nonce rejection.
- Original active/refunded four-account snapshots match raw getMultipleAccounts sidecar bytes and source identities; these snapshots are *later* RPC observations, NOT original historical bank-state proofs.
- Exact-head validator logs report original four scenarios passing, legacy 29 named tamper classes in each of four modes, eight new demo-domain mutations plus unchanged positive, real restart; original validator test subruns intentionally skip the three non-selected scenarios, so do not claim universal zero skips.
- All original manifest/bundle/snapshot economic fields remain literal creditEligible:false, independentConsensusVerified:false, spendableBaseUnits:'0', withdrawalAuthorized:false, historyComplete:false; economicAuthorization:DENIED.

**SOL #55 disposition:** ACCEPT the *new* signed localnet source-domain and source archive for strictly non-economic fixture replay, separately from previously accepted SOL #50. NOT independent consensus, deployed program governance, globally authoritative history, spendable entitlement, committed collateral, Holochain permission or production signer trust.

**Reproduction:** download artifact 14118166967 via Actions artifact API; verify ZIP sha256; unzip with paths preserved; run from extracted localnet-evidence directory 'sha256sum -c evidence-manifest.sha256'; cross-check generated idl/deposit_prototype.json and deploy/deposit_prototype.so SHA256; parse base64 signed transaction wires and independently Ed25519-verify messages, compare each matching original RPC transaction and containing-block entry, and verify ProgramData bytes (upgradeable loader state 3, executable bytes from offset 45). The source checkout at c071e4c98... runs bash tests/solana/localnet-build.sh, followed by verify-witness-bundle.mjs demo-domain, verify-witness-tamper.mjs demo-domain, verify-demo-domain.mjs, verify-demo-domain-tamper.mjs. Generated genesis/scope must never be replaced with historical literals.

## SEC-38 independent gate dispositions

1. **SEC-38-1 — ACCEPT for signed-wire localnet attribution only.** Exact message signer, payer, instruction, compiled accounts/data and nonce proven by signed message; builder-requested privileges remain builder evidence, not independent original-message commitment.
2. **SEC-38-2 — ACCEPT for required/consistent original archive only.** Missing and contradictory wire negatives refuse. Archive remains selected, operator RPC-supplied material.
3. **SEC-38-3 — ACCEPT for named localnet adversarial error classes only.** 29 source verifier attack classes per mode; v0/ALT historical state and external attestations not proven.
4. **SEC-38-4 — ACCEPT for generated artifact and actual localnet deployment evidence only.** Original IDL, ELF/ProgramData, source and pinned toolchain checks; writable/upgradeable localnet and vendor/supply chain are not independently governed.

All four are scoped technical observations, not an enforceable self-approval or global source finality.

## OBS v2 / A4 typed ABI collision — P0 blocker

Current OBS #52 witness source (a2338f...) has blob observer/src/demo-witness-v2.mjs = 228754b36de37ac5d018a5a5e01e45728bd0f028; v2 outbox observer/src/demo-outbox.mjs = d48003ed9a2cd25ec8876f9fa2f4dff33466d8ba. Production queueVerified is source-owned, re-fetches using Kit, requires locked DepositLedger and pinned sourceCommitSha/IDL, rejects caller-injected history/digests and denies synthetic replay injection unless OBS_ALLOW_ARCHIVED_RPC_REPLAY=1. Reviewed source delivery/reconciliation explicitly raises REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED.

OBS v2 uses root kind solana-observation-demo-v2 and root fields source/proof/destination/witnessDigest, with the complete nested verifiedEvidence, raw original signed RPC wire, whole containing block, full transaction execution metadata, original/later receipt state, nonce, recipient, occurrence, codeVersion and source destination. Its digest is:
SHA256(UTF8('HSC/observer-authenticated-audit-witness/v2') || 00 || UTF8(recursively sorted-key canonical JSON of all fields except witnessDigest)).
Arrays retain order; decimal u64 stays a string; no JSON float amount coercion; minimal legitimate rewards null/[] normalization applies only to execution-meta comparison. Literal *synthetic primitive vector* from OBS test 42 is 739a4609392bc5ab76ba1e8b438d3f51eb72344a22ecdae88c323218aa185e91; it is not an actual production witness.

A4 #44 holochain/demo/ABI_V2_REVIEW_PROPOSAL.md instead specifies root source/witness/proof/destination/bindingDigest with domain HSC/solana-audit-demo-v2/source-to-dna, different naming, field projections, destination fields and digest. This is **NOT byte-equivalent to OBS v2**. A4 source Rust/coordinator/HAM is *still only v1*, requires evidenceOrigin='test_only_fixture', rejects reviewed OBS provenance, and has no record_observation_v2. The A1 #54 v2 note is also only a proposal. Do not convert OBS origin JSON labels to a capability or silently drop source, block, receipt, epoch, destination or CellId.

**Freeze requirement:** A3/A4/A1 must ratify one exact **full** v2 Serde/JS schema, single authoritative sorted-UTF8 canonicalization + agreed digest/domain (or explicitly named nested digests with non-colliding purposes), byte-for-byte independent fixed vectors in JS and Rust, canonical original signed-wire-byte SHA256 and source-to-destination binding. Destination must be obtained from installed app identity and contain full CellId, exact agent/external Lair signer, DNA/hApp/WASM hashes, function and ABI SHA; never sourced from untrusted observer JSON. A4 must implement an explicitly new ABI, keeping v1 fixture-only. Unknown fields, inconsistent source epoch/ProgramData upgrade identity, mutable rehashing and wrong build tuple must refuse before write. **Current v2 signed admission: BLOCKED.**

## Attack boundary assessment (current code vs required runtime)

| Adversarial case | Current evidence / missing proof |
| --- | --- |
| Forged caller JSON / asserted finality | queueVerified refuses auth shortcuts and production re-fetches; direct JSON or arbitrary v2 self-hash is NOT authenticated source. |
| Attacker recomputes mutable plain SHA256 | Internal binding checks catch contradictions, but an internally consistent hostile operator rewrite can be rehashed; independent Solana verification/trust is absent. |
| Changed signed tx / block execution metadata | Original Ed25519 and signed block-entry/transaction comparisons enforced in SOL archive, OBS v2 internal metadata checks; same-SHA current production Kit replay negatives pending. |
| Wrong source epoch / changed ProgramData | SOL ProgramData upgradeable and program identity exists, but A3 v2 source lacks independently agreed immutable deploymentEpochId binding; an upgraded program requires explicit source epoch policy. |
| Wrong DNA or signer / forged CellId | OBS destination has appId/dnaHash/agentKey/role/zome; no actual installed v2 CellId, external Lair runtime or independently pinned function authorization. |
| Occurrence replay | Ledger/outbox tests deny same-author conflicting source/occurrence; separate journal or separate Holochain authors can accept same event; global uniqueness unproven. |
| Lost ACK / restart | Local mock persists pending -> uncertain before writing, rereads exact record, no blind resend. Reviewed v2 write is deliberately DENIED. |
| Conflicting readback | Mock conflicting ActionHash/data/denials HOLD; no real conductor v2 ActionHash/typed readback evidence. |
| Hostile journal rollback | Replacing with intact old file can regress acked -> pending. HOSTILE_FILE_ROLLBACK_UNPROTECTED; no independently operated monotonic checkpoint. |
| Refund history forgery | Caller coverage Boolean in lower-level ledger is not trusted B1 admission; produced-slot exhaustiveness, refund historical state and durable revocation not demonstrated. |

Two RPC URLs are not independent consensus or genuinely independent operators. Local canonical SHA256 is an integrity commitment, not attested Solana finality, source epoch governance or authority to mint.

## Own-DNA exact-head runtime inspection and function restrictions

A4 **current HEAD 294c523f8ebbebc6ff499831b07e6a1a0c39255d**, not the older c7964607... in its PR text, adds source-only bootstrap-locks.sh, refines build.sh, and adds a standalone [workspace] to ham-adapter/Cargo.toml (one further manifest-only commit after 7572859...). Both holochain/demo/Cargo.lock and holochain/demo/ham-adapter/Cargo.lock still return GitHub 404/missing; no tracked lock hash. DNA YAML still includes DEMO-ONLY-REPLACE network seed and old 07 placeholder scope. No compiled WASM digests, DNA/hApp bundle digests, Holochain DNA hash, installed app, full CellId, actual agent, external Lair signing, read-only on-conductor negative result, or genuine Holochain ActionHash. Script validates pinned HAM revision fbb4b6eb8a79a507e9453b709ed00f15c5618fb4 and CapGrantOptIn::Withheld in source only. Source coordinator exports get_contract, get_observation, list_observations, record_observation (v1 only); v2 function absent. No capability grant opt-in, no published Unyt coordinator, no economic function may be authorized.

A1 PR #54 exact HEAD 093a7454a36c3a26cc107b06b1334a289940811e own-DNA build workflow run 43603110341 job 132471965436 **FAILED exit code 3** at immutable source preflight: buildInputsTracked:false, no actual locks/own-DNA source in that combined checkout. Other green shared/integration checks cannot override this failure. No actual on-conductor read-only or write proof exists.

## Authorization decisions kept separate

| Gate | Decision (2026-11-14) | Reason |
| --- | --- | --- |
| Milestone A, fixture-only audit write | **NOT AUTHORIZED** | No built installed own DNA, signer, CellId, compiled binary hashes, exact fixture/capability grant tuple or real read-only runtime negatives. |
| Milestone B, genuine reviewed OBS v2 evidence | **NOT AUTHORIZED** | A4 v2 typed ABI differs from A3, no actual v2 zome, identity-authenticated runtime or independently approved source delivery. |
| A0 non-economic end-to-end | **BLOCKED** | No one immutable source SHA executed the fresh SOL signed-wire producer -> OBS production queueVerified -> durable v2 outbox -> approved HAM/Lair write -> genuine ActionHash -> typed readback and restart/conflict negatives. |
| B1 historical completeness | **BLOCKED** | Selected 56 blocks are not produced-slot complete two-provider archive, refund historic bank state or independent signed checkpoint. |
| B2 original Unyt integration | **BLOCKED** | Released coordinator source-to-WASM equivalence, legitimate ABI/role/capability and safe invocation not reviewed. |
| C economic bridge | **NO-GO** | Deposits remain refundable; first-initializer capture/upgrade authority; no governed nonrefundable custody, independent consensus, liability conservation, trusted signer quorum or withdrawal one-use scheme. |

Root, source and proof economic denial fields must always be creditEligible:false, independentConsensusVerified:false, spendableBaseUnits:'0', withdrawalAuthorized:false. No custody changes, spendable issuance, withdrawal signing, published Unyt mutation or main merge.

## Independent reviewer release package — requires a DIFFERENT authorized GitHub principal

Reviewer must obtain the *actual* final immutable integrated candidate and independently inspect:
1. Source SHAs for SOL #55, OBS #52 current, SEC #53 exact two blobs, A4 actual v2 implementation, and A1 same-SHA integrated candidate; compare per-file hashes rather than PR summaries.
2. Original signed Solana ZIP 14118166967 SHA256 above, original 280/280 manifest, 58/58 Ed25519 signed wire and 56 selected block checks, IDL SHA256, ELF/ProgramData SHA256; check fresh source scope, nonce, recipient, original refund and all denial flags.
3. A3/A4 one canonical v2 schema, domain/digest vector, source epoch, full unprojected witnesses, proof limitations, destination provenance and negative test matrix. Demand production queueVerified with actual @solana/kit and immutable DepositLedger at the same integration SHA.
4. Both reviewed Cargo.lock bytes/sha256, pinned HAM/Lair dependency graph and licenses, built WASM sha256, DNA/hApp sha256, actual hc dna hash, installed app ID, audit role, exact CellId=(dnaHash,agentPubkey), operator/signer agent, external Lair credential ownership; CapGrantOptIn::Withheld and zero unexplained grants.
5. Read-only actual-conductor identity/ABI negative matrix **before** considering any write. Explicit per-function allowlist: only new reviewed demo-only record_observation_v2 once separately approved; no credit/RAVE/write/grant/withdraw or original Unyt calls. Legacy record_observation is fixture-only, not a reviewed source v2 path.
6. Distinct signed verdicts for **Milestone A fixture-only** vs **Milestone B reviewed source**; A cannot be re-used as B. A runtime approval, if ever granted, must list exact source commit, binaries, app, DNA hash, full CellId, agent, external Lair signer, zome/function, ABI, fixture schema, allowable purpose, deadline/revocation and independently attributable reviewer identity.
7. Verify real same-SHA source→OBS→durable outbox→HAM signed own-DNA ActionHash→typed readback/restart/replay/conflict, with genuine artifacts and refusal negatives all produced by **one** immutable candidate; record workflow SHA, IDs and SHA256. Refuse aggregation across green unrelated branches.
8. Record all per-gate dispositions separately; do not issue GitHub APPROVE from implementation-author account, and do not authorize B1, B2 or C from demo results.

This report is a review/handoff, not independent reviewer credential proof, production Solana finality, an exact-source Unyt authorization or release permission.