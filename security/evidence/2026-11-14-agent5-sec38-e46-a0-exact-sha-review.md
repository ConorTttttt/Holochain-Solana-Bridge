# Agent 5 — exact-SHA SEC-38 and A0 security disposition (14 November 2026)

**Security workstream disposition: SEC-38-1/2/3/4 ACCEPTED ONLY as disposable, non-economic Solana localnet witness-verifier test evidence at SOL #50 `e46c7228561150a4368c80d3e9a300184bb8f0d2`. Milestone A audit write NOT AUTHORIZED; Milestone B authenticated Observer delivery NOT AUTHORIZED; A0 REJECTED; B1/B2/C NO-GO.** This is a review report, not an independent-account GitHub APPROVE, production attestation, or authorization to merge or move funds. The authenticated repository account also authors implementation PRs; a *different authorized reviewer identity* must independently inspect and approve each proposed exact scope.

## 1. Frozen live GitHub source identities

Checked live PR metadata on 2026-11-14, and checked PR #33 head again before publishing:

| Lane | PR | Exact head checked | CI evidence actually belonging to that head |
| --- | --- | --- | --- |
| Security | [#33](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/33) | `20a210d4252ba30fe37b41016b248151eeb4bb1b` (pre-report) | Security workstream report; **not independent-account approval** |
| Solana | [#50](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/50) | `e46c7228561150a4368c80d3e9a300184bb8f0d2` | Actual [run 43598373582](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43598373582), one real-validator job 132457641164, **success** |
| Observer | [#48](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/48) | `220d5aa314c5b154608af24dea8b0af5c1ed6053` | **No matching workflow runs returned** by head-SHA Actions query; static source and synthetic/mock tests reviewed |
| Own audit DNA | [#44](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/44) | `681049a30bffc2bca45a40b0e88519e98053e083` | **No matching workflow runs returned** by head-SHA Actions query; source documents explicitly report missing native and WASM builds |
| Integration | [#51](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/51) | `1c4bd936e82a759c53fe3fd9d6916b4adca245ff` | Same-head [shared 43597279497](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43597279497) 6/6, [cross-agent 43597279450](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43597279450) 3/3, [RAVE 43597223494](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43597223494) 5/5, **all success, but not an A0 pipeline** |

**No laundering across SHAs.** #51 pins older upstream SOL/OBS/RAVE sources in `ci-integration-snapshot.json`; it does **not** integrate #50 SEC-38-3/4, #48 outbox, or #44 new DNA. Its signed-wire OBS tests prove the source it actually checked out, not later source heads. The RAVE 5/5 tests install a verified **published Unyt release** in a disposable conductor, not the own-DNA/HAM signed audit runtime. Head-SHA success cannot substitute for the missing own-DNA stages.

## 2. Independently checked original SOL #50 Actions artifact

Retrieved the **original** [Solana Actions artifact 14115951312](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43598373582/artifacts/14115951312), not a PR screenshot. Independently hashed the ZIP bytes:
`sha256:5930cf561af50e7e7a85460cbea3c41aa66417f6f8fd2927f38579b398255e2d` (agrees with uploaded digest). Examined its `localnet-evidence/evidence-manifest.sha256`; **256/256 listed files exist and match**; no duplicated archive paths. Original `source-commit.txt` equals `e46c7228561150a4368c80d3e9a300184bb8f0d2`.

A *separate local Python/cryptography inspection*, reading original base64 JSON-RPC transaction/containing-block files, not invoking the implementation verifier, parsed the signed messages and verified every required Ed25519 signature, first signature identity, selected containing-block inclusion, slots, blockhashes and transaction error status:
- Lifecycle: **45** finalized transaction wires; **43** distinct containing blocks, **88** block-entry signed wires checked.
- Init-capture: **4** finalized wires; **4** blocks, **8** block-entry wires.
- u64-max: **5** finalized wires; **5** blocks, **10** block-entry wires.
- Totals: **54** finalized transaction wires; **52** selected blocks; **106** block-entry signed wires. This is **not exhaustive produced-slot history**; the program controls/records which selected blocks are archived. Cryptographic signatures validate the original wires, **not** validator finality or the RPC's historical truth.
- Independently decoded each mode's upgradeable-ProgramData account and hashed its 221,624 ELF bytes: all three equal recorded deployed ELF `sha256:d6e4884b5cdef9520b8d0b4570f2c6b875a57c453439fcb2fe95fcf24c8cbde8`. The archived IDL hash is `14a8828a5cdeee5fefce3338d73773d011876fb786fcd067c8d9ddcfea5d422c`. The independent byte comparison does not audit source-level economic semantics or prove a governed production upgrade authority.

Actual job log 132457641164 contains three isolated real-validator modes, real ledger restart/reconstruction, each pristine verifier control, and **29 named mutation refusals per mode (87 negative executions)** with expected failure classes. Run is genuinely green. The per-mode runner intentionally SKIPs the two other isolated scenario tests before executing them in their own modes; one separately marked OBS `COption` test is SKIPPED on this SOL-only branch because the OBS module is absent. **Those skips are not accepted as passing OBS coverage or as A0 integrated evidence.** The separate synthetic signed-message fixture tests provide structural v0/no-ALT, re-signed malformed-index and privilege-union cases.

Pinned source/supply chain evidence: real `cargo check --locked`; root Cargo.lock SHA-256 `9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5`; generated IDL, SBPF/ProgramData, tracked pre/post `anchor keys sync` patch; Rust 1.95.0, Anchor v1.2.2 via pinned `8d9d1488d9b8af41b266d7513eea2e668adf15a2`. The new temporary workflow checks the upstream Agave v4.1.2 release archive against **pre-pinned SHA-256** `5991d027a686eb419a709a479178b33eb83501e8a2bfbf599a81a286bfcbf770` **before unpacking or running it**, rather than executing an unhashed shell installer. The expected digest derives from the upstream publisher's release metadata; independent publisher-account/governance attestation and full dependency/build-chain reproducibility remain outside this localnet test acceptance.

## 3. SEC-38 verdicts, four *separate* decisions at #50 head

| Requirement | Narrow disposition | Direct basis | Exclusions and residuals |
| --- | --- | --- | --- |
| **SEC-38-1** signed-message attribution | **ACCEPT — LOCALNET TEST ONLY** | Original Ed25519 wires, required signer/header, fee payer, compiled indices and effective writable/signing privileges; generated Anchor IDL and restricted SPL instruction-intent comparisons. Independent 54-wire verification. | Requested builder privileges are **not** independently signed as builder intent; multi-instruction privilege union matters; v0 ALT historic lookup unsupported. No validator-independent consensus. |
| **SEC-38-2** original submitted wires | **ACCEPT — LOCALNET TEST ONLY** | Mandatory original `signedWireBase64`, exact finalized `getTransaction` plus `getBlock` equality, wire-missing/malformed/conflicting negatives; 54 archived source wires and 106 containing block entries verified. | An internally consistent malicious RPC/archive can still lie; no exhaustive produced-slot history. |
| **SEC-38-3** adversarial semantic denials | **ACCEPT — LOCALNET TEST ONLY** | Real 87 tamper-case executions + three pristine controls; missing block fields/file/null now `WITNESS_BLOCK_MISSING`, fee payer/header/index signature/class distinctions, duplicates, non-rewards meta contradiction, v0 ALT synthetic refusal and first-failing-invariant cases. | The one skipped OBS-only `COption` case is **not covered** on this commit; actual historical ALT proofs, independent hostile RPC and adversarial governance are not solved. |
| **SEC-38-4** toolchain/build/source/deployment provenance | **ACCEPT — DISPOSABLE LOCALNET TEST PROVENANCE ONLY** | Verified pre-use archive digest; pinned Anchor source, Cargo lock, `cargo check --locked`, tracked sync delta, real generated IDL/ELF and all three deployed ProgramData byte matches, upgrade-authority observation. | Publisher release checksum is not independent code provenance; deployment governor/initializer/upgrade/mint authority risk unresolved; no reproducible independent release build, no production installation authority. |

This upgrades **only SEC-38-3/4's limited localnet test-evidence disposition** relative to the preceding report `security/evidence/2026-11-14-agent5-a0-current-sha-security-gate.md`. It does not grant automatic adoption of #50 into another branch, nor replace distinct reviewer account approval.

## 4. Source review: OBS #48 and own-DNA #44

**OBS #48: implementation progress, NOT admitted authenticated destination delivery.** `observer/src/demo-outbox.mjs` `queueVerified` re-imports the production Kit transaction fetch, source candidate verification and two-RPC snapshot reconciliation in-process, checks the live `DepositLedger`, forbids caller-JSON provenance promotion, binds occurrence/wire/meta/snapshot/destination via canonical domain hashes, uses exclusive journal lock/fsync, persists `pending -> uncertain` before a proposed write, reads before retry, rejects changed fingerprint/source/occurrence and duplicate ActionHash. The 27 declared mock/synthetic regression cases include wrong agent, contradictory remote record, crash/uncertain and intact old-file rollback. No head-matched real-Kit `queueVerified` run, real HAM adapter connection, signed actual readback or host-external monotonic checkpoint was located. `client.preflight()` and `client.read()` can be simulated by a dishonest or mock client; no actual #44 transport is bound. The compact record's SHA256 witnessDigest does not expose its original nonce, recipientCore, signed wire, block bytes or receipt preimages to independent destination validation. **HMAC, local hashes and two URLs are not Solana consensus.** Hostile intact-journal restore is explicitly acknowledged as `HOSTILE_FILE_ROLLBACK_UNPROTECTED`; `acked` is only local/operator-scoped, not global exactly once. A caller-controlled historical coverage input remains unsuitable for B1. Deposit-only v1 has no refund revocation.

**Own-DNA #44: static constrained design, but NO authorized mutating tuple.** Source `holochain/demo/integrity/src/lib.rs` uses strict `deny_unknown_fields`, demo-scoped DNA properties, positive canonical u64, base58 shape, fixed `historyComplete:false`, deposit-only and literal root/source/proof denials; update/delete/link validation denies. Coordinator exposes only `get_contract`, `get_observation`, `list_observations`, `record_observation`; get/list only query the **local author's chain**, not global DHT uniqueness. HAM Rust code pins `unytco/ham@fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`, `LairCredentials::Node`, `CapGrantOptIn::Withheld`, exactly provisioned `audit` cell, full DNA+agent, zome `solana_audit`, and typed readback. No economic zome or published Unyt coordinator call appears in the reviewed own source. The mandatory `holochain/demo/Cargo.lock` **and** `holochain/demo/ham-adapter/Cargo.lock` both return GitHub 404 at this SHA; `dna.yaml` still has `DEMO-ONLY-REPLACE-WITH-FRESH-RANDOM-SEED` and fixture scope. No new compiled WASM/bundle/hApp hashes or actual installed own app/CellId, external-Lair signer, authentic ActionHash, typed readback or restart action proof. Source presence and 36 fixture ABI tests (source-reported) are **not a native/WASM build or Holochain runtime test**.

**Hard ABI/origin collision:** #48 emits `proof.evidenceOrigin:'observer_reviewed_outbox'`; #44 Rust integrity **and** HAM adapter expressly require `'test_only_fixture'`. #51's separate `source/witness/destination` proposal also does not equal #44's strict `source/proof` v1 ABI. **Never relabel a proof as a fixture, drop authenticated fields, or grant a capability to make this pass.** A reviewed new source-authenticated version and independently verified signing boundary are required.

## 5. Separate call-scoped milestone decisions

### Milestone A — fixture-only one-off audit runtime proof: **NOT AUTHORIZED**

A constrained future write may be considered **only after** a distinct reviewer receives an immutable and checked exact tuple:

```text
source commit #44 = 681049a30bffc2bca45a40b0e88519e98053e083 (candidate only)
native HAM + integrity WASM + coordinator WASM SHA256 = MISSING
both Cargo.lock SHA256 = MISSING
packed DNA SHA256; actual Holochain DNA hash; packed hApp SHA256 = MISSING
verified demo Solana genesis / program / mint / scope = MISSING
installed app ID = MISSING; exact CellId=(DNA hash, agent pubkey)=MISSING
allowlisted signer identity / external Lair and nonsecret setup fingerprint = MISSING
permitted role = audit; zome = solana_audit; function = record_observation
schema = solana-observation-demo-v1; origin = test_only_fixture ONLY
CapGrantOptIn = Withheld; no Unyt coordinator or economic functions
valid actual ActionHash, typed readback and restart evidence = MISSING
SEC mutating-call authorization = WITHHELD
```

Even an independently authorized Milestone A fixture write **would not** authorize reviewed-origin production intake, A0 integration, published Unyt calls or an economic entitlement.

### Milestone B — authenticated Observer reviewed-origin delivery: **NOT AUTHORIZED**

Requires a new versioned ABI, source-verified genuine `queueVerified` replay and immutable witness preimages, trust-bound HAM client and CellId/signer, exact-origin intake policy, zero-write tamper tests, typed signed ActionHash/readback/restart and separately reviewed operator trust assumptions. **Do not promote `test_only_fixture` to `observer_reviewed_outbox` by changing a string.**

## 6. Integration PR #51 genuine same-SHA scope and limits

Downloaded and independently hashed original Actions artifacts:
- Local-validator ZIP artifact 14114139850: `sha256:626c88d8ed5f8e50eecba8abb478dd4dc2ab9772fe26eaeb19539d6b1ad53c82`; 239/239 internal localnet manifest files independently match.
- Cross-agent JS ZIP artifact 14115084470: `sha256:552bf573b1f7103b0f807a9252b7bb8304ab5dcc3fecee4b49ff177d64244664`; source-bound `a0-evidence-summary.json` itself says `A0: BLOCKED_NOT_ACCEPTED`.
- RAVE conductor artifact 14114528943: published Unyt **installation/restart**, no own-DNA zome write; reported `sha256:4b0bee3872315181620479c123f2a2149276d29dcfddb9aa50330b99d97eb541` (Actions metadata/log, not separately byte-downloaded in this review).

Cross-lane artifact shows **25/25 offline suites, 176 tests, zero offline skips** and real signed-wire OBS replay three modes; mandatory SOL-mode local-validator witnesses/restart ran. These facts prove useful **S0 and source-only demo** progress but **not** a single combined run of #50 hardening + #48 authenticated outbox + #44 native/WASM Holochain audit DNA. No authenticated outbox transport to an installed own DNA, real HAM-signed audit `ActionHash`, typed restart readback, independent A0 negative matrix or permitted mutation exists at #51. Its own CLI `--require-a0` intentionally exits blocked.

## 7. Formal gates and required remediation

| Gate | Decision | Required independent unlock evidence |
| --- | --- | --- |
| **A0** basic end-to-end non-economic audit demo | **REJECT / NO-GO** | One new immutable combined SHA containing reviewed SOL, Kit OBS, authenticated outbox/v2 ABI, compiled own audit DNA and installed signer, complete approved call tuple; genuinely signed write, ActionHash/typed readback/restart, original deposit/refund observation limits and adversarial no-write assertions. |
| **B1** complete historical Solana evidence | **NO-GO** | Two independently sourced genuine original `getBlocks` produced-slot listings, **every** produced-slot `getBlock`, parent/cross-RPC contradiction checks, historic ALT state or refusal, refund windows, independently declared verifier/operator trust and independently operated monotonic checkpoint if claimed. |
| **B2** original Unyt coordinator | **NO-GO** | Exact released source, source-to-WASM equivalence, deployed hash/CellId, ABI, caller role/capability, side-effect review and independently authorized exact function/signer scope. Public HAM caller code and signed release install are not permission. |
| **C** economic bridge | **STRICT NO-GO** | Governed atomic/authorized initializer, irreversible or committed nonrefundable collateral and conservation, independent verification/finality policy, global replay/fork/partition and rollback, single-use redemption, independent signer quorum/governance, custody/cancellation liveness and separate formal security audit. |

**Mandatory literal denial fields in every A0 model:** `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. No credit, economic RAVE, external token mint, withdrawal, production deployment, main merge or released Unyt coordinator mutation. A0 evidence must visibly label history incomplete, refunded-at-observation and operator/RPC trust.

**Review handoff to distinct authorized identity:** Check exact SHAs and the four linked genuine Actions runs; download and verify ZIP hashes before unpacking; inspect implementation Rust/JS source, original case-specific error output and reviewed-source provenance; execute the [separate negative-test matrix](2026-11-14-agent5-a0-independent-negative-matrix.md); inspect live signed own-DNA identity tuple; decide Milestone A and B **independently and explicitly**, then publish a formal GitHub review under the different account. **Do not infer approval from this report, green checks, authorship or an issue comment.**
