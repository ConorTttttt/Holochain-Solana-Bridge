# SOL #12/#19 — original PR #55 evidence retention, source-domain decision and deployment-epoch HOLD

**Date:** 2026-11-14. **Source owner review:** Agent 2 (NOT independent Agent 5 security approval).  
**Original source:** PR #55 at `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`.  
**Scope:** non-economic disposable local-validator evidence. No contract change, repeat local-validator execution, custody authorization or economic approval.

## A. Original artifact preservation record

- **Original producer:** Actions run `43604140724`, successful source-localnet job `132475021174`.
- **Original Actions artifact:** `14118166967`, `solana-localnet-verification-evidence`.
- **Producer SHA:** `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`.
- **Exact downloaded ZIP size:** `968887` bytes.
- **Exact ZIP SHA-256:** `33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018`, equal to GitHub uploader digest.
- **Original expiry:** `2026-11-28T14:30:34Z`.
- **Download location before expiry:** `https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43604140724/artifacts/14118166967`.
- **Independent retrieval:** exact bytes downloaded to a conversation file `solana-original-14118166967.zip`, sha256/CRC checked; user-downloadable copy made available in the review conversation. **This is NOT a proven versioned long-term storage location.**
- **Long-term object storage URI / immutable version ID:** **NOT RECORDED / PENDING**. Until an independent archive destination and restore verification are supplied, preservation is an explicit **HOLD**. Neither this markdown file nor the ZIP hash preserves the ZIP bytes.

Original ZIP contents: **283** entries; original internal `localnet-evidence/evidence-manifest.sha256` has **280/280** matching entries after resolving the entries' `./` prefix against `localnet-evidence/`; ZIP CRC check passed. Original manifest SHA-256: `b92b42ff6a0b217e40212a3088ee88110010d9aefa179b080ccfbe342d1ab366`. Original source manifest bytes: `dcbee3b3402fac226a85281ea844e395d5a7d010844a34f4d53ed5860a502136` SHA-256. Original signed-wire bundle: `a4608820c851d594b17903f84c3032b586c5de2a88d47db665bb72fb5e828c6c` SHA-256.

**Retention action (time-critical):** deposit the exact downloaded ZIP, without unpacking/repacking or modification, in independently controlled versioned/immutable object storage **before 2026-11-28**. Record canonical bucket/key or archive URI, immutable version ID, controller, retention date and a second operator's fresh download SHA. Do not mark this gate complete merely because the current Actions artifact is downloadable. Never introduce private keypairs or validator ledger secrets.

### Reproducible offline verification

Use the separate read-only `tests/solana/verify-pr55-original-zip.py` checker in this branch with Python 3 and `cryptography` installed:

```bash
python3 -m pip install cryptography
python3 tests/solana/verify-pr55-original-zip.py ./solana-original-14118166967.zip
sha256sum ./solana-original-14118166967.zip
```

It verifies exact ZIP hash/CRC, 280/280 original manifest, exact domain/IDL/ELF/scope, archived BPFUpgradeableLoader Program/ProgramData consistency, all four **original Ed25519 signed wires** against their respective original `getTransaction` and unique containing `getBlock` entries (slots 10, 42, 74, 75), plus original active/refunded four-account snapshot sidecar byte matches. It does **not** claim Solana consensus or gap-free produced-slot history. On retention, a second reviewer must run this procedure from the independent downloaded object and record hashes.

## B. Original Solana source-domain contract (archived execution only)

```json
{
  "sourceCommitSha": "c071e4c98e7b2dd04a18374f3792c0a90ce4b284",
  "genesisHash": "BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv",
  "programId": "387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1",
  "mint": "3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig",
  "initializedScopeHex": "85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7",
  "config": "BJyyJjp3yBPLuM44aLWD7rj84oDKkYaQQZrBFWXAtj7n",
  "vault": "F3wqHV1bfKfTDsmyp8A54Hm2eNhn6zoqk3YkbLW69qKQ",
  "receipt": "5HzYHP6kwfi7GNxhACYZxqtjU3Zypr1UMS3DQjmgn1mH",
  "nonce": "42017",
  "amountBaseUnits": "250000",
  "idlSha256": "d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007",
  "elfSha256": "13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647",
  "historyComplete": false,
  "creditEligible": false,
  "independentConsensusVerified": false,
  "spendableBaseUnits": "0",
  "withdrawalAuthorized": false
}
```

Original initialization signature `2mk39P1WRM3YTSM9N2G414NUtm1P3mThEiMEUytHB5ZnAiTy2LEzGVQ1niY8QULhWW5X2z9QQXuJJXtXxhjQ1JLn` (slot **10**); deposit signature `4ibizpAzc2BmXAMhoPy15KmrvREnQMXcDp3QZszMGJL8wmWnNLG8GhKVbPjiLCMpS98k6c5GnpDCCuMdUkPeKETp` (slot **42**); included rejected duplicate `2zHsZCVDmiCXPNreD2MRFwQ6ehTcsFWeLoPcsGSpdrNSyY2mBzVpyPhbuu6DkSbm9ExBwR4Kk1uUqyc3p1gjakKy` (slot **74**); refund `2fYdaQQ9SMDrFQfHShT27zgKfF9sa8fEPwiQ6dUxfE6jd1DayvLzj59qiAYykzXFNyAi3A7JvUyAWKoxeahEenQX` (slot **75**).

**Cross-run rule:** New disposable validators have new genesis/program/mint/scope. Do NOT relabel their identity as PR #55. The only valid source authority for a fresh CI integration is the **same execution's** original `demo-source-domain.json`, signed initialize/deposit/refund wires, original archive manifest, generated IDL/ELF and account/block evidence, checked against the exact producer source and separately recorded Observer consumer source SHA. Require the original receipt/config/vault PDAs and signed scope; compare the actual signed initialization and deposit, not labels or a copied fixture.

## C. A1 PR #60 / #61 source-domain review (policy accepted, build pending)

- PR #60 at `b869da9ab07dd7c4aefec67c671aaf683bdccef1`: `demo/a0-execution-bound-dna.mjs` verifies archive-manifest membership and exact original source object embedded in the Observer replay, exact deposit identity, denied economics and original A4 template Git blob. It **generates separate YAML**, does not commit replacement of A4's historical template. The same-run consumer requires a separately recorded matching immutable producer SHA.
- PR #61 initial inspected source `fc0cc94e17e7dbb4c6f3c8c9d6086fe3ae23e249`, **latest continuation reviewed by diff** `baa9f164cf9fa39b34ae1d1d0c3007c7e9197dc1`: `demo/a0-bind-same-run-dna.mjs` requires source-derived scope and signed deposit/Observer evidence; newest seed additionally commits source producer SHA, original domain-manifest SHA-256 and original whole-archive manifest SHA-256. `own-dna-same-run-build-readonly` depends on **both** `solana-lifecycle` and `cross-lane-js` successful jobs and downloads their same-run archives. The ephemeral checkout DNA is separate from the checked-in A4 template. Newest revision launches archived OBS RPC replay via restricted `node --test` child context, and `verify-integration-provenance.mjs --post-original-anchor-sync` distinguishes immutable Git blobs from exactly two original producer-patched working-tree files. These changes have source-code review only; actual new-head workflow evidence remains required.
- **Decision:** source-domain *policy* acceptable for an **audit-only** DNA; not acceptance of its actual execution, installed full CellId, signer, readback or approved v2 transport. A1's declarative JSON checks alone are not a replacement for running the original SOL witness verifier and independent A3 Observer byte/IDL/PDA checks.
- **Observed prior exact-head failures, not concealed:** PR #61 old head `fc0cc94...` cross-lane run `43640196929` failed on the archived RPC injection guard; PR #60 current head `b869da9...` run `43640351458` passed signed-wire replay but failed a source-owned `Anchor.toml` blob comparison after original dynamic key sync. #61 `baa9f...` addresses these at code level via restricted test-runner context and separate post-sync tree verification; re-execution at the new HEAD is mandatory before marking the fix green.\n- **Current blocker:** missing **reviewed, tracked** `holochain/demo/ham-adapter/Cargo.lock` from A4. Non-authorizing Cargo resolution suggestions do not authorize adoption. A1's latest static/unit green is not an actual native/WASM package, install or signed audit write.
- Negative substitutions that must remain fail-closed: PR #55 archived identity substituted for fresh genesis/program/mint/scope, different signed initializer/deposit or receipt/config/vault identities, falsified original manifest or producer SHA, inconsistent consumer SHA, wrong ELF/IDL, bad RPC original bytes, unauthorized economic flags.

## D. Deployment-epoch evidence (mandatory `deploymentEpochId` = HOLD)

The original `demo-domain-deployment-program-accounts.rpc.json` ZIP member has SHA-256 `5075149c846d02cea9a63e5f684c666a5239285b03324fcfd795e85d0eead4cc`. It records a BPFUpgradeableLoader **executable Program** pointing to ProgramData `Ay7P61LeQXPnD7mqTo5ma73qhauBd7tC6LYUXe8RdNTY`. The ProgramData account is BPFUpgradeableLoader-owned and has **reported upgrade slot 0**, ELF payload at byte offset 45 exactly matching generated deployed ELF SHA-256 `13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647`. The RPC observation context slot is **4**. These are archived RPC claims about a *deployment state*, not a verified authenticated **deployment event or epoch history**.

**Decision:** do **not** invent an epoch from arbitrary hashing, ProgramData address alone, ELF hash, deployment slot 0 alone, or source manifest hash. `deploymentEpochId` remains absent/null and any consumer that mandates it must HOLD. For a non-authorizing source observation, carry the raw fields separately:
```
{ genesisHash, programId, programDataAddress,
  observedProgramDataUpgradeSlot: 0, observedRpcContextSlot: 4,
  originalProgramDataRpcSha256, deployedElfSha256,
  originalArchiveSha256, originalSourceManifestSha256,
  deploymentEpochId: null, deploymentIdentityEvidence: "ARCHIVED_LOCAL_RPC_CLAIM" }
```
If an epoch ID is required in future, A2/A3/A5 must first define canonical semantics, verify the **actual deployment/upgrade transaction and its containing block**, bind the verified program/ProgramData accounts and ELF at the relevant bank, resolve upgrades/redeployments, authority/finality/trust policy and safe archival history, then ratify a collision-resistant event reference (e.g. genesis + program + verified upgrade transaction signature and occurrence + ProgramData identity). That is a **future proposal**, not an inferred current epoch.

## E. Anchor.toml / generated working-tree provenance

- The **committed Git version** at original #55 and A1 #60/#61 has `Anchor.toml` Git blob `6a890f430895d2b616d8a0513a4b32ec303843e6`; it is an **unexecuted development placeholder** (program `Fg6PaF...`, cluster `Localnet`). Its source-controlled blob is not the exact executed program ID.
- A2's original actual `anchor keys sync` created `localnet-evidence/anchor-keys-sync.patch` (SHA-256 `9939e9a196b2d291107cdd6a72cd780f4042088e4ea25d914e580f5654f3d87a`), with **exactly two tracked files**: `Anchor.toml` and `programs/deposit_prototype/src/lib.rs`. It sets actual ID `387eqrH...` in both; it additionally generates `[features]`, lowercase `localnet`, `[hooks]` and removes the placeholder comment. Those non-identity TOML changes must be reviewed, not silently normalized away.
- Original producer `tracked-pre-sync.sha256` manifest SHA-256 `2f42eea34c15683443c32a0ff41532e64ff2df5b60cfdf004eb52844e8cc3e8f`; original `tracked-post-sync.sha256` SHA-256 `ad6222d6dda0a8b96f511d3468109c57934e7a5eabb98386f376972229dfdec9`. Build inputs record the **post-sync** Anchor file SHA-256 `06cf2ac16a8b6e9c47346ad701f63172aa0c8b6aa66dccf12aaaedf1b86fe25c` and post-sync Rust program SHA-256 `7dd0f9e692d25f4cf61281e910743cf8b8579c583863d3fab9d693ee560df760`.
- A1 `scripts/ci/a0-replay-source-patch.mjs` correctly refuses a dirty tracked checkout, cross-SHA patch, missing files or changes outside the **two known paths**, checks original pre-sync hash inventory, executes `git apply --check`, applies the exact archived patch in a throwaway consumer, and checks original post-sync source, Cargo lock and build inputs without making a Git commit.
- **Patch decision:** accept for **exact original local-validator source reconstruction only**, conditional on those original hashes and the full diff. Do not claim the dynamically changed working tree was the immutable Git HEAD, or approve any unreviewed extra changes. The patch proves correspondence of archived producer inputs; it does not alone prove independently authenticated deployed authority or safe Holochain write.

## F. Agent 5 security handoff / hard stops

A5 must independently review this exact original archive, source-owned witness verifier, same-run provenance, ProgramData/epoch HOLD and original patched build inputs before any promotion. Preserve explicit `historyComplete:false`, `HOSTILE_FILE_ROLLBACK_UNPROTECTED`, unreviewed signed transport, absence of external consensus/checkpoints, no approved immutable deployment epoch, first-initializer capture, upgrade governance unknown and refundable collateral. No claim of finalized economic liability, no released Unyt coordinator call, no spendable Holochain credit, no withdrawal and no main merge.

**Disposition:** original bytes recovered and independently verified; **long-term storage HOLD**, same-run source-domain policy **ACCEPT for audit-only review**, `deploymentEpochId` **HOLD**, source patch **ACCEPT only for exact replay**, C economic gate **NO-GO**.
