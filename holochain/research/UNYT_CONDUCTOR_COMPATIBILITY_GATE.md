# Unyt v0.117.0 — Holochain compatibility and real-conductor gate

**13 November 2026 · PR #34 · Issues #14 and #18 · STOP SHIP / non-economic only.**

This report complements `UNYT_RELEASE_PROVENANCE.md`. It does not claim installed cells, real zome execution, verified release bytes, or globally final economic state.

## Version compatibility: observed vs unknown

| Component | Verifiable observation | Still missing |
| --- | --- | --- |
| Public Unyt Sandbox | Stable v0.117.0, tagged repository commit `a636558e2da4d0b4a01182c6dfa5e615cae9a055`, published 2026-10-28. | Proof that this *Sandbox* equals any deployed Alliance DNA. |
| Holochain runtime | Earlier official Unyt Sandbox **v0.112.0 release notes explicitly say Holochain 0.7.1**; later v0.117.0 appears to remain on that line. | Tagged v0.117.0 executable conductor version and exact source lock. Do not infer from release chronology alone. |
| Required holochain skill | `Soushi888/holochain-agent-skills` skill v1.0.0-rc.2 targets `hdk 0.7.1`, `hdi 0.8.1`, `holonix main-0.7`. | Unyt source versions must be established before applying any skill API pattern. |
| RAVE harness | Isolated public `rave_engine =0.15.0` harness; historical CI resolved `hdk 0.7.1`/`hdi 0.8.1`. | Nothing proves those exact packages are Unyt's shipped zomes. |
| Actual tagged Unyt zomes | v0.117.0 `.gitmodules` points to `git@github.com:unytco/unyt-app.git`; tagged gitlink `d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf`. | `unytco/unyt-app` returns GitHub 404 under available credentials; no `dna.yaml`, `happ.yaml`, Cargo.lock, zome source or build attestation. Do **not** use later `main` gitlink `29ed3af2fe054b8bc5f493b3c5c26fe665ff4bac`. |
| Features | Holochain 0.7.1 changes capability grants and direct signals. Countersigning/migration may be feature-gated. | Whether *shipped* conductors enable `unstable-countersigning` and `unstable-migration`, actual cap/membrane configuration and source-chain restore support. |

References: [Unyt v0.112.0](https://github.com/unytco/unyt-sandbox/releases/tag/v0.112.0), [Unyt v0.117.0](https://github.com/unytco/unyt-sandbox/releases/tag/v0.117.0), [Holochain upgrade](https://developer.holochain.org/resources/upgrade/upgrade-holochain-0.7/), [Holochain skill](https://github.com/Soushi888/holochain-agent-skills/tree/main/skills/holochain).

## Release artifacts — published digests, NOT downloaded/hashes verified

The GitHub API for v0.117.0 reports:

| File | Size (bytes) | Published SHA-256 |
| --- | ---: | --- |
| `unyt.happ` | 5280080 | `0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1` |
| `alliance.dna` | 5307500 | `918c3eb1a96c5cf00d0ca5af60f675e32a561857225883059276581c7e45aa71` |
| `SHA256SUMS` | 2251 | `7736dee1f1d3867f99ec4098f7a30e2f9ba44475c2127191e55720fdf49f6f6f` |
| `SHA256SUMS.minisig` | 311 | `ee846f0cb6ca17289c82de2dc15235c7eb1b3a2985f018f9b546ed4dfc7dd490` |

The publisher's `README.md` and `identity.json` list key `RWTMgl5pLxSOVpkRiS5CMlFkrn7enASWilDEzRpfPeTBcBBJXcdu/rFO`. Two files controlled by the same publisher are **not independent key authentication**. Require a trusted, authenticated maintainer channel or independently pre-pinned key before accepting the minisign signature as release provenance. Published asset SHA-256 is not a downloaded binary check.

**Unknown:** exact embedded hApp/DNA manifests, integrity/coordinator WASM SHA-256, installed DNA hash (depends on DNA modifiers/network seed), source-to-WASM equivalence and deployed Alliance identity. The `.happ` and `.dna` file hashes above are **not** WASM or installed-DNA hashes.

## Real commands executed, strict provenance

The existing branch scripts were reproduced byte-for-byte into a disposable local workspace. `git hash-object` matched the fetched GitHub branch blobs before testing. Environment: Node v22.16.0, Git 2.47.3; no `minisign`, `holochain`, `hc`, `cargo` or `rustc`; network `git ls-remote` failed to resolve github.com.

```text
$ git hash-object verify-unyt-release.sh
3cac661f1795924c43143556bc8dd6b14e6012c3
$ git hash-object check-toolchain.sh
b95b4890a7289c70d1fc4863cea0236b6ab86cd4
$ bash -n verify-unyt-release.sh
# exit 0
$ bash -n check-toolchain.sh
# exit 0
$ bash verify-unyt-release.sh /tmp/verified-unyt
BLOCKED_UNYT_RELEASE_CHECK: missing minisign
# exit 2
$ bash check-toolchain.sh
BLOCKED_REAL_HOLOCHAIN_SANDBOX: missing holochain
# exit 2
```

**Not executed:** real release downloads, cryptographic minisign verification, bundle unpack, conductor install, any real zome call, source-chain or DHT consistency, Sweettest, forks, partitions, migration, persisted journal recovery or withdrawals. The fail-closed `check-toolchain.sh` **must not be relaxed to fake a passing check**.

## Actual multi-agent validation sequence (BLOCKED, not a model test)

1. Obtain the exact tagged source and build attestation, review the maintainer key independently, download all four release assets, then run `bash tests/holochain/sandbox/verify-unyt-release.sh /tmp/verified-unyt-v0.117.0` on a network-enabled runner. Record hashes and complete logs.
2. From *verified* release bundles, unpack the actual hApp and DNA with a **version-compatible** `hc`. Archive role/DNA manifests, every embedded zome WASM SHA-256 and role dependencies. Match against authoritative source and Cargo locks. Compute the **installed** DNA hash with actual role modifiers/network seed. Separately authenticate the target **test** Alliance's deployed DNA identity.
3. Install compatible Holochain 0.7.1 conductor / hc on an isolated host; archive `holochain --version`, `hc --version` and feature flags. Start **two separate conductors with independent keystores and agent keys**, install the authenticated disposable hApp on both, apply legitimate membrane/capability settings and archive `list_apps`/`app_info`/CellId/DnaHash outputs without secrets.
4. Discover actual exported zome names/functions from the authoritative source; make harmless, **read-only** calls with authorized agent capabilities. Record input/output, agent, cell, timestamp, source-chain query and integrated DHT operations. Show two-peer convergence using compatible Sweettest `await_consistency` or equivalent. **Never guess or call issuance/transfer functions.**
5. Only if the authentic test integrity/coordinator zomes support **non-economic** evidence entries, write a real shadow record and show its validation receipt, source-chain presence and replicated DHT state. A JavaScript adapter returning JSON without a conductor call does not count.
6. With an approved disposable test harness, exercise conflicting chain heads, ParkedLinkStanding invalidation, duplicate and recovered commitments, agreement replacement, successor-DNA migration, network partitions, lost receipts, restart/backfill, and competing withdrawal *claims*. Record both agents' views and actual validator decisions, including negative cases.
7. Require durable cross-agent/cross-epoch/cross-DNA replay evidence. A local source-chain `query()` is author-local; gossip is eventually consistent; countersigning and source-chain restoration are not proof of external Solana economic finality. `InitProperties` cannot act as a global replay ledger.

## Observer evidence handoff and non-economic interlock

OBS PR #36 defines `solana-deposit-evidence-v1` with `receiptSnapshot.kind=solana-receipt-observation-v1`. Include immutable genesis/program/mint/scope, receipt PDA and bumps, decimal `amountBaseUnits`, signature, transaction hash, occurrence identity, instruction/CPI path, finalized/observation slots and refund state. Negative tests: wrong scope/genesis/program/mint, forged or changed receipt/amount, changed transaction hash, replayed occurrence, late refund, stale slot, duplicate commitments after restart, migration replay and two partitioned authors. Any OBS `transactionVerified:true` describes OBS's claim, **not** independent finality verified by RAVE.

`holochain/transaction-shadow.mjs` is only an **in-memory non-economic journal**. Its existing tests are useful but do not satisfy real Holochain validation or global idempotency. Preserve `holochain/evidence-gate.mjs` unchanged. Every possible shadow outcome must retain:

```json
{"creditEligible":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

## Precise maintainer request and cross-lane dependencies

**Unyt maintainer, via authenticated out-of-band channel:**
- Access to or authenticated export of **exact** `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf`, its integrity/coordinator crates, DNA/hApp manifests, lockfiles, source build settings, reproducible build instructions and build provenance.
- Independently attested stable minisign signer key/fingerprint and the intended Holochain conductor patch/version and compile-time features.
- Zome/WASM SHA-256s, the *test network's* installed DNA hash (including modifiers), membrane/cap grants, read-only API names, test network/keys *without economic authority*, source-chain/parked-spend/countersigning/recovery/migration guarantees.
- Confirmation whether the public Sandbox DNA is or is **not** the intended Alliance for the bridge.

**OBS:** publish a versioned immutable transaction evidence fixture and refund/reorg/restart semantics. **CI:** run pinned release + crate checkers and Rust/Node suites on a network-enabled runner, capture unredacted logs, and create actual two-conductor job only after exact source is available; never report a skipped model as a conductor pass. **SEC:** independently review source-to-binary trust, replay across source forks and migrations, and hard finality/custody preconditions.

**Gates:** release-byte signature ❌ BLOCKED · source/WASM equivalence ❌ BLOCKED · exact runtime compatibility ⚠️ PARTIAL · two-agent real conductor ❌ BLOCKED · economic credit/withdrawals ❌ DENIED. Keep PR #34 draft, do not close #14/#18 on this report alone.
