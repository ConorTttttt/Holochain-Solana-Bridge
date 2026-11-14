# Agent 2 — exact original PR #55 evidence preservation and source-domain review

Date: 2026-11-14. Source owner: SOL, PR #55 at immutable `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`.
Status: **ORIGINAL BYTES VERIFIED LOCALLY; MIRROR MUST BE CHECKED FOR SUCCESS**. No economic authorization. This document does not amend a Solana validator transaction, consent, or custody contract.

## Archive identity and preservation location

- Original Actions run: `43604140724` (successful), original artifact ID: `14118166967`.
- Original artifact expiry: **2026-11-28 14:30:34 UTC**. Original GitHub artifact URL: `https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43604140724/artifacts/14118166967`.
- Exact ORIGINAL GitHub-produced ZIP: **968887 bytes**, SHA-256 `33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018`.
- Independently checked **280/280** original `localnet-evidence/evidence-manifest.sha256` entries, exactly 283 ZIP paths. Reconstructed complete 283-entry sorted-path inventory (each entry `<hex sha256>  <archive path>\n`) SHA-256: `44416df6a8ddc9a51a362f2a5bc0f3453b28b37ce4688279919f1f615d1d1646`.
- Dedicated mirror target (created only after the preservation Action succeeds): `security/evidence/solana-pr55-original-43604140724/artifact-14118166967-original.zip` **on branch `agent/sol/12-19-original-evidence-preservation-20261114`**. Do not treat an unexecuted workflow or link to an expiring artifact as a successful mirror.
- Workflow: `.github/workflows/sol-pr55-preserve-original.yml`, restricted to this evidence branch; downloads original GitHub artifact **without recompression**, checks SHA-256 and archive manifest/IDL/ELF/ProgramData, commits original ZIP only if all checks pass.
- After a successful commit, confirm that the committed Git blob contains the original byte sequence: `git show <mirror-commit>:security/evidence/solana-pr55-original-43604140724/artifact-14118166967-original.zip | sha256sum`. A public Git branch is a durable repo copy but **not an independent operator / immutable offsite mirror**. Operator should additionally place the identical ZIP in versioned/WORM storage controlled separately, recording its URI, version ID, SHA and retention policy.

## Offline independent byte-verification procedure

```bash
set -euo pipefail
ZIP=security/evidence/solana-pr55-original-43604140724/artifact-14118166967-original.zip
test "$(wc -c < "$ZIP")" = 968887
printf '%s  %s\n' 33a56159b1ab680cbfc36bffb365a1195a54fbddafb89082d8efcee012c2a018 "$ZIP" | sha256sum -c -
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
python3 - "$ZIP" "$WORK" <<'PY'
import zipfile,hashlib,sys,json,base64
p,out=sys.argv[1:]; z=zipfile.ZipFile(p); names=z.namelist()
assert len(names)==283 and len(set(names))==283
assert all(not x.startswith('/') and '..' not in x.split('/') for x in names)
h=lambda b:hashlib.sha256(b).hexdigest()
rows=z.read('localnet-evidence/evidence-manifest.sha256').decode().splitlines()
assert len(rows)==280
for row in rows:
    digest,rel=row.split('  ',1)
    assert rel.startswith('./')
    name='localnet-evidence/'+rel[2:]
    assert name in names and h(z.read(name))==digest,name
all_manifest=''.join(h(z.read(n))+'  '+n+'\n' for n in sorted(names)).encode()
assert h(all_manifest)=='44416df6a8ddc9a51a362f2a5bc0f3453b28b37ce4688279919f1f615d1d1646'
src=json.loads(z.read('localnet-evidence/demo-source-domain.json'))
assert src['sourceCommitSha']=='c071e4c98e7b2dd04a18374f3792c0a90ce4b284'
assert h(z.read('idl/deposit_prototype.json'))==src['idlSha256']
elf=z.read('deploy/deposit_prototype.so')
assert h(elf)==src['elfSha256']
raw=json.loads(z.read('localnet-evidence/demo-domain-deployment-program-accounts.rpc.json'))['result']['value']
pd=base64.b64decode(raw[1]['data'][0])
assert int.from_bytes(pd[:4],'little')==3 and pd[45:]==elf
assert int.from_bytes(pd[4:12],'little')==0
assert src['initializedScopeHex']==src['scopeHex']
assert src['historyComplete'] is False and src['creditEligible'] is False
assert src['independentConsensusVerified'] is False
assert src['spendableBaseUnits']=='0' and src['withdrawalAuthorized'] is False
print('PASS original ZIP, all 280 checksums, 283 sorted paths, IDL, ELF, ProgramData, explicit denials')
PY
```

Additional independent signed-wire check performed separately against this same original ZIP using Node.js 22 built-in Ed25519: original Initialize, Deposit, Refund signature verification passed; full wire equals original base64 `getTransaction` and is included in original base64 `getBlock`. Initialization slot 10, deposit 42, rejected duplicate 74, refund 75. These are selected blocks, **not** complete produced-slot history or independent consensus.

## Source-domain tuple — exact ORIGINAL PR55, not a new integration run

- Genesis `BvMfXydfN4vFMSkWzDhBb5mwM1cJYyXswzsFFhrZ5dVv`.
- Program `387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1`.
- Mint `3V3vun9zdKfaVtW6i89kdagbBnTvACMCVmdWRtcsg8ig`.
- Initialized 32-byte scope `85738d0a1b3e751bfa70c94700b1f0b2ef8a881839cb585071219962c9616fe7`.
- Config `BJyyJjp3yBPLuM44aLWD7rj84oDKkYaQQZrBFWXAtj7n`; vault `F3wqHV1bfKfTDsmyp8A54Hm2eNhn6zoqk3YkbLW69qKQ`; receipt `5HzYHP6kwfi7GNxhACYZxqtjU3Zypr1UMS3DQjmgn1mH`.
- Original initialization tx `2mk39P1WRM3YTSM9N2G414NUtm1P3mThEiMEUytHB5ZnAiTy2LEzGVQ1niY8QULhWW5X2z9QQXuJJXtXxhjQ1JLn`, slot 10.
- Original deposit tx `4ibizpAzc2BmXAMhoPy15KmrvREnQMXcDp3QZszMGJL8wmWnNLG8GhKVbPjiLCMpS98k6c5GnpDCCuMdUkPeKETp`, slot 42; nonce 42017; amount 250000 base units; recipient `b15cdf711a9c383f25701696276b79f71110ebeefe73cc33b60bd4a9b2dffadb`.
- Original refund tx `2fYdaQQ9SMDrFQfHShT27zgKfF9sa8fEPwiQ6dUxfE6jd1DayvLzj59qiAYykzXFNyAi3A7JvUyAWKoxeahEenQX`, slot 75.
- IDL SHA-256 `d17e9dc3877ee187065f3149088d2d6921d7995d3e661239f82fcece0de3e007`; ELF SHA-256 `13978320ac23cdb6cc5140100ad7c34997a93a6be5ce5dcc93d92a0650fea647`; post-sync tracked-tree digest field `ad6222d6dda0a8b96f511d3468109c57934e7a5eabb98386f376972229dfdec9`.
- Original manifest `localnet-evidence/demo-source-domain.json` SHA-256 `dcbee3b3402fac226a85281ea844e395d5a7d010844a34f4d53ed5860a502136`. Preserve literal JSON, manifest entries and producer SHA; never replace them with newly derived values.

## A1 source-policy review, #60 and #61 (2026-11-14)

**Source-domain handoff: APPROVE THE PRINCIPLE, NOT A RUNTIME ACCEPTANCE.**

- PR #60 HEAD `b869da9ab07dd7c4aefec67c671aaf683bdccef1`: `demo/a0-execution-bound-dna.mjs` produces a distinct **CI build input**, retaining A4's original tracked archived-source `dna.yaml` and recording mismatch; requires source producer and observer consumer SHAs to equal same execution, original uploaded manifest checksum, OBS v2 witness deposit signature, nonce/amount/recipient/scope and explicit four denials. Original signed evidence remains original, not re-labelled.
- PR #61 HEAD `fc0cc94e17e7dbb4c6f3c8c9d6086fe3ae23e249`: `demo/a0-bind-same-run-dna.mjs` writes same-run genesis/program/mint/**initialized scope** and a public deterministic network seed into an **ephemeral checkout only**, saving original tracked template and derived YAML. `.github/workflows/integration-snapshot.yml` requires `solana-lifecycle` + `cross-lane-js` successful **within the same workflow run** and downloads their original artifacts before staging the DNA. No #55 identity is used as a fresh run's source.
- Both designs must **reject any mix** of genesis, program, mint, initialized scope, signed initialization, deposit signature, receipt/config/vault, original signed wire, source manifest/producer commit, IDL/ELF and Observer consumer code version from different deployments. Assert original source manifests unchanged byte-for-byte through the handoff, retain both producer and consumer commit identities, and do not treat equal self-reported RPC views as consensus.
- These are **static source-policy reviews only**. A1 PRs explicitly report the A4 native HAM Cargo.lock missing, so no successful complete locked build, installed DNA, external Lair, approved ABI, audit ActionHash or readback proven. Do not authorize call on source-property match alone.

## Deployment-epoch decision — HOLD, do not fabricate

Original archived UpgradeableLoader ProgramData address: `Ay7P61LeQXPnD7mqTo5ma73qhauBd7tC6LYUXe8RdNTY`.
Program account points to it; loader state tags are Program=2 and ProgramData=3; ProgramData `upgradeSlot=0`, option flag `Some`, 32 zero bytes for authority public key (display `11111111111111111111111111111111`), and bytes after standard offset 45 match original deployed ELF. This proves only the archived snapshot's loader state and executable bytes. It does **not** prove an operator-governed upgrade epoch or independent current/future upgrade history. A fixed ProgramData address persists across upgrades, a slot may repeat on a disposable restored chain, and a hash of an arbitrary tuple would be a locally defined identifier rather than authenticated deployment-epoch evidence.

**Proposal:** Use separate witness fields `observedProgramDataAddress`, `observedUpgradeSlot`, `observedElfSha256`, `observedProgramId`, `sourceGenesisHash`, `originalSourceManifestSha256`, plus `deploymentEpochId:null` and `deploymentEpochAuthenticated:false`. A future versioned epoch contract needs a reviewed canonical definition, real independent per-epoch confirmation and explicit restore/upgrade/rollback policy. A derived fingerprint may be named `observedExecutableFingerprint` **only if explicitly non-authorizing**; never call it a proven epoch.

## Anchor generated-file provenance — PR55 original, not source-controlled changes

`Anchor.toml` at original Git SHA contains the development placeholder `Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS`, cluster `Localnet` and no `features` or `hooks`. The original CI ran `anchor keys sync` after creating fresh local disposable keypairs, yielding the **working-tree** program `387eqrHkQHuZG82k8s4cGA3v5U8f433C2iWQe9x8LYG1` and updating exactly two tracked paths: `Anchor.toml` and `programs/deposit_prototype/src/lib.rs`. The original archived `anchor-keys-sync.patch` also shows generated Anchor tool normalization (`features`, `hooks`, `localnet` case). Do NOT commit it as upstream authored config or label it malicious without further evidence.

Original `tests/solana/localnet-build.sh` requires clean tracked checkout BEFORE sync, captures `tracked-pre-sync.sha256`, `anchor-keys-sync.patch`, changed-name list, `tracked-post-sync.sha256`, `build-inputs.sha256` and `cargo-lock.sha256`, checks post-build tracked hashes unchanged, checks generated IDL/Rust/config/keypair IDs equal; the original artifact retains these provenance files. Reproduce only on a disposable checkout at exact source SHA, apply exactly the archived two-path patch with `git apply --check`, verify pre-sync hashes and post-sync hashes and `Cargo.lock`, then hash actual generated IDL/ELF. PR #61 `scripts/ci/a0-replay-source-patch.mjs` reconstructs this exact patch in an ephemeral integration checkout, tests paths and checks both complete tracked-state SHA manifests; it does NOT rewrite original Git blobs. Treat any third changed path, unexpected lock mutation, wrong pre-tree SHA or unreviewed post-sync drift as **HOLD**.

## Agent 5 security handoff

Explicit economic denial throughout: `creditEligible:false`, `independentConsensusVerified:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`, `historyComplete:false`. Source evidence consists of selected archived blocks and observations, not a full produced-slot interval, independent consensus/checkpoint or nonrefundable custody. First initializer remains a risk. Refund is genuinely signed but not a source-authenticated complete economic cancellation state. No Holochain spendable credit, real Unyt coordinator mutation, withdrawal, main merge or Gate C approval. A5 should independently inspect copied ZIP digest, source-domain and signed-wire equality, ProgramData/ELF, the generated Anchor patch, A1 build/install gates and cross-run mixing negatives before accepting any further stage.
