# Unyt Sandbox v0.117.0: actual Holochain 0.7.1 bundle inventory

**Date:** 2026-11-14 UTC. **Scope:** public Unyt **Sandbox** release only; **NOT** proof of deployed Unyt Alliance economic/network identity. **Stop ship** / no economic authorizations.

## Executed provenance

GitHub Actions [run 43535051961](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43535051961), source commit `cb70c0e4813185488a6b1ffec2fbc8c9f4e2219c`:

- Release signature and four SHA-256 checks: **PASS**.
- Published `rave_engine =0.15.0` pinned Rust native tests: **PASS**.
- Pinned Holonix/Holochain 0.7.1 `hc app unpack`, `hc dna unpack`, every extracted WASM SHA-256 and `hc dna hash`: **PASS**.
- Disposable conductor installation at this commit: **FAIL**, before installation: in-process Lair Unix socket path too long (`SUN_LEN`). This is a test path length failure, not an Unyt integrity validation result. A shorter `/tmp` disposable sandbox fix is separately committed for CI verification.

CI artifact `rave-unyt-hc-inventory-cb70c0e4813185488a6b1ffec2fbc8c9f4e2219c`, artifact id `14088698925`, ZIP SHA-256 `eaf49d02e0422e842a3a4916b17e15f1d0f26e62182ef97fa29dd7c94fa59767`; retention 14 days. Inspected unpacked YAML, embedded `.dna` and `.wasm` bytes from this artifact. The complete published `unyt.happ` remains available from `unytco/unyt-sandbox` release v0.117.0; the ZIP itself is a job artifact, NOT a new release attestation.

## hApp manifest (`hc-inspection/happ-unpacked/happ.yaml`)

```yaml
manifest_version: '0'
name: unyt
description: null
roles:
- name: alliance
  provisioning:
    strategy: create
    deferred: false
  dna:
    path: alliance.dna
    modifiers:
      network_seed: null
      properties: null
    installed_hash: null
    clone_limit: 5000
allow_deferred_memproofs: false
bootstrap_url: null
relay_url: null
```

The hApp has exactly one role, `alliance`. The role's `network_seed: null` override does **not** replace the embedded DNA's seed. `installed_hash: null` means the release manifest does **not** assert a particular installed network DNA hash. No explicit membrane proof is listed in the manifest; this does not prove an unprivileged agent can install or call any given zome.

## Embedded DNA manifest (`hc-inspection/dna-unpacked/dna.yaml`)

```yaml
manifest_version: '0'
name: alliance
integrity:
  network_seed: 00000000-0000-0000-0000-000000000000
  properties: null
  zomes:
  - name: transactor_integrity
    hash: null
    path: transactor_integrity.wasm
    dependencies: null
coordinator:
  zomes:
  - name: transactor
    hash: null
    path: transactor.wasm
    dependencies:
    - name: transactor_integrity
```

Bundled DNA hash as emitted by Holochain 0.7.1 `hc dna hash`:

```text
uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ
```

**DNA identity caveat:** this is the hash of the **bundled** `alliance.dna` with its original modifiers. Cell identity must still be read from an actually installed app. Replacement network seeds, properties or roles can change deployed DNA identity.

## Complete extracted WASM SHA-256 inventory

| Zome | WASM bytes | SHA-256 |
| --- | ---: | --- |
| Integrity `transactor_integrity` | 8,805,280 | `1bcbf9993e5695247d9c54c7b3ee1cbd825cf4167606ee6af3691a39d01a68ab` |
| Coordinator `transactor` | 12,932,323 | `8337488fcff06e8d1b37f68bc8dc2a14a33492769bce1fdb183406ae032c770d` |

The inspected ZIP contained exactly these two extracted WASM files. Digests were independently recomputed from ZIP bytes and match `hc-inspection/unpacked-wasm-hashes.sha256`.

The embedded `alliance.dna` inside `unyt.happ` has SHA-256 `918c3eb1a96c5cf00d0ca5af60f675e32a561857225883059276581c7e45aa71`, **identical** to the independently verified published `alliance.dna`. Public `unyt.happ` SHA-256 is `0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1`.

## Toolchain and source boundary

Actual CI output:

```text
holochain 0.7.1
holochain_cli 0.7.1
cargo_pkg_version: 0.7.1
hdk_version_req: 0.7.1
hdi_version_req: 0.8.1
lair_keystore_version_req: 0.7.1
rustc_version: rustc 1.95.0
```

The pinned Holonix commit is `a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da`. The corrected NixOS signing key enabled real binary-cache substitution; there was no SDK/compiler upgrade.

The exact release source gitlink remains `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf`, returning **404 to available credentials**. A signed public sandbox artifact is not proof of source-equivalence to `rave_engine 0.15.0` or to a production deployment. Integrity validation code, coordinator authorization rules, membrane callbacks and capability grants are **not** established from an unpacked manifest. They require source and safely executed runtime tests.

## What is still required

1. Pass a real disposable conductor hApp install and restart, collect actual installed `cell_id` and DNA hashes (not merely the bundled DNA hash). Do not upload keystores.
2. Obtain authoritative source for exact gitlink and match reproducible WASM build digests.
3. Request maintainer-approved **audit-only** zome function names/inputs/capabilities before calling any Unyt coordinator extern. No economic or privileged functions.
4. Only when source equivalence is proved: two-conductor fork/partition/rejoin, `ParkedLinkStanding`, double-recovery, agreement replacement and DNA migration adversarial validation. Independent SEC review mandatory.
5. Continue shadow adapter tests only as explicitly non-economic, with `creditEligible:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`.

No live issuance, spendable credits, transfers, withdrawals or mainnet custody are enabled by this inventory.
