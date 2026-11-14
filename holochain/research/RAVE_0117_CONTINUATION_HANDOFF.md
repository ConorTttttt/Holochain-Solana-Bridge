# Agent 4 continuation — Unyt v0.117.0 provenance, ABI and OBS shadow handoff

Date: 2026-11-14 UTC. PR #34; issues #14 and #18. Status: DRAFT / STOP SHIP. This is an engineering evidence handoff, not production or economic authorization.

## 1. Verified source baseline and exact inspector CI command

GitHub Actions run 43573374250 at immutable previous RAVE HEAD e2c4a4d82bb091d847db49c5ab343f10229a0806 passed all five jobs: publisher-signed Sandbox v0.117.0 release, RAVE 0.15.0 pinned Rust host tests, pinned Holonix/Holochain 0.7.1 hApp/DNA/WASM inventory, actual disposable conductor install/restart and read-only admin identity checks, and 39/39 test-only shadow regressions. This success does NOT cover subsequent RAVE commits. Inspector and new negative runner were not wired into the existing workflow; CI is Agent 1's lane.

Original public Unyt release (publisher-key minisign verification, not independent signing-key attestation):
- unyt.happ SHA-256: 0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1
- alliance.dna SHA-256: 918c3eb1a96c5cf00d0ca5af60f675e32a561857225883059276581c7e45aa71
- SHA256SUMS SHA-256: 7736dee1f1d3867f99ec4098f7a30e2f9ba44475c2127191e55720fdf49f6f6f
- SHA256SUMS.minisig SHA-256: ee846f0cb6ca17289c82de2dc15235c7eb1b3a2985f018f9b546ed4dfc7dd490
- coordinator transactor.wasm SHA-256: 8337488fcff06e8d1b37f68bc8dc2a14a33492769bce1fdb183406ae032c770d
- integrity transactor_integrity.wasm SHA-256: 1bcbf9993e5695247d9c54c7b3ee1cbd825cf4167606ee6af3691a39d01a68ab
- installed local Sandbox DNA hash: uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ

Previous genuine WASM inventory: successful Actions run 43536513700, artifact ID 14090070860, ZIP SHA-256 26796385a34f35b7d5f20f389b770d79b442178a3c314194ae061dac6e3cfe. This ZIP digest is limited to THAT artifact. The downloaded real release WASMs had 121 coordinator function exports and 8 integrity function exports, plus one memory each. Previous standalone bit-flip tamper on genuine integrity WASM exited 2 with BLOCKED_UNYT_EXPORT_INVENTORY: transactor_integrity: untrusted WASM bytes (SHA-256 mismatch). No guest code was instantiated.

Agent 1: after the *same pinned SHA* release verification and Holonix unpack, execute these from repo root, without editing these commands or skipping negative cases:

    node --version
    sha256sum ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm
    node tests/holochain/sandbox/inventory-verified-unyt-wasm.mjs ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm > ci-artifacts/verified-unyt-export-inventory.json
    node tests/holochain/sandbox/assert-verified-unyt-wasm-inventory.mjs ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm 2>&1 | tee ci-artifacts/verified-unyt-inventory-test.log

The SHA-locked inspector is PRESERVED at tests/holochain/sandbox/inventory-verified-unyt-wasm.mjs. The new assertion runner checks the true positive metadata, known candidate export names and two deliberate negatives: modified integrity bytes and swapped WASM positions. Expected positive exit 0 and negative sub-process exits 2 with SHA-256 mismatch. A missing artifact, changed byte digest, unexpected count or failed negative MUST fail. Preserve command output, exact revision and SHA digests as CI artifacts. This NEW runner has not itself yet been run against genuine WASM bytes on CI.

## 2. Exact Unyt source and capability provenance request

The connected authenticated GitHub API returned 404 for unytco/unyt-app. Public unytco/unyt-sandbox v0.117.0 .gitmodules confirms git@github.com:unytco/unyt-app.git and its exact release submodule gitlink is d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf. A later main branch gitlink cannot substitute for release source. A 404 could mean private, removed or inaccessible; it is not proof that source never existed.

Request to legitimate Unyt build/release maintainer (NOT externally sent or answered):
1. Grant controlled read-only access to immutable exact submodule SHA and recursive submodules, or a signed, auditable exact-source archive with independently verifiable maintainer identity, archive digest and signed source-to-published-WASM equivalence. Do not disclose keys.
2. Give reproducible source-to-WASM build steps: full Cargo.lock, dependencies/patches, Rust compiler and WASM target, HDK/HDI ABI, flags, build profile, env inputs, build container/toolchain digest, postprocessing, expected byte-identical hashes, and two independent verifier builds for BOTH zomes.
3. Provide coordinator/integrity externally callable ABI versus callbacks/host-wrapper inventory: exact function/zome names, input/output serialized schemas, errors, read/write side effects, hooks, entry/link definitions, integrity validation and countersigning/warrant semantics.
4. Supply signed audit-only approval, legitimate caller agent public key/role and function-scoped Holochain 0.7.1 capability rules (explicit grant versus author key), optional capability secret handling, membrane policy, revocation and intended read-only call inputs/outputs. No arbitrary grants.
5. Document Sandbox release DNA versus actually deployed test/production DNA, modifiers, seed, properties, epoch, governance and network identity; exact locally installed Sandbox hash does not prove deployment.
6. Provide source-backed ParkedLinkStanding, recovered-commitment duplicate/replay, fork/partition/rejoin, source-chain restore and migration semantics before any financial validation.

Source equivalence, ABI, legitimate capability and deployed network identity remain BLOCKED.

## 3. Export names are not read-only authority

The 4 actual coordinator WASM function exports under static review are: whoami, get_status, get_parked_link_standing and get_recovered_commitments. For EACH: observed signed-release binary export = YES; verified external callable ABI = NO; verified harmless read-only semantics = NO; known authorized caller/capability = NO; real runtime zome call executed = NO.

The tentative lowest-scope candidate for Agent 5 review would be whoami on the disposable author's OWN cell, only after the maintainer supplies source-equivalent semantics, precise no-write ABI, a valid caller and explicit audit-only approval. Even an empty input object is UNAPPROVED until the ABI confirms it. get_parked_link_standing and get_recovered_commitments should not be treated as harmless due to their economic domain. Do not call any candidate, create new capability grants or infer safety from naming.

## 4. Actual runtime and two-conductor prerequisites

ACTUAL: published signed Sandbox hApp, one Holochain 0.7.1 conductor installation, restart of same persistent sandbox, read-only Admin API list-apps/list-cells showing enabled alliance role and matching installed DNA hash and local agent key. No coordinator call occurred. Network mem is requested, but generated config retains public dev bootstrap/relay URLs: no socket-level network isolation is proven. Lair socket token is redacted, and no keystore/database is uploaded.

NOT ACTUAL: two independently keyed conductors, real Unyt source-chain validation/countersigning, DHT convergence, fork/partition/rejoin, parked state and recovery replay, agreement replacement, source-chain restore, DNA migration or finality. Published RAVE 0.15.0 crate-host tests and test-only shadow models do NOT prove these.

Real two-conductor plan prerequisite: independently generated distinct Lair keys and agents; physically separate protected sandbox directories and source-chain DBs; identical exact audited DNA/seed/modifiers; source-equivalent authorized harmless API; controlled transport and verified outbound socket/packet isolation; reproducible peer discovery, gossip and convergence; pinned Holochain 0.7.1; instrumented source-chain validation, restart and partition; logs scrubbed of tokens and keystores. Do not share key files, reuse one source chain as a second conductor, or claim an unobserved partition/rejoin.

## 5. OBS PR #36 v1 denial contract and RAVE shadow classification

Agent 3's immutable denial schema handoff: d25e1c950eec567e66953a98678a7045c23af9e5. All newly emitted OBS receipt observations, candidate transactions and combined deposit evidence carry literal creditEligible=false, independentConsensusVerified=false, spendableBaseUnits='0', withdrawalAuthorized=false. A valid combined observation matches its nested snapshot for identity, program/mint/recipient/scope, nonce, exact decimal u64 amount, bumps, slot and refund. Signed-wire claim additionally binds transaction hash, signature, canonical outer instruction occurrence, CPI path and transaction version.

RAVE now rejects missing or contradictory denial flags at both envelope and nested receipt levels. It also rejects observed conflicting same-slot account digests, changed signed-wire hashes or occurrences, duplicate occurrences across receipts within one journal, unsafe instruction indices, state rollback and invalid precision. All shadow outputs remain zero-spendable with withdrawals disabled; accepted RPC observations are QUARANTINED, not spendable. Original u64 strings are preserved with BigInt checks, never rounded through JS Number. Additional TEST-ONLY six-decimal math guards explicitly reject unknown SPL mint decimals, non-integral scaling and signed-i64 overflow; they assert no unit equivalence.

OBS transactionVerified=true is a LOCAL verification under RPC claim; RAVE does not independently verify Solana consensus, has no durable global replay store, and does not bind economic authority from user-supplied source/IDL/ELF without a separate trusted capture manifest. A refunded deposit is still non-economic. Independent Map journals can each quarantine the same event: they DO NOT enforce global anti-double-spend. The adapter does not contact a conductor, issue credits, execute transfers or authorize withdrawals.

## 6. Handoff / security gates

Agent 1 (CI): run new inspector assertion after genuine SHA-checked unpack; verify all 5 existing jobs at the new RAVE SHA; archive hashes/version/negative stderr without leaking Lair tokens. No edit to the CI-owned workflow in this PR.

Agent 3 (OBS): deliver genuine finalized signed Solana transaction and complete containing-block evidence under independently pinned genesis/program/mint/scope, deployment epoch, source commit, generated Anchor IDL and deployed ELF; include refund contradictions. This stays NON-ECONOMIC input.

Agent 5 (SEC): review only a documented ABI-backed proposed harmless whoami call, authentic caller grant and effects; independently review new exact denial flags, signed-u64 math boundaries, refund/contradiction and cross-DNA replay. Do not approve coordinator execution from export-name observation alone.

Unyt maintainer: satisfy items in section 2. Issues #14 and #18 stay open, PR #34 DRAFT. No spendable credit, transfer, withdrawal, production DNA equivalence, or economic finality authorized.
