# Public Unyt release provenance vs. executable zome equivalence

**Observed 2026-11-13. PR #34 / Issues #14, #18. STOP SHIP.** This note
separates an obtainable public binary *release* from inaccessible exact zome
source and from on-network economic validation. It does not verify any
production Alliance DNA or grant value issuance.

## Pinned public release that could be independently downloaded

The public GitHub API for `unytco/unyt-sandbox` reports stable release
`v0.117.0`. It publishes the following assets and SHA-256 values:

| GitHub release artifact | Reported size | Reported SHA-256 |
|---|---:|---|
| `unyt.happ` | 5,280,080 bytes | `0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1` |
| `alliance.dna` | 5,307,500 bytes | `918c3eb1a96c5cf00d0ca5af60f675e32a561857225883059276581c7e45aa71` |
| `SHA256SUMS` | 2,251 bytes | `7736dee1f1d3867f99ec4098f7a30e2f9ba44475c2127191e55720fdf49f6f6f` |
| `SHA256SUMS.minisig` | 311 bytes | `ee846f0cb6ca17289c82de2dc15235c7eb1b3a2985f018f9b546ed4dfc7dd490` |

Release URL: https://github.com/unytco/unyt-sandbox/releases/tag/v0.117.0

The public release README documents a checksum-signing minisign key:
`RWTMgl5pLxSOVpkRiS5CMlFkrn7enASWilDEzRpfPeTBcBBJXcdu/rFO`.
Its provenance still requires independent maintainer/key-trust review; knowing
a key published by the same repository is **not** an independent attestation.

The executable release-byte checker is:
```bash
bash tests/holochain/sandbox/verify-unyt-release.sh /tmp/verified-unyt-v0.117.0
```
It pins the release URL and expected digests, downloads all four artifacts,
verifies the manifest's minisign signature, checks included asset hashes,
then copies the artifacts only after successful verification. Exit 0 means
**release artifact bytes matched**, NOT that the public `rave_engine` crate
matches every compiled zome or that a conductor executed those zomes.

**Actual local execution:** `bash -n` on this checker passed. The checker
itself exited **2** with `BLOCKED_UNYT_RELEASE_CHECK: missing minisign`.
This runtime also cannot resolve GitHub release download hosts; no binary
asset has been downloaded and hashed here.

## Precise source-equivalence blocker

The release repository `.gitmodules` declares:
```text
[submodule "unyt"]
  path = unyt
  url = git@github.com:unytco/unyt-app.git
  branch = main
```
The current release repository's `unyt` gitlink points to commit
`29ed3af2fe054b8bc5f493b3c5c26fe665ff4bac`. GitHub repository
metadata retrieval for `unytco/unyt-app` returned **404** under the
available connection. This could mean private/inaccessible rather than
nonexistent. No exact source tree, build instructions, integrity/coordinator
zome code, compiled WASM hashes or source-to-release match were verified.

Release assets may permit **black-box** sandbox testing if a compatible
Holochain conductor can be installed, but they do not establish source
equivalence, deployed Alliance identity, or validation of global authority.
Do not claim success for M2/M3 by launching a demo/synthetic DNA.

## Runtime compatibility and executable gate

The Holochain 0.7 compatibility table pins the matching conductor/hc/hdk/hdi
family. Holochain 0.7.1 also has API differences from 0.7.0. Check actual
zome target requirements rather than assuming any binary tagged 0.7 is
interchangeable with a published `rave_engine` 0.15.0 library.
References:
- https://developer.holochain.org/resources/compatibility/holochain-0.7/
- https://developer.holochain.org/resources/upgrade/upgrade-holochain-0.7/

The existing `tests/holochain/sandbox/check-toolchain.sh` remains a separate
**fail-closed exit-2 gate**. Its source commit, hApp checksum and deployment
DNA inputs cannot be satisfied by the bare registry crate or by guessed
DNA hashes. This container has no `holochain`, `hc`, `cargo`, or `rustc`
executable, so there has been **no** conductor start, zome install, zome call,
source-chain partition, or DHT history validation here.

## Authoritative standing: what each layer can and cannot prove

| Question | Published library / public interfaces | Actual release coordinator/integrity execution | Pending adversarial proof |
|---|---|---|---|
| `ParkedLinkStanding` | Enum distinguishes `Parked`, `Unparked`, `NotAParkedLink`, `NotHeld`. | **Not executed** | A stale/forked/DHT-conflicted parked link must not permit two withdrawals. |
| Source-chain forks | Published types can describe source records. | **Not executed** | Force competing chain heads and demonstrate a single authoritative spend. |
| Conflicting DHT histories | Gossip views and local source chains must be considered independently. | **Not executed** | Two partitioned nodes accepting incompatible recovery orders cannot each produce transferable credit. |
| Agreement replacement | Public recovery scripts maintain agreement-local carryover. | **Not executed** | Replacing agreement/epoch cannot recover the same commitment twice. |
| Recovery of recovered commitments | Published API does not imply a global monotonic recovery set. | **Not executed** | Test repeated recovery after agent reboot, alternate operator and migration. |
| DNA migration | Holochain integrity-zome changes alter DNA/network identity. | **Not executed** | Cross-DNA commitment/order identity and durable migration fence must be proven. |
| Lost receipts | A published receipt type is not guaranteed visibility or consensus. | **Not executed** | Crash after local agreement execution but before receipt publication, then retry. |
| Withdrawal under partition | Public HOT signer queries standing for a specific order. | **Not executed** | Reorg/partition + signer retry must never authorize duplicate external value. |

The published source/library interpretations are research leads, **not verified
deployed exploits**. Neither a shadow journal nor two RPC providers is a
cross-network consensus/finality oracle.

## Blocker-to-proof checklist

1. Obtain independent provenance for the exact deployed Unyt Alliance DNA,
   source commit, signed release and zome WASM; if release DNA differs from the
   deployed DNA, restart with the actual deployment's artifacts.
2. On a network-enabled runner, run `verify-unyt-release.sh` and
   `tests/holochain/rave-engine/verify-crate.sh`; archive byte hashes,
   minisign verification, tool versions and full logs.
3. Install compatible `holochain` and `hc`, then build/reconcile exact
   coordinator/integrity zomes against `unyt.happ`/`alliance.dna`.
4. Only then run a real multi-conductor test matrix with concrete zome calls,
   forks, late receipts, recovery replays, migration and partitions. Require
   independent SEC review.
5. Keep `creditEligible:false`, `spendableBaseUnits:"0"`, and
   `withdrawalAuthorized:false` in every shadow response, regardless
   of OBS transaction evidence. The refundable SOL program is still not
   usable collateral.
