# Agent 5 — exact-head PR #60 / #61 security assessment and independent exact-call gate

**Review date:** 2026-11-14 UTC. **Lane:** SEC #33, issues #10/#15/#21. **Starting SEC commit:** `6a10d2f89e86e6e8ea94b72074619c14a4ce4759`. **Connected principal:** `ConorTttttt`, the implementation author. This is a read-only technical security assessment. It is **NOT independent approval**, a signed Holochain action, economic authorization, or main-merge acceptance.

## Immutable subject commits and workflow outcomes

| PR | Exact head | Shared workflow | Real cross-agent workflow | Own DNA / native |
| --- | --- | --- | --- | --- |
| #60 | `b869da9ab07dd7c4aefec67c671aaf683bdccef1` | `43640351454` SUCCESS, six jobs | `43640351458` FAILURE; SOL `132586361929` SUCCESS; RAVE SUCCESS; combined `132589804322` FAILURE | `43640351467`: source/unit `132586362093` SUCCESS (77/77), locked build `132586426097` FAILED preflight, install `132586488267` SKIPPED; resolver proposal `43640351489` SUCCESS |
| #61 | `fc0cc94e17e7dbb4c6f3c8c9d6086fe3ae23e249` | `43640196960` SUCCESS, six jobs | `43640196929` FAILURE; SOL `132585861260` SUCCESS; RAVE SUCCESS; combined `132589205296` FAILURE | `43640196980`: source/unit `132585861506` SUCCESS (57/57), locked build `132585922118` FAILED preflight, install `132585996053` SKIPPED; resolver proposal `43640197008` SUCCESS |
| #44 | `01241af206288e7d8f2b69008eff2fbf3abcc7c9` | no new commit-attached Actions runs returned | A4 review-only source, not these integrated runs | Native HAM lock absent; existing WASM lock present |
| #57 | `38847cf1399c59fd1a1665c8bef2249479d7da03` | source owner | A3 TS review candidate | v2 transport unapproved |

GitHub Actions job IDs and exact-head job logs were retrieved directly; these are not inferences from PR descriptions. **Do not treat six green shared jobs as a green cross-agent batch.**

## 1. PR #60 generated `Anchor.toml` patch: classified provenance mismatch, not an integrity waiver

At job `132589804322`, the after-patch invocation of `scripts/ci/verify-integration-provenance.mjs` refused:

```
AssertionError [ERR_ASSERTION]: SOL upstream owned blob mismatch: Anchor.toml
actual   1cac0f99600cfa6881308afc225f8f06a66aa10c
expected 6a890f430895d2b616d8a0513a4b32ec303843e6
```

The **expected** `6a890...` is the exact committed `Anchor.toml` Git blob at PR #60. This file contains the intentionally disposable `Fg6PaFpo...` development public ID. The **actual** `1cac...` is a working-tree Git hash calculated after the runtime reproduces the source producer's dynamic public-ID synchronization. The hash difference is expected in a correctly reconstructed generated build, but a hash difference by itself is not proof of correct derivation.

Independent read of the exact #60 workflow and `scripts/ci/a0-replay-source-patch.mjs` shows the following **actually executed** source-verification path before the failure:

1. Pre-patch general source provenance succeeded: `PASS: 116 source-owned blobs, corrected CI-only fixtures, four reviewed dependency locks, non-economic safety flags` (the latter four locks are original shared locks, **not** A4 native).
2. The original A2-produced `anchor-keys-sync.patch` and `anchor-keys-sync-tracked-changes.txt` were checked; `tracked-pre-sync.sha256` and `tracked-post-sync.sha256` both checked OK in original SOL evidence.
3. The CI-only replay script required original producer SHA == immutable consumer checkout SHA, a clean prepatch working tree, exactly two changed paths (`Anchor.toml`, `programs/deposit_prototype/src/lib.rs`), `git apply --check`, SHA-256 checks of BOTH original producer prepatch and postpatch tracked-file inventories, original build-input checksums and original Cargo checksums; it disallows HEAD mutation. Job logged `RECONSTRUCTED_ORIGINAL_A2_DYNAMIC_COMPILED_SOURCE_SHA b869da9...` with postpatch manifest SHA-256 `92b485f707ae164ae3644af8605594bd70e4e9dbd205b94c1c73eaca045d303d`.
4. Genuine source verifier reported original localnet lifecycle evidence, matching deployed ELF SHA-256 `770669d8295b11c24d2957f4b53d9e3be60201e151b0fad14861705f9ac37e0e`, ProgramData `HArsi6vjhvFUqaMeYLXMzk2jh2peneeRaHK5jtqU4uvH`; these are **RPC/localnet observations**, not an authenticated immutable deployment epoch independent of the reporter.
5. New `node --test scripts/ci/a0-demo-domain-kit-v2.mjs` **passed**, emitting `FRESH_DEMO_DOMAIN_ORIGINAL_KIT_V2_QUEUED_NOT_DELIVERED`, digest `0dc7fbf7feefbcb5692b9eb580900d32448d51c5870caca04a2aa1e5cb6771cc`, pending durable outbox and `REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED`. This is **one original archived localnet RPC witness under two replay endpoint names**, not two independent source consensus authorities. The generated execution-bound YAML passed its own sha256sum checks; it was **not compiled or installed**.
6. A later workflow line re-ran the **committed-source** verifier against the already patched working tree; it failed as expected on `Anchor.toml`.

**Decision: CHANGES REQUIRED.** Require TWO separate provenances without weakening either:
- **Committed state:** the original exact Git blob hashes and four existing shared dependency locks, verified before the dynamic patch.
- **Generated state:** original A2 patch bytes and change manifest, clean checked-in preimage, exact two-path allowlist, SHA-256 checked original full pre/post inventories, compiled IDL/ELF, ProgramData/deployment fingerprint and source commit from **same integrated execution**. Verify these again before consuming the generated DNA input, not by reusing the committed-state verifier after the patch.
- Do not replace a committed blob hash with a postpatch hash, add a blanket exception, suppress failure, regenerate/counterfeit producer patch, or commit synthesized dynamic keys. The CI-only generated DNA YAML must remain separate from the unmodified A4 source template and be rechecked against authentic original source before **and after** packaging and installed read-only query.

## 2. PR #61 production Observer guard: correctly refused the replay

At job `132589205296`, `scripts/ci/a0-demo-domain-kit-v2.mjs:138` called `DemoOutbox.queueVerified` with `fetchFn` while running outside Node's test child, yielding `OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN`. The imported A3 source at `observer/src/demo-outbox.mjs:240-243` requires BOTH `process.env.NODE_TEST_CONTEXT === 'child-v8'` and `process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY === '1'` before permitting a test RPC fetch override. **This is a valid production security guard.**

#60 uses `node --test scripts/ci/a0-demo-domain-kit-v2.mjs` and has real exact-head replay success at stage 2. #61 calls `node scripts/ci/a0-demo-domain-kit-v2.mjs` and is correctly refused. **Required:** use the deliberate Node `--test` child replay boundary; retain the production guard and its denial tests, original signed wire, containing block, RPC four-account sidecar, original IDL/ELF checks, and fail-closed no-ACK state. Never assert that synthetic loopback URLs confer provider independence or production transport authority.

## 3. Source-domain / installed-DNA attack matrix

| Adversarial change | Source or test evidence at inspected SHA | Decision |
| --- | --- | --- |
| Wrong genesis, program, mint, initialized scope | #60 bound-DNA source checks and #61 source projection tests; #60 original live run and signed replay; A4 tracked DNA template still bound to **older** SOL #55 domain | Synthetic/source refusal only. Require genuine installed read-only match. |
| Wrong producer SHA / non-same SHA | #60 verifies producer == consumer and immutable source artifact digest; source patch rejects cross-SHA | Source-level guard present; no independent attestation of a hostile producer. |
| Altered original manifest / receipt evidence / signed wire / containing block | Original SOL manifest pre/post SHA checks, signed-wire verifier and A3 source tests; #60 replay succeeded | Localnet technical acceptance only. Preserve **original bytes**, including full block and RPC metadata. |
| Wrong ProgramData / upgrade epoch | SOL verifier logs actual ProgramData, deployed ELF matching localnet bytes | Epoch is **not yet frozen into a checked installed DNA, independently source-authenticated v2 tuple**. Refuse missing/unknown epoch. |
| Changed DNA properties after packaging | #60 generated separate YAML with digest; template not mutated at commit | **NO packaged/installed object produced**; must verify bundle properties and installed live identity, not only YAML. |
| Wrong installed DNA hash / full ordered CellId / app / author | A4/HAM v1 source includes read-only preflight, but no own installed build or run | **NOT TESTED against actual own conductor**. A self-supplied CellId is unacceptable. |
| Recomputed attacker checksum / JSON labels | A3 review-only SHA-256 and nested-denial tests; A4 explicitly rejects `observer_reviewed_outbox` for v1 | Digest proves byte consistency only, not trusted source admission or exact-call authorization. |

**Source-domain decision: CONDITIONAL SOURCE-LEVEL TECHNICAL ACCEPT for #60 stage 1/2; runtime binding NOT ACCEPTED.** `holochain/demo/dna.yaml` on A4 #44 remains bound to original archived SOL #55 `c071e4...`, which is different from #60's same-run source and cannot be relabelled. A new DNA build must use source-authenticated original integrated signed evidence, its same-run source manifest, and the actual verified deployment epoch. After a real build, compare the **bundled and installed** DNA properties and the full ordered CellId with the exact pinned producer and the independently approved call tuple.

## 4. Native HAM graph / Holochain runtime

Read-only exact-head A4 #44:
- `holochain/demo/ham-adapter/Cargo.toml` Git blob `c821812ff1de2adab47634c35e689d5b32a5c303`: standalone workspace resolver 2; seven direct native dependencies; HAM pinned `unytco/ham@fbb4b6eb8a79a507e9453b709ed00f15c5618fb4`; `holochain_client = "=0.9.1"`, `holo_hash = "=0.7.1"`.
- `holochain/demo/ham-adapter/Cargo.lock`: **404 NOT FOUND at exact A4 head**. Reviewed native **proposal** sha256 `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399`, 102,990 bytes, 414 packages (412 checksummed registry + pinned HAM Git + root path). A4 `verify-native-lock.py` and native review document explicitly distinguish structural parsing from Cargo resolution and compilation.
- A4 root WASM `holochain/demo/Cargo.lock` is committed, SHA-256 `85ce7ffafbdf158148a62c64d87fb582b6fe06ffa164e774006c2bdd9afa9751`; this is **NOT** the native HAM graph.
- Both A1 native bootstrap workflows succeeded in **resolver/proposal-only** mode, not `cargo metadata` full resolve + `cargo tree --locked` against the committed A4 exact head or any compiled HAM/WASM.
- #60 own-build job `132586426097` failed exit 3 with `MISSING_TRACKED_BUILD_INPUT:holochain/demo/ham-adapter/Cargo.lock`; #61 analogous `132585922118` failed exit 3. Both installation jobs were skipped.

**Required:** commit **original byte-exact** native candidate to A4 branch after independent structural/source review, run `verify-native-lock.py` and `bootstrap-locks.sh verify` with full `cargo metadata --locked` and `cargo tree --locked` for BOTH roots, independently assess registry/git package provenance, run actual pinned native `cargo build --locked` and both `wasm32-unknown-unknown` compilations, record actual hashes, pack real DNA/hApp, query actual `hc dna hash`, then install our own audit DNA on real Holochain 0.7.1 and verify external Lair identity/full CellId. Structural lock success **never equals** a successful native/WASM build. **Current native/runtime verdict: NOT VERIFIED.**

## 5. A3 TypeScript ↔ A4 Rust v2 ABI acceptance matrix

| Requirement | Exact observed state | Required action |
| --- | --- | --- |
| Original Ed25519 signed wire | A3 #57 `demo-witness-v2.mjs` retains `proof.originalSignedWireBase64` and full `rpcTransaction`; A4 proposed WitnessV2 stores a digest only | Lossless byte preservation and byte/hash revalidation in final admitted envelope. |
| Containing block / unrelated entries | A3 retains full `proof.containingBlock`, A4 proposal hash-only | Full block and execution metadata, no lossy projection. |
| Original four-account RPC sidecar | A3 `v2-binding-review.mjs` calls for original raw UTF-8 sidecar, duplicate-key refusal | Preserve exact bytes, compare to parsed snapshot and trust-bound admission. |
| Trusted source admission | In-process A3 Kit and durable ledger reach *pending*; caller JSON labels and sha256 are unauthenticated at remote edge | Separately authenticated transport, source trust policy and proof revalidation. |
| Witness vs destination digests | A3 witness domain `HSC/observer-authenticated-audit-witness/v2\0`; A4 proposed binding domain `HSC/solana-audit-demo-v2/source-to-dna\0` | Two separate digests; no silent domain rewrite or authorization from recomputation. |
| Installed source-to-DNA binding | #60 emits source-bound YAML only | Compare source, deployment epoch, WASM/build/bundle hashes and installed ordered full CellId **from authenticated runtime**. |
| Canonical TS↔Rust vectors | TS review-only parser/canonicalizer and synthetic tests exist; **no compiled v2 Rust zome** | Freeze same literal UTF-8 vector + digest in both independently compiled parsers, strict JSON/key/u64 limits. |
| Replays, lost ACK, rollback | Pending durable outbox reopening; no authorized send or real remote ACK | Read-before-retry, typed persistent remote readback, conflicting ActionHash refusal, restart/lost-ACK tests; hostile journal rollback stays blocked. |
| Typed ActionHash readback | Existing Rust v1 `record_observation` returns `ActionHash` in typed `AuditRecord`; no own installed runtime | Real signed action, valid original author+cell action hash, typed readback and restart, exactly same payload and source ID. |
| No attacker-made authorization | A3 `verifyReviewedWitnessV2` checks checksum/shape; A4 v1 only accepts `test_only_fixture` | Require independently authenticated reviewer authorization, sender and allowlisted capability. No `observer_reviewed_outbox` delivery before v2 reviewed ABI and tuple. |

**ABI verdict: CHANGES REQUIRED; `record_observation_v2` UNIMPLEMENTED/UNAPPROVED.** A4 Rust coordinator at exact head exposes `get_contract`, `record_observation`, `get_observation`, `list_observations` for v1. No compiled Rust v2 ABI and no genuine TS↔Rust canonical-vector acceptance exists.

## 6. Independent reviewer governance and exact-call approval

The authenticated GitHub user is `ConorTttttt`, who authored #33/#44/#57/#60/#61. Exact PR reviews for these five PRs returned **empty lists**. `.github/CODEOWNERS` at main was 404. Neither repository ownership nor an agent label is an independently authorized signer. **No distinct authorized reviewer was identified.**

Before **any** mutating call, obtain a named governance-appointed reviewer with independently controlled key, verified GitHub/repository authority or separately documented governance mandate, and an authenticated approval channel not controlled by the implementation principal. The approved tuple must include ALL immutable members:

```
operation/milestone;
source commit;
original signed source archive exact bytes and SHA-256;
original signed source manifest exact bytes and SHA-256;
source genesis/program/mint/initialized scope/recipient/nonce/amount;
deployed program ELF and ProgramData/deployment/upgrade epoch identity;
A3 source ABI contract and exact SHA;
native HAM binary+locked manifest/lock digest;
integrity and coordinator WASM SHA-256;
DNA and hApp bundle SHA-256;
actual installed DNA hash and app ID;
ordered full installed CellId [DNA hash, agent key];
exact author agent and external Lair signer fingerprint/key;
capability grant policy (withheld by default) and any explicit approved allowlist;
role, zome and function;
complete canonical payload bytes and SHA-256;
single-use nonce, explicit expiry, review issuance instant;
reviewer identity, independently verified authorized public key and authenticated signature.
```

No placeholder, unknown epoch, checksum alone, self-signature, GitHub CI green, anonymous `approved` Boolean or token from the app's own operator is acceptable. Verify each byte before call; persist nonce consumption and ambiguous-send/readback state. If governance cannot supply a demonstrably independent reviewer/channel, STOP.

**Milestone A — fixture-only v1 signed audit action: BLOCKED.** Even if runtime becomes available, requires an explicit independent signoff specifically for the fixture-only function and payload.

**Milestone B — authenticated Observer v2 signed audit action: BLOCKED and CHANGES REQUIRED.** Requires A prerequisites **plus** frozen lossless v2 TS/Rust ABI, verified original source and same-SHA installed DNA, authenticated source delivery, real readback/restart/lost-ACK refusal and **separate** exact-call signoff. A approval never carries over to B.

## 7. Candidate selection and economic decision

**Preferred investigation candidate: #60 at `b869da9...`, PROVISIONAL ONLY.** Its genuine signed archived Kit replay reaches a pending outbox with production Observer guard intact. Resolve its after-patch provenance-verifier ordering without removing the checksum gate, then re-run the full exact-new-HEAD validator/OBS/security/RAVE matrix. #61 cannot be accepted without first respecting the Node test-only replay boundary. Neither candidate is canonical/accepted for release or merge.

**Gate B1 BLOCKED:** not complete produced-slot history, independent source consensus or rollback-resistant globally coordinated ledger. **Gate B2 BLOCKED:** genuine published Unyt source equivalence and caller capability not independently verified.

**Gate C ECONOMIC NO-GO:** refundable Solana custody; no independently authenticated source history/consensus/checkpoints; rollback/fork/replay; first-initializer and upgrade/admin governance; outstanding obligations conservation; signer and withdrawal authorization still unresolved. Absolutely no spendable Holochain credit, withdrawal, economic RAVE, published Unyt coordinator mutation, production settlement, economic deploy or main merge.

Mandatory non-economic literals:

```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

**Overall security disposition:** LOCALNET SOURCE TECHNICAL ACCEPT (#60 stage 1/2, with bounded RPC-claim trust); **NOT ACCEPTED** source-bound installed own DNA; **CHANGES REQUIRED** generated-source CI verification and complete v2 ABI; **DENY** independent exact-call approval; **ECONOMIC NO-GO**. This report is not an authorizing credential.
