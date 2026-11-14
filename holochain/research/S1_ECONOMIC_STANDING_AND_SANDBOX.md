# Sprint 1/2 RAVE: source provenance, sandbox and economic-standing evidence

**Date:** 2026-11-13. **Issues:** #14, #18. **PR:** #34. **Gate:** DRAFT / STOP SHIP.
This report separates compiled-library checks, public artifact/source observations,
and **unexecuted** Unyt DNA/zome behavior. No spendable credit or withdrawal authority exists.

## 1. Recovered actual build evidence

From GitHub Actions run [43499276656](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499276656),
artifact `integration-rave-rust` (artifact id `14073835781`):
- Downloaded ZIP contained `rave-engine-Cargo.lock`, `rave-rust-setup.log`, `rave-rust-tests.log`.
- Independently checked artifact lockfile SHA-256:
  `d05b99530bcfbad6ff6e3f67f503622bb6f7b15f5a7350f8a5f6ebe3ffaa5e18`.
- The original job used `rustc 1.95.0` and compiled `rave_engine v0.15.0`,
  `hdk v0.7.1`, `hdi v0.8.1`, `rhai v1.27.0`, `zfuel v0.9.1`.
- Its recorded Rust result is **2 passed, 0 failed** for the *earlier* harness,
  not the expanded current eight tests.
- The RAVE branch now contains `tests/holochain/rave-engine/Cargo.lock`,
  fetched from `integration/s0/11-all-agent-snapshot` (155 packages).
  Its **different** content SHA-256 is
  `e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001`;
  Git blob SHA `32e5d0a922aceab1aff506c663431d1d620691e2`.
  It matches the RAVE branch Cargo.toml's direct pins and the crates.io published
  `rave_engine` checksum recorded in its lockfile. Do **not** misattribute the
  archived lock's SHA to this branch's slightly different lockfile.
- **Unexecuted gates:** `verify-crate.sh` network fetch and exact downloaded
  .crate archive SHA-256; `cargo +1.95.0 test --locked --manifest-path
  tests/holochain/rave-engine/Cargo.toml --all-targets` for all current tests.
  Compiling a pinned dependency is not a separate proof of registry-tarball integrity.

Registry expected checksum for `rave_engine-0.15.0.crate`:
`7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde`.
The lockfile lists this as the package checksum. The direct download and
`sha256sum --check` command must still succeed to close the independent archive gate.

## 2. Real Holochain / Unyt sandbox feasibility

**Actually executed here:** a byte-for-byte transcription of
`tests/holochain/sandbox/check-toolchain.sh` into a disposable runner file.
`bash -n` exited **0**. Running it exited **2**:
`BLOCKED_REAL_HOLOCHAIN_SANDBOX: missing holochain`.
The host also lacks `hc`, `cargo` and `rustc`; it has Node 22.16.0 and `sha256sum`.
Direct `github.com` and `static.crates.io` curl DNS requests fail with exit 6.
No actual conductor, cell, network, zome call or release binary was executed.

**Public candidate artifact discovered, but NOT validated or deployed:**
[Unyt Sandbox v0.114.0](https://github.com/unytco/unyt-sandbox/releases/tag/v0.114.0)
published 2026-10-20 includes `unyt.happ` with GitHub release metadata
SHA-256 `dedd563106b2742daf2c33d9a8af6be8e5fd9775433a9886c2fd33ad513e4f44`;
`alliance.dna` checksum
`dbeae51a31b629ef8f5a4ac68db6de6ff0dd231f2c7935fe307aba41f0ef2ecb`.
The release also publishes `SHA256SUMS` and `SHA256SUMS.minisig`.
**None of those bytes or signatures was independently downloaded/verified here.**
This is a **Sandbox release**, not evidence that its DNA equals any deployed
production Unyt network or proposed bridge agreement.

`unytco/unyt-sandbox`'s public `.gitmodules` points to
`git@github.com:unytco/unyt-app.git`; its current `main` gitlink is
`29ed3af2fe054b8bc5f493b3c5c26fe665ff4bac`.
The `unytco/unyt-app` repository returned GitHub **404** to this connection
(permissions or nonpublication unresolved). The current main gitlink must
**not** be asserted to be the release's exact source revision. Exact zome source,
integrity/coordinator WASM hashes, release build attestation and live deployed DNA
hash are not available for production-equivalence testing. A publicly downloadable
hApp without provenance can be useful for sandbox experimentation, never for
asserting the production validation contract.

**Toolchain:** Holochain's 0.7.1 upgrade reference pins
`holochain/hc 0.7.1` with `hdk =0.7.1` and `hdi =0.8.1`
([official upgrade guide](https://developer.holochain.org/resources/upgrade/upgrade-holochain-0.7/),
[0.7.1 release](https://github.com/holochain/holochain/releases/tag/holochain-0.7.1)).
0.7.0 and 0.7.1 have breaking capability-grant and direct-signal differences;
do not choose a generic latest conductor. `hc sandbox` tools alone do not
authenticate DNA equivalence.

**Minimum exit prerequisites:** obtain the exact intended Unyt source commit,
complete integrity and coordinator zome source/manifest, verified `.happ` and
WASM SHA-256s, installed/derived DNA hash including modifiers, provenance of
the deployed cell(s), pinned conductor/CLI, and scripts that actually install
and call the relevant zomes in at least two conductors. Review cap grants,
DHT validation and partition behavior; execute negative forks/recovery calls.
The readiness gate must keep exiting 2 until those tests genuinely pass.

## 3. Economic-standing claims: three evidence levels

| Concern | Published library / publicly readable source | Real Unyt zome / conductor | Hypothesis / required negative experiment |
| --- | --- | --- | --- |
| `ReserveUnits` conservation | Two-unit equal/opposite shape check compiled and passed in earlier real Rust harness; does **not** prove escrow solvency. | Not run | Test fees, reservations, multi-unit changes and external Solana refund across live agreement lifecycle. |
| `ParkedLinkStanding` | Public enum has `Parked(Transaction)`, `Unparked`, `NotAParkedLink`, `NotHeld`. | No authoritative standing zome call run | Forked chains, stale DHT links, withheld deletes, conflicting reads and multi-signer partition views. |
| Credit adjustment | Public smart-agreement code uses `find_run_citing(agreement, previous.id, commitment.id)`; appears agreement/history-contextual. | Deployed agreement revision not proven | Same commitment reused by replacement agreement or successor history, even if each run is locally valid. |
| Recovered commitment | Public recovery code remembers IDs in `previous_execution.output.carryover.recovered`; documented as once-per-agreement state. | No recovery zome called | Attempt recovery in two agreements, agents or successor DNAs; check fees and source-chain receipts. |
| Source-chain forks / conflicting DHT histories | Holochain 0.7.1 documents `ChainStatus::Forked` and `Closed`; local peer reads can differ. | No two-conductor divergent history test | Show inconsistent parked standing / double spending across partitions and source-chain restoration. |
| DNA migration | Public `unytco/migration-service` implements a notary-assisted close/open pipeline; its unit tests use mock conductors. | No source-to-successor real migration run | Close-chain proofs, binding of previous execution ID and recovered-set carryover; inspect effect of missing receipts and changed integrity WASM. |
| Lost receipts / crashes | Published RAVE entry types model commitment, receipt, accept, reject and reclaim. | No crash/restart zome execution | Crash after reserve, before confirmation, after RAVE result, after external payout; test replay and exactly-once processing. |
| Withdrawal during partition | Public HOT/EVM signer checks parked standing and agreement/nonce parameters; **not** a Solana bridge. | No Solana signer or real Unyt withdrawal call | Deny any external signature without durable unique final standing and independently verified nonrefundable custody. |

Source references: `holochain/research/ISSUE_9.md`,
`holochain/research/RAVE_015_EXECUTION.md`;
[public smart-agreement library](https://github.com/unytco/smart_agreement_library),
[migration service](https://github.com/unytco/migration-service),
[Holochain 0.7.1 chain restore notes](https://blog.holochain.org/dev-pulse-157-holochain-0-7-1-brings-chain-restore-direct-signal-security/).
Public source observations are **not proof that the same code is deployed**.

## 4. OBS #36 transaction evidence compatibility

Current OBS emits `solana-deposit-evidence-v1` with
`receiptSnapshot.kind = 'solana-receipt-observation-v1'`. Candidate-local
`transactionVerified: true` means *OBS claims to have checked signatures on
RPC-reported bytes*, **not** that RAVE verified consensus. The wrapper
`holochain/transaction-shadow.mjs` compares identity and immutable amount/bump
fields between envelope and snapshot, provenance/occurrence/instruction shape,
finalized/deposit slot relationships and explicit trust flags before it calls
`reviewShadow`. Malformed envelopes do **not** write to the test journal.
It deliberately permits only `quarantined` or `rejected` outcomes.

**Actually executed:** 28 synchronous JavaScript V8 assertions against source
fetched directly from the current RAVE branch (including linked reviewer and
adapter functions): 28 pass, 0 fail. This is not `node --test`. Eight new Node
test cases are committed in `tests/holochain/transaction-shadow.test.mjs` and
await full Node execution. Previously archived adapter tests do not count for
the new envelope logic. OBS #36's synthetic transaction tests and real Solana
SDK test gate are independently pending.

The adapter always emits
`creditEligible:false`, `spendableBaseUnits:"0"`,
`withdrawalAuthorized:false`, `transactionVerified:false`,
`deployedDnaVerified:false`, `conductorExecuted:false`.
Its ephemeral journals permit replay across different processes, agreements
or DNA epochs. Even perfect JSON field consistency cannot authorize credits.

## 5. Next required executable evidence (CI / SOL / OBS / SEC handoff)

```bash
# Runner with external access and pinned Rust toolchain:
bash tests/holochain/rave-engine/verify-crate.sh
cargo +1.95.0 test --locked --manifest-path tests/holochain/rave-engine/Cargo.toml --all-targets

# Runner with a complete branch checkout and Node 22:
node --test tests/holochain/*.test.mjs
node --check holochain/transaction-shadow.mjs
node --check holochain/shadow-cli.mjs
node --check holochain/test-only-adapter.mjs
bash tests/holochain/sandbox/check-toolchain.sh  # expected BLOCKED exit 2 here
```

Record exact stdout/stderr, versions, lock SHA and every test count. Independently
review the real Unyt hApp/zome and deployment provenance before attempting
conductor validation; leave the sandbox gate **blocked**, not green-by-exemption.
No economic interlock, signing, withdraw or credit issuance may be enabled.
