# Agent 5 — PR #58 exact-SHA independent technical security decision (NO CALL APPROVAL)

**Date:** 2026-11-14 UTC. **Lane:** SEC PR #33, issues #10/#15/#21. **Reviewer identity limitation:** connected GitHub principal `ConorTttttt` is an implementation author, so this is a *technical negative-gate assessment*, **not** independent reviewer approval. **No Holochain mutation has been requested, signed, executed or approved here.** Do not merge to main or issue economic credit.

## Immutable reviewed heads (live API read on 2026-11-14)

| PR | Commit SHA | Role |
|---|---|---|
| #33 | `cd65341268ee2b28d03c23b1d257cd200fe9d083` | SEC starting HEAD / pre-report |
| #58 | `2bc6887b1c373311f2fbddea530bd533067dad84` | **subject of this decision**, same-SHA runner |
| #57 | `38847cf1399c59fd1a1665c8bef2249479d7da03` | OBS source-owner draft |
| #44 | `990bd4e4d67d0f5f4ab8851ee1397be3ca62f20a` | A4 current DNA source / v1 adapter draft |
| #55 | `c071e4c98e7b2dd04a18374f3792c0a90ce4b284` | distinct original archival Solana source |
| #56 | `b7379764f9ba7b20c2e72898df73e181c8ec2380` | predecessor integration, **not** this execution |

All are open drafts at inspection; they must be rechecked after any later commit.

## A. Actual original PR #58 workflow evidence — **LOCALNET TECHNICAL ACCEPT only**

Source commit `2bc6887b1c373311f2fbddea530bd533067dad84`.

- Workflow **43630610615** (S0 cross-agent integration) **SUCCESS**. Genuine disposable local-validator lifecycle job **132556147009 SUCCESS**; actual SDK/SEC/OBS cross-lane job **132559667951 SUCCESS**; RAVE published-crate harness **132556147257 SUCCESS**, explicitly **not deployed DNA**. Original cross-lane test summary has **25 named suites, 176/176 tests PASS, zero failures/skips**. The authentic fresh demo-domain signed deposit was replayed using the production Observer Kit path and a durable `pending` outbox was reopened. The transport explicitly refused `REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED` and has **no Holochain ACK, ActionHash or source-chain consensus proof**.
- Workflow **43630610501** Sprint 0 **SUCCESS**: six general jobs, including Solana CLI smoke, Observer/unit, Anchor compile and offline tests; **does not substitute for A4 HAM/DNA build**.
- Workflow **43630610510** Cargo **bootstrap SUCCESS**, job **132556146425** produced **UNREVIEWED proposals only**, without Holochain Nix, Lair, compiler execution or installation.
- Workflow **43630610512** own-DNA build **FAILURE**: source readiness job **132556146702 SUCCESS** (inventory), build job **132556215502 FAIL** at **step 4 prerequisite lock/source guard**, Holonix tool installation and WASM/HAM compilation **SKIPPED**; install/CellId job **132556272943 SKIPPED**. A failed gate is *not* a Holochain build.

Downloaded **original** GitHub Actions ZIP artifacts and independently checked their on-disk SHA-256 against Actions artifact digests:

| Run | Artifact ID / name | Independent ZIP SHA-256 |
|---|---|---|
| 43630610615 | `14128690541` integration-cross-lane-js | `f09a4154574885132082d9a359155cb5429f15f12d551ddcd094cabaf4903657` |
| 43630610615 | `14128436296` integration-localnet-evidence-NO-KEYS | `df5254ddc4c3b6f4196808ad5c9ac6ce38ba0db0638d66fc1963a70ab55c73b1` |
| 43630610512 | `14128415176` a0-own-dna-build | `435149da8ec5c85c63f76952ead47a3c1f69d8f8249a6527fb2128679d9cfbd3` |
| 43630610512 | `14128355498` a0-runtime-readiness | `eb5eb59b64ad20d24e99643a080a15bbc63e7c8bd0206d704f1f950950feb1ec` |
| 43630610510 | `14128321323` a0-unreviewed-lock-proposals | `7021a8d721505f46aa5cd5dc4665bc972624319f978a08b8f45a6fe211f9dd0d` |
| 43630610501 | `14128267974` cross-lane-offline-evidence | `2d3511b35988f820849dfa272e285ee0bb0ba869fd633d9bd87f82355ef9e495` |
| 43630610501 | `14127464815` rust-anchor-evidence | `eab41df73a760e7ab1d48a5520ed9f7162be872fca05a91842a9d1d78c05c1d3` |

A5's separate read-only byte audit of the *new* original localnet ZIP verified **268/268** internal manifest hashes, unchanged generated Anchor IDL SHA256 `ee0e8209376a48a507cdc191310edc52e02576914c47ce7c3bb3cb85f93c324c`, ELF SHA256 `8f11972f91a2a31dccadc22d8a888e4431e22826fc8109e7cbf54c7bfb874b9e`, and original signed legacy-wire Ed25519 against the actual first signer account key. All three originals have a **unique byte-identical occurrence** in their provided base64 containing blocks, matching transaction index, slot, success meta and all metadata except the documented `rewards:null` / `[]` representation difference:

| Operation | Slot | Original signed wire SHA256 |
|---|---|---|
| initialize | 11 | `363189ffd4521a4bb0d7d59ec893b92ef6a7fdc9de5f6ea330fec489fc3cd81b` |
| deposit | 43 | `18ae1a0e78d0b8e442df0894b86a52aa26ff93b487fb72bf45ed4d2341adb58e` |
| refund | 76 | `e3106a1c4fbc3f7b10dec501edc1f0a4af16869d4c83268d7173bc3e0c811837` |

Deposit signature `5rSzTjHZtoypkbCYu4eSJxCydnsLevW7A2DiqUkowtqsRm6iA4NaryNPCFXumExxETUfJTAKDTLwcuaGspKZb6Xz`. Verified A1 pending witness digest `35f10800464a043c2ce5199f5e2f04cd440b5c137582f40d22f45290f61c7187`. The original signed wire and complete containing block are retained in the reviewed A3 v2 artifact, not merely their hashes; four-account original RPC response exists in the separately retained localnet ZIP, **not yet in an agreed authenticated destination v2 envelope**.

**DO NOT upgrade** selected finalized RPC source history into gap-free produced-slot scanning, independent Solana consensus, authoritative refund index/revocation or nonrefundable custody.

## B. Seven-stage result — guard worked, but end-to-end not achieved

From original `a0-preauthorization-seven-stage.json` (source SHA `2bc6887...`):

1. `source_verified = EXECUTED_SAME_SHA_ORIGINAL_SIGNED_SOURCE_KIT` — **localnet technical ACCEPT**.
2. `observer_evidence_admitted = EXECUTED_KIT_V2_DURABLE_PENDING_NO_ACK` — **localnet technical ACCEPT**; pending, transport refused.
3. `holochain_runtime_installed = BLOCKED_OBSERVER_DNA_SOURCE_DOMAIN_MISMATCH` — **BLOCKED** (also missing actual compiled/installed runtime).
4. `exact_call_approved = BLOCKED_PENDING_INDEPENDENT_EXACT_TUPLE_APPROVAL` — **BLOCKED**.
5. `signed_audit_action_executed = NOT_EXECUTED_APPROVAL_ABSENT`.
6. `typed_readback_verified = NOT_EXECUTED_APPROVAL_ABSENT`.
7. `restart_replay_verified = NOT_EXECUTED_APPROVAL_ABSENT`.

No signed write occurred. No seven-stage success claim is permitted.

## C. Source-domain collision — **P0 BLOCK / no archive relabelling**

**Source executed at integrated #58 SHA** (genuine new local validator):
- Genesis `8KxKcuHXfrC3mqufCmZdByoiZxxDdUYYKYn34mPEq9vy`
- Program `DURQGqWya6xYU99h6WYRaMCPJuQrzrL5JfgAX3uHaAiZ`
- Mint `HdjtmBUt6AjpKu6p2kZcG8kyYr53n4ARJKcpDPotTMrR`
- Initialized scope `00354a0803e31790b64e84d759349f017617a84cdb5cc37f5dbf40cba0923ccf`
- Producer SHA `2bc6887b1c373311f2fbddea530bd533067dad84`

**A4 #44 current `dna.yaml`** instead uses original SOL #55 archive:
- Genesis `BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv`
- Program `387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1`
- Mint `3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig`
- Scope `85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7`
- Producer SHA `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`

**All four** domain properties conflict; A1 stage 3 correctly refuses. Neither domain is illegitimate, but they are **not interchangeable**. Choose one original signed initialized source manifest, tie it to the actual immutable producer SHA and deployment epoch/ProgramData, freeze it **before** DNA packaging; verify both bundled and **installed** DNA properties from read-only conductor interrogation. Reject changed manifest after packaging, substituted genesis/program/mint/scope, wrong epoch, producer-SHA relabelling, or same receipt under a conflicting immutable occurrence. Pinned SHA labels and locally recomputed hashes do **not** independently authenticate source provenance.

A5 executed **25/25 local Node v22.16.0 reference-policy tests** (zero skip/fail) against exact archived/integrated domain constants, covering all four wrong domain properties, producer-SHA relabelling, changed packaged manifest and installed properties, wrong epoch, same-source occurrence conflict, missing authorizer, author self-approval, wrong source SHA/WASM/bundle/DNA/CellId/signer/function/payload, expiry, duplicate approval nonce and altered Ed25519 approval signature. **This is a synthetic reference decision oracle only**; it does NOT exercise packaged DNA, original authenticated source replay, an installed conductor, real independent reviewer keys or actual signed HAM calls. Reference file SHA256: `8d846b49c025325862a54f63afc4831984525641abbfa66b4647eed22d9bd6c5` (separately retained local review script).

## D. Observer / Holochain v2 ABI — **CHANGES REQUIRED**

A3 #57 `observer/src/v2-binding-review.mjs` (blob `9cdf0c7ed6f506839d770773f3837c8fc6babcaa`) is expressly **review-only**. It proposes strict typed root `kind,schemaVersion,source,witness,proof,destination,status,historyIndexed,deliveryAuthorized,bindingDigest` plus all economic denials; preserves original A3 canonical witness JSON and original raw four-account RPC bytes, independently hashes them, checks duplicate decoded JSON member names at every depth and rejects unsafe numeric representations. It is not a trusted sender, signer or active destination API. A3 also requests authenticated ProgramData epoch and explicit full installed CellId.

A4 #44 compiled-source candidate is still strict **v1 test-only fixture**: coordinator blob `5a70b37be792c767d8fdb092e1e8c0c5bdd08f74` exposes `record_observation` / `get_observation`; integrity blob `44d1c6b7672439a028fdcee6c829e6929ffc6dac` rejects `observer_reviewed_outbox`; HAM adapter blob `138c1aa4d909abf4d766106c14caf09b9a0f4f33` uses `CapGrantOptIn::Withheld` in source but only accepts fixture opt-in. There is **no built, active Rust `record_observation_v2`** matching A3. A4 proposal explicitly records incompatible A3 and A4 canonical root and digest domains. A3 witness domain `HSC/observer-authenticated-audit-witness/v2\0` and proposed A4 binding domain `HSC/solana-audit-demo-v2/source-to-dna\0` **must remain distinct commitments**; a self-computed digest does not imply trust or reviewer authorization.

**Unmet adversarial runtime acceptance:** modified original signed wire; missing or substituted original block or account-sidecar bytes; contradictory RPC metadata; duplicate raw JSON keys; unsafe u64/safe-slot numbers; forged producer/ProgramData; recomputed attacker hashes; wrong source epoch/installed DNA full CellId/author/signer/function; changed WASM/lock/bundle; duplicate/uncertain-send, lost ACK, conflicting remote ActionHash, restart/retry and hostile journal rollback. Existing source/offline/synthetic checks must be labelled as such. Any missing original raw evidence means HOLD, not a lossy hash-only v2 write.

## E. Holochain runtime — **NOT INSTALLED / BUILD NOT ACCEPTED**

A4 #44 currently commits `holochain/demo/Cargo.lock` (Git blob `6a0a3da541a6c1333d56367994725e64b2e295a4`), but direct exact-HEAD fetch of `holochain/demo/ham-adapter/Cargo.lock` returned **404**. A1 #58 source inventory reports **both** locked files absent from its checkout. The bootstrap artifact contains *proposed* independent lock graphs, not committed reviewed source inputs and not executed builds. The Holochain build failed preflight before compiler invocation. Do not represent the native HAM, integrity/coordinator WASM, DNA/hApp bundle SHA, `hc dna hash`, installed DNA, full CellId, external Lair identity, withheld-capability *runtime* refusal, ActionHash, typed readback or restart as verified. All are **MISSING** for this exact #58 SHA. Previous disposable Unyt/RAVE read-only conductor success is not the own installed demo.

## F. Separate exact signed-call decisions — **NO AUTHORIZATION**

**Milestone A (fixture-only): BLOCKED.** Eligible for reconsideration only after real 0.7.1 + native HAM locked builds, independent binary/digests, own installed source-bound DNA and ordered CellId, external Lair signer, withheld grants/runtime denials and one exact fixture-only v1 call approved separately by a **genuinely distinct authorized reviewer**. No actual authorized reviewer has been identified in issues #10/#15/#21 (unassigned), nor do PRs #33/#44/#57/#58 have recorded GitHub reviews as inspected.

**Milestone B (authenticated Observer v2): CHANGES REQUIRED + BLOCKED.** Requires all A conditions, a frozen genuinely implemented lossless A3–A4 typed v2 ABI, original source and account-sidecar preservation, trusted source-to-DNA and installed epoch binding, authenticated HAM/Lair transport, real scoped typed ActionHash readback, crash/lost-ACK/restart/conflict tests and a **different separate exact-call approval**. Approving A never approves B.

Before **any** mutating call, a governance-appointed reviewer, using credentials/approval channel **not controlled by the implementation-author principal**, must authenticate and sign a single-use, expiring decision over this complete immutable tuple:

`(operation=own-audit-only, sourceSHA, exact produced signed-source archive+digest, source manifest+SHA256, deployment epoch and ProgramData, A3/ABI SHA, integrityWasmSHA256, coordinatorWasmSHA256, nativeHamSHA256, dnaBundleSHA256, happBundleSHA256, actual installedDnaHash, appId, ordered fullCellId=[DNA,agent], author, externalLair signer identity, withheld grant policy, role, zome, function, full canonical payload BYTES+SHA256, approval nonce, approval expiry, independent reviewer identity+authenticated signature)`.

The eventual *caller* must verify the separately trusted reviewer key/identity, exact immutable byte equality, expiry and single-use grant before the HAM call; no default key and no auto-approval based on GitHub author CI. **Current tuple has missing runtime, reviewer and payload members; authorization decision = DENY.** Request a separate authorized human/security principal from repository governance before attempting a signed write. No reviewer can be inferred or named as authorized from present evidence. If no independently controlled authorization channel exists, stop.

**Gate B1 BLOCKED:** incomplete produced-slot history and no independent consensus; **B2 BLOCKED:** released Unyt coordinator source/capability equivalence unknown; **C NO-GO:** hostile local journal rollback lacks external checkpoint, source collateral refundable, governance/signer authority unresolved. No production assets, source coordinator mutation, spendable issuance, withdrawal, settlement, main merge or economic deployment.

Mandatory unchanged literal:
```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

**Final five-category decision:** **ACCEPT — localnet technical verification** (stages 1–2 only); **NOT ACCEPTED — installed audit-only runtime**; **CHANGES REQUIRED — full lossless reviewed v2**; **BLOCKED — independent exact-call authorization** (both A/B); **NO-GO — economic bridge**. This document does not grant an Holochain capability or permission.

## G. Later A4 HEAD recheck (same day; read-only, does not modify PR #58 source)

After this report was first committed, A4 PR #44 advanced to **`01241af206288e7d8f2b69008eff2fbf3abcc7c9`**, five commits ahead of the previously reviewed `990bd4e4d67d0f5f4ab8851ee1397be3ca62f20a`. Live GitHub compare lists four affected files, all within `holochain/demo/**`: new `NATIVE_LOCK_REVIEW_2026-11-14.md`, new `verify-native-lock.py`, and changes to `bootstrap-locks.sh` and `build.sh`. The new native-lock report explicitly calls the candidate **offline reviewed, NOT committed, no full Cargo metadata/tree/locked build/install**. It gives proposed native Cargo.lock SHA-256 `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` (414 packages) and pinned HAM `fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`. Direct exact-new-HEAD fetch of `holochain/demo/ham-adapter/Cargo.lock` still returned GitHub 404; the old WASM lock (blob `6a0a3da541a6c1333d56367994725e64b2e295a4`) and old #55-bound `dna.yaml` (blob `62fdeb2462e7543774b186885b71da607d7a9cf1`) remain unchanged. No PR #44 exact-new-HEAD workflow runs returned from GitHub at this check. **This is a welcome source-only dependency review, not a compiler or installed audit-runtime ACCEPT; all authorizations still DENIED.**
