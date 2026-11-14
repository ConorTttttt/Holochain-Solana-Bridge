# Verified Unyt Sandbox 0.117.0 real conductor lifecycle

**2026-11-14 UTC**, Holochain 0.7.1, PR #34. **Non-economic test, not production or deployed-network evidence.**

## First successful real lifecycle: run 43535536571

The exact branch commit was `919c4b40c829f5ff24b8852cd690217baec778a6`. All four jobs **PASS**:

1. Verify publisher-signed public `unyt.happ` and `alliance.dna` digests.
2. Verify published RAVE 0.15.0 host regressions.
3. Unpack real hApp/DNA and hash all two WASM modules using pinned Holonix 0.7.1 `hc`.
4. Start a **real** Holochain 0.7.1 conductor, install verified public `unyt.happ`, terminate that initial process, start the **same on-disk sandbox**, issue read-only Admin API calls `list-apps` and `list-cells` and confirm enabled app/installed cell remained present.

[Workflow run](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43535536571) and [conductor evidence artifact](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43535536571/artifacts/14088904439). Artifact SHA-256: `2e34167976d9a4c276e13ed763bd166e01afb734feec56cc79bead9bd9b9f0b1`, expires on normal 14-day GitHub Actions artifact retention.

The successful logs show:

```text
Conductor ready.
# lair-keystore running #
Conductor ready.
CONDUCTOR_INSTALL_RESTART_PASS: signed v0.117.0 public release
```

After restart, `hc client call list-apps` returned:

| Field | Observed actual value |
| --- | --- |
| Installed app ID | `unyt-v0117-audit` |
| App status | `enabled` |
| Installed role | `alliance` |
| Cell type | `provisioned` |
| Actual installed DNA hash | `uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ` |
| Disposable agent | `uhCAkdHRZkGPiwIp95KUJ-oAOV2lvfi0wm5XORm3P_qQCYcG_WpGS` |
| Actual network seed | `00000000-0000-0000-0000-000000000000` |
| Actual DNA properties | `[192]` (encoded null) |
| Manifest clone limit | `5000` |

The separate `list-cells` result contained the **same DNA hash and agent key**, proving that the installed runtime cell (not merely a release bundle) was present after conductor restart. This matches the bundled DNA hash reported by `hc dna hash` in the independent inventory workflow. This verifies a **local installed cell identity**, **not** a network's deployed identity or provenance.

The first new conductor attempt failed because a long GitHub workspace path exceeded Linux's `SUN_LEN` Unix socket path limit in in-process Lair. The reviewed fix uses a short disposable `/tmp/unyt-XXXXXX` root, preserving the pinned Holochain release. No successful probe invoked coordinator functions or changed Unyt data.

## Follow-on hardening / not yet verified by this initial successful run

- The pinned probe now parses `list-apps`/`list-cells` JSON and fails unless the installed app is enabled and has the exact DNA hash and a consistent agent key after restart. The initial successful run performed coarse text checks; enhanced identity assertions must pass a newer run.
- It now redacts the disposable Lair `socket?k=...` auth token from uploaded startup logs; earlier success logs contained a transient credential to a CI-only Lair keystore that was torn down with the runner.
- Its new invocation requests `hc sandbox ... network mem` and the new CI passes installation and restart. The generated NetworkConfig **still displays default public dev bootstrap and relay URLs**, so outbound network isolation is **not** established without connection-level evidence. Do not confuse memory-transport intent with proof that no network endpoint was contacted.
- Existing non-economic Holochain shadow tests are now a separate GitHub Actions job. They are **model/test-only** until genuine validator-backed Observer evidence and a reviewed audit-only Unyt zome entry point are available.

## Not proven; economics remain disabled

**NO zome calls occurred.** Neither `list-apps` nor `list-cells` is a zome call. No externally approved, harmless and authorized read-only `transactor` function name is available; do not guess one. `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf` is still inaccessible to the available GitHub credentials (404), so integrity/coordinator source equivalence is absent. The published RAVE crate is not automatically equivalent to the deployed WASM.

The following require exact source-equivalent programs and adversarial tests before any economic release: `ParkedLinkStanding`, conflicting source-chain histories, duplicate recovery, agreement replacement, partition/rejoin, source-chain warrants, migration and Holochain 0.7.1 countersigning feature support. Do not infer ledger finality from one local conductor restart or one network agent.

Maintain `creditEligible:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`; **no spendable credit issuance, withdrawal, live transfer or mainnet custody.**


## Latest verified combined baseline: run 43536513700

Pinned branch commit `b94774816a38c35805b835a4c1ef78ae4432d714` passed all **five** GitHub Actions jobs:

| CI gate | Outcome |
| --- | --- |
| Publisher-signed public Unyt v0.117.0 release bytes | **PASS** |
| Published RAVE 0.15.0 pinned native regressions | **PASS** |
| Pinned Holonix 0.7.1 bundle/DNA/WASM inventory | **PASS** |
| Disposable real conductor install, restart, exact enabled app/cell DNA identity | **PASS** |
| Existing non-economic OBS/Holochain shadow suite | **39 PASS, 0 FAIL, 0 SKIP** |

[Full workflow](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43536513700), [real conductor artifact](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43536513700/artifacts/14088719826). Last artifact ZIP SHA-256: `becebff694d9d573d6e32b6302f818dbab8dcedadd34c24f97bfff2a24f4431c`.

The latest `installed-apps-after-restart.log` reports `unyt-v0117-audit`, enabled `alliance` role, exact expected DNA `uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ`. The separate `list-cells` record matches the installed app's disposable agent and DNA. Exact JSON app/cell assertions passed. Both startup logs contain `socket?k=[REDACTED]`, with no leaked live Lair auth token value; no keystore/database is in the artifact.

**Network caveat:** `network mem` is accepted by the sandbox CLI and the local conductor lifecycle passes. Config output still contains `https://dev-test-bootstrap2.holochain.org/` and the default Iroh development relay URL; the test did not trace outbound sockets and therefore cannot independently prove there was no external networking. The sandbox account is disposable and the probe makes no economic zome calls.

**Open:** Actual approved read-only coordinator zome call, production identity, exact-release source/WASM equivalence, two-conductor validation, fork and recovery finality, and genuine validator-backed Observer evidence. Do not grant economic privileges.
