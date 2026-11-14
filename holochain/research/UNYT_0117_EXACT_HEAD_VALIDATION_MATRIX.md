# RAVE S0 exact-head execution matrix and B2 source/call gate

2026-11-14 UTC. Branch: `agent/rave/9-rave-validation`; PR #34 (DRAFT).
**STOP SHIP / B2 BLOCKED.** This file contains invocation requirements, not a claim
that any fresh CI run succeeded. Always capture `git rev-parse HEAD` and
the job's `GITHUB_SHA`; never substitute an old RAVE or integration SHA.

## Source-owned CI execution matrix

| Gate | Pinned invocation / evidence | Acceptance condition | What it cannot prove |
| --- | --- | --- | --- |
| S0-RELEASE | `bash tests/holochain/sandbox/verify-unyt-release.sh "$PWD/ci-artifacts/verified-release"` | Stable v0.117.0 minisign published-key verification, trusted comment, four SHA-256s; preserve exact bytes | Signing-key independent identity, source-to-WASM, deployed DNA |
| S0-HOST | `bash tests/holochain/rave-engine/verify-crate.sh` then `cargo +1.95.0 test --locked --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets -- --nocapture` | Published `rave_engine=0.15.0` crate checksum; lockfile, pinned compiler; no ignored/failing tests | Unyt zome implementation, issuance authority |
| S0-HC | pinned Holonix `github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da` and `bash tests/holochain/sandbox/inspect-verified-unyt.sh "$PWD/ci-artifacts/verified-release" "$PWD/ci-artifacts/hc-inspection"` | Actual Holochain 0.7.1 unpack and manifest/DNA/WASM inspection | Coordinator ABI or callable semantics |
| S0-INSPECT-NEGATIVE | exact node commands below, AFTER verified bundle unpack | genuine positive inventory AND tamper/swap expected exit 2, caller command exits 0 | zome execution or read-only behavior |
| S0-CONDUCTOR | `bash tests/holochain/sandbox/probe-verified-unyt-conductor.sh "$PWD/ci-artifacts/verified-release" "$PWD/ci-artifacts/conductor-audit"` within pinned Holonix | Disposable same-conductor install/restart and actual read-only Admin API app/cell ID match | isolated networking, source-chain consensus or second conductor |
| S0-SHADOW | `node --test tests/holochain/*.test.mjs` | Every test passes, none skipped, including nested OBS denial, integer, local-journal and two-author fixture checks | Solana independent consensus, durable exactly-once, a real zome call |

The current workflow already runs release, host, Holonix, conductor and shadow jobs
on branch push, with no CI workflow modifications in PR #34. Its Holochain/WASM
inspection job does **not** automatically invoke the new negative test;
Agent 1 owns that integration change and full combined candidate.

### Exact Agent 1 post-unpack command (run from checkout root)

Use only files extracted from the same publisher-signed bundle. Run after
`inspect-verified-unyt.sh` succeeded and verified SHA256SUMS; fail the CI step
on any nonzero exit. No mocking, no `|| true`, no shell pipeline exit masking.

```bash
set -euo pipefail
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
test -s ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm
test -s ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm
node --version | tee ci-artifacts/unyt-wasm-node-version.log
sha256sum ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm \
          ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm \
  | tee ci-artifacts/unyt-wasm-sha256.log
node tests/holochain/sandbox/inventory-verified-unyt-wasm.mjs \
  ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm \
  ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm \
  > ci-artifacts/verified-unyt-export-inventory.json
node tests/holochain/sandbox/assert-verified-unyt-wasm-inventory.mjs \
  ci-artifacts/hc-inspection/dna-unpacked/transactor.wasm \
  ci-artifacts/hc-inspection/dna-unpacked/transactor_integrity.wasm \
  2>&1 | tee ci-artifacts/verified-unyt-inventory-test.log
```

The static assertion expects transactor 121 function/one memory exports and
transactor_integrity 8 function/one memory exports. The two negative cases
are a one-byte integrity mutation and a coordinator/integrity file swap.
The inspector must reject both at code 2 with a SHA mismatch; the wrapper
must exit zero only when positives and **both** expected negatives pass.
No WebAssembly guest code is instantiated.

### Fixed public artifact identity

Source: unytco/unyt-sandbox GitHub release `v0.117.0`, published
2026-10-28, plus locally archived release verification artifacts.

| Exact bytes | SHA-256 |
| --- | --- |
| unyt.happ | `0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1` |
| alliance.dna | `918c3eb1a96c5cf00d0ca5af60f675e32a561857225883059276581c7e45aa71` |
| SHA256SUMS | `7736dee1f1d3867f99ec4098f7a30e2f9ba44475c2127191e55720fdf49f6f6f` |
| SHA256SUMS.minisig | `ee846f0cb6ca17289c82de2dc15235c7eb1b3a2985f018f9b546ed4dfc7dd490` |
| transactor.wasm | `8337488fcff06e8d1b37f68bc8dc2a14a33492769bce1fdb183406ae032c770d` |
| transactor_integrity.wasm | `1bcbf9993e5695247d9c54c7b3ee1cbd825cf4167606ee6af3691a39d01a68ab` |

Actual previous disposable sandbox installed DNA hash:
`uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ`.
**Not proof of any production/deployed DNA.**

## Maintainer-facing exact-source and authority attestation request — NOT SENT

The authoritative `unytco/unyt-sandbox@v0.117.0` `unyt` gitlink
names `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf`.
The linked GitHub connection receives 404 from that exact source commit;
it may be private, deleted, or inaccessible. Do not substitute a newer main
gitlink. Request from an authenticated Unyt release maintainer:

1. Read-only review of exact `d2fa9c...` source tree, recursive gitlinks,
   authenticated immutable archives and complete dependency sources.
2. Byte-for-byte source-to-WASM reproducible builds for coordinator/integrity:
   `Cargo.lock`, compiler and target triples, Rust/WASM/HDK/HDI versions,
   build arguments, features, environment, container digest, postprocessors,
   checksums and two independent builders' signed attestations.
3. An identity-bound signed release attestation relating that source commit
   to `v0.117.0`, the publisher key, published hApp/DNA and both WASMs;
   clarify key rotation and verify out-of-band maintainer identity.
4. Exhaustive externally callable and callback ABI for `whoami`,
   `get_status`, `get_parked_link_standing`, `get_recovered_commitments`:
   arguments, serialized output, errors, effects, writes, validations,
   entry/link/countersigning semantics, and runtime version compatibility.
5. Legitimate caller author public-key provenance, membrane and capability
   requirements, function-scoped grants if any, secret-handling and revocation;
   explicitly signed audit-only approval for the proposed harmless call.
6. Deployment proof: production/test DNA hash, modifiers, network seed,
   properties, role mapping, DHT/bootstrap/relay configuration, epoch,
   governance, and any migration from signed **Sandbox** DNA.
7. Refund, ParkedLinkStanding, recovered commitments, fork/rejoin and
   source-chain restore semantics, including conflict resolution and
   authoritative replay/rollback rejection.

No contact or approval has occurred. Request does not authorize a capability
grant, production access, economic mutation or any coordinator call.

## Proposed whoami candidate — not executable yet

All four names appear only in a SHA-locked *static export inventory*.
This is not a callable ABI, source equivalence, proven read-only behavior or
authorization. The minimum possible first runtime experiment is an audited
`whoami` call on the disposable author's **own** isolated cell, solely after
source-equivalent implementation, exact input/output schema and no-write
semantics are independently inspected, caller identity/capability established,
and Agent 5 explicitly approves the action. Even an empty payload is presently
UNAPPROVED. The other economic-domain exports are not fallback candidates.
No zome call or grant has been made.

## Two separately keyed conductor prerequisite checklist

The new read-only `audit-two-conductor-preflight.mjs` can compare two captured
`hc client call list-apps` / `list-cells` JSON files and separately protected,
existing local roots. It checks the pinned **Sandbox** DNA, enabled/one-cell
role identity, different reported agent keys, two disjoint canonical directory
roots and root-mode privacy without opening keystores or source-chain DBs.
For *already collected* evidence only, invoke:

```bash
node tests/holochain/sandbox/audit-two-conductor-preflight.mjs \
  /private/a/installed-apps.json /private/a/list-cells.json /private/a/root \
  /private/b/installed-apps.json /private/b/list-cells.json /private/b/root
```

A consistent result is labeled `consistent-not-proven`; its runtimeStatus
remains BLOCKED. Admin JSON may be forged and a different agent public key
does not prove independent protected Lair secrets or distinct source chains.
Do not use it to claim a second conductor has run.

Before any real two-conductor experiment, require separate newly generated
keystores and DBs with OS file permissions, identical reviewed DNA/seed and
modifiers, proven no shared source chain/agent secret, demonstrable network
isolation (inspect actual sockets and packet captures; `network mem` alone
does not prove it because config retains public bootstrap/relay endpoints),
logged clean restart/recovery, controls for partitions/rejoins, and scrubbed
logs without Lair socket tokens, credentials or raw DBs. Keep source-chain
finality, DHT convergence and anti-replay **UNPROVEN** until executed.

## OBS → RAVE release gate

OBS PR #36 is a signed-wire/archival **claim** under independent RPC evidence,
not a Holochain economic proof. The parent `solana-deposit-evidence-v1` and
nested `solana-receipt-observation-v1` must each contain literal:
`creditEligible:false`, `independentConsensusVerified:false`,
`spendableBaseUnits:'0'`, `withdrawalAuthorized:false`.
All RAVE review and test-only record results emit the same four negatives.
No JS Number scaling for u64 money values; source decimal text + BigInt only,
and test-only six-place signed i64 arithmetic checks cannot establish mapped
units. Conflicting hashes, receipt refund contradictions, occurrence reuse,
slot rollback, forged scopes/DNA/epoch are denied in one local journal.
The adapter's duplicate diagnostics operate on a *copy* of that journal.

Independent Map journals still admit the same receipt independently:
not global exactly-once, not an external trust anchor and not a spendability
certificate. Reject any request to use these checks for credits, withdrawals,
live network calls, production deployments or a main merge.

**B2 stays BLOCKED** pending exact source/build/capability attestation,
SEC approval of one harmless call, independent real runtime evidence, and
later separately scoped economic/security architecture review.
