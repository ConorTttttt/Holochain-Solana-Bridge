# Holonix 0.7.1 failure diagnosis and disposable Unyt runtime gate

**Date:** 2026-11-14 UTC. **PR:** #34. **Issues:** #14, #18. **Status:** STOP SHIP / no economic permissions.

## What actually failed

GitHub Actions run [43527114724](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43527114724), job **132235745506**, executed the pinned `github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da` dev shell on Ubuntu 24.04.

- Git checkout, release artifact transfer and Nix installer succeeded.
- The workflow configured an incorrect NixOS store signing key:
  `cache.nixos.org-1:6NCHdD59X431o0gWypbTjFOtA/0l6G5tXcKLQ3Y9vvs=`.
- The official Nix reference and the very same pinned Holonix flake instead specify:
  `cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=`.
- Nix logged many `ignoring substitute ... not signed by any of the keys in 'trusted-public-keys'` warnings for `cache.nixos.org`. Some Holochain CI Cachix artifacts were downloaded, but the full dependency closure was not substituted.
- The fallback source bootstrap reached `gnutar-musl-1.12.drv`, which failed with `./configure: line 4820: cmp: command not found` and `make: *** [Makefile:128: Makefile.in] Error 126`. The final `nix-shell-env.drv` then failed due to dependencies. The log does **not** establish a Holochain executable fault or a defect in Unyt's WASM; neither was run.

**Reviewed remediation:** replace only the wrong NixOS cache key with the independently documented official key, preserving `require-sigs`, original verified Holochain Cachix key, pinned Holonix revision, and Holochain 0.7.1. Do not suppress signature validation or silently upgrade. First change: commit `7a6097c1743b5a80f8cdb742b2426f94ab6204a6`.

Sources:
- Nix reference: https://nix.dev/manual/nix/2.30/command-ref/conf-file
- Official Holochain setup: https://developer.holochain.org/get-started/
- Pinned Holonix `flake.nix` at `a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da`.

## Verified toolchain intent and actual status

The pinned Holonix flake uses `nixpkgs?ref=nixos-26.05`, Holochain `holochain-0.7.1` (locked source `fdaa678786cd5618c36a7290aad69a5f1511d8a9`), and Rust 1.95.0. Its default shell includes both `holochain` and `hc`; this is a source-level verification, **not** proof that they launched in the failed job.

Run 43527114724 separately passed:
1. Published **Unyt Sandbox v0.117.0** `unyt.happ`, `alliance.dna`, checksum and minisign verification.
2. Native host-only `rave_engine =0.15.0` regression tests.

Those results establish **publisher-signed release bytes** and host crate tests. They do not establish installed cell identity, zome semantics or source equivalence.

## New fail-closed executable checks

`.github/workflows/rave-unyt-release.yml` now:
1. Retains the original publisher signature+digest verification job.
2. Inspects hApp/DNA/WASM bundles through the unchanged, pinned `hc` environment after the cache-key fix.
3. Adds `actual-non-economic-conductor-probe`, **conditional on successful bundle inspection**. It runs `tests/holochain/sandbox/probe-verified-unyt-conductor.sh`.

The new probe verifies the exact **public** hApp SHA-256 (`0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1`), uses an ephemeral local agent and in-process Lair in a throwaway sandbox, calls `hc sandbox generate` to install the real hApp, restarts the same on-disk sandbox with `hc sandbox run`, and reads installed apps and cells via the **read-only** `hc client call ... list-apps/list-cells` admin API. Installation, startup and persisted-state checks each fail closed. Sandboxed keystores and conductor databases are never uploaded; only logs are archived.

**Status of these new checks:** committed for CI; until the new commit's workflow jobs actually pass, do not claim the Holonix fix worked in a runner, bundle inventory exists, the hApp installed, cells persisted or any real zome call succeeded. The local assistant runtime has no Nix, `hc`, `holochain`, Cargo or access to the release download host. A shell syntax-only check was performed for the prototype probe before commit; this is not an executable Holochain test.

## Source equivalence and read-only zome entry points

The actual release gitlink `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf` still returns **404** to available credentials. Request from maintainers: access to that exact commit; reproducible build inputs and commands; integrity/coordinator source-to-WASM hashes; role and zome manifests; documented membrane, capability grants and explicitly approved **audit-only** read-only function names; and an authoritative declaration of whether this sandbox release corresponds to any deployed Alliance DNA.

Until those facts are verified, the conductor probe must not invent a zome function name, grant new economic capabilities or call issuance, transfers, recovery or withdrawal functions. CLI `list-apps/list-cells` are admin inspection, **not** zome calls. The static bundle identity also must not be confused with installed DNA identity after modifiers.

## Outstanding economic and fork/recovery risks

| Risk | Minimum real proof still needed |
| --- | --- |
| `ParkedLinkStanding` races | Conductor-backed, source-equivalent standing checks under competing authorization and delayed gossip. |
| Double recovery after agreement replacement | Durable globally bound commitment IDs across agreements, agents and epochs; denial on every duplicate. |
| Source-chain forks and partitions | Adversarial two-conductor split/rejoin with validation/warrant evidence; no spendability on conflicting views. |
| Crash/retry and lost receipts | Restart between source-chain commit and external acknowledgement; exactly-once or conservative quarantine behavior. |
| Holochain DNA migration | Explicit identity and epoch fence, retained history proof and no credit recreation after migration. |
| OBS provenance and refund collision | Test-only shadow adapter denies wrong scope/transaction/occurrence/amount, replay and refund conflicts; genuine validator evidence must be furnished by Agent 3. |

**Economic gate remains unchanged:** `creditEligible:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. No mainnet custody, live issuance or transfers; all unresolved cases fail closed. Independent security review and source-equivalent multi-conductor tests are required before revisiting these gates.
