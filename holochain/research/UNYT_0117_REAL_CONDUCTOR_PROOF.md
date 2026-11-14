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
- Its new invocation requests `hc sandbox ... network mem` to avoid contacting the default public Holochain development bootstrap and relay endpoints; only a new CI run can establish that the CLI invocation is correct and still installs successfully.
- Existing non-economic Holochain shadow tests are now a separate GitHub Actions job. They are **model/test-only** until genuine validator-backed Observer evidence and a reviewed audit-only Unyt zome entry point are available.

## Not proven; economics remain disabled

**NO zome calls occurred.** Neither `list-apps` nor `list-cells` is a zome call. No externally approved, harmless and authorized read-only `transactor` function name is available; do not guess one. `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf` is still inaccessible to the available GitHub credentials (404), so integrity/coordinator source equivalence is absent. The published RAVE crate is not automatically equivalent to the deployed WASM.

The following require exact source-equivalent programs and adversarial tests before any economic release: `ParkedLinkStanding`, conflicting source-chain histories, duplicate recovery, agreement replacement, partition/rejoin, source-chain warrants, migration and Holochain 0.7.1 countersigning feature support. Do not infer ledger finality from one local conductor restart or one network agent.

Maintain `creditEligible:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`; **no spendable credit issuance, withdrawal, live transfer or mainnet custody.**
