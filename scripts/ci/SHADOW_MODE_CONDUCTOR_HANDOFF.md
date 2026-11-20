# CI-only real-conductor shadow-mode handoff — 13 November 2026

**Status: BLOCKED; no real Holochain conductor PASS asserted.** These are readiness criteria, not an executed zome test. Node.js shadow adapters, the published `rave_engine=0.15.0` host Rust harness and a released Unyt Sandbox hApp are different trust boundaries.

## Required source and version proofs

1. Read `.github/skills/holochain/SKILL.md`, `references/architecture.md`, `references/patterns.md` and `references/testing.md`. Skill examples assume HDK 0.7.1/HDI 0.8.1. **Before** any zome code, confirm the actual deployed Unyt lockfile/HDK versions; the bridge's root Rust workspace is Anchor, while the RAVE test crate is native host-only, not a compiled Holochain DNA.
2. Obtain the exact source commit for the deployed Unyt integrity/coordinator WASM, the reviewed hApp and DNA bytes, SHA256 and installed DNA hash. The public `unytco/unyt-sandbox v0.117.0` assets must be checked via `tests/holochain/sandbox/verify-unyt-release.sh` (SHA256 and minisign). Release integrity alone does not establish deployed-DNA equivalence.
3. Supply a version-compatible local `holochain` binary, `hc`, `cargo` and `rustc`, ideally through a pinned Holonix environment. Run `UNYT_HAPP_PATH=<verified> UNYT_HAPP_SHA256=<reviewed> UNYT_DNA_HASH=<actual> UNYT_SOURCE_COMMIT=<actual> bash tests/holochain/sandbox/check-toolchain.sh`. This script **intentionally exits 2** even with tools present, until a separately reviewed real conductor zome-call harness exists. Do not convert this exit 2 into a green CI result.

## First genuine non-economic shadow-mode test (not executed)

Start two disposable version-matched conductors using `SweetConductorBatch` or `hc sandbox`, install the *exact* verified Unyt DNA and compare both installed hashes and zome WASM. Exchange peer info and call `await_consistency` before cross-agent reads. From a disposable local Solana validator, execute positive and rejected signed deposits, verify compiler IDL and ELF hashes, and collect signed wire transactions, containing blocks and finalized account bytes. Run the verified OBS decoding/indexing and submit `solana-deposit-evidence-v1` to a reviewed *audit-only* coordinator zome call. Prove actual integrity validation and durable conductor state, wrong signatures, wrong receipts, duplicates, changed transaction occurrences, refund, persisted restart and partition/rejoin. Assertions must be against actual zome call results and state, not only JavaScript adapters.

**Blockers:** The exact `unytco/unyt-app` source gitlink could not be accessed (404 in source investigation); actual installed DNA, WASM/source equivalence, compatible conductor and reviewed API/harness are missing. The SOL fixture capture uses JSON encoding with RPC-reported signatures but **no complete signed wire bytes** to independently verify Ed25519 on the new genuine localnet witnesses. Require a separately reviewed source-owned `getTransaction encoding:base64` capture and OBS replay test to close this gap.

All results remain quarantined: `creditEligible:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. No production mint/withdrawal/mainnet or local economic credit.
