# Controlled Holochain audit-only demo — review build, NOT an accepted runtime proof

This entirely independent DNA is NOT the signed Unyt v0.117.0 release. Neither this zome nor HAM attests to independent Solana consensus. Never use with value-bearing assets. No credit, spend, grant, recovery, withdraw, RAVE or Unyt coordinator call exists.

**Immutable research dependency:** unytco/ham fbb4b6eb8a79a507e9453b709ed00f15c5618fb4, holochain_client =0.9.1, Holochain 0.7.1, hdk =0.7.1, hdi =0.8.1. Research is not implementation approval.

## What the source does

The integrity zome checks an ABI version, real DNA-scope properties (genesis/program/mint/scope), source and occurrence IDs, canonical positive u64 decimals, event type (deposit only), witness format, strict nested denial fields, and append-only entry shape. The coordinator stores audit entries on the caller's own chain and reads back by source ID; identical same-agent replays return the previous action, conflicting content is refused. This does **not** implement globally unique exactly-once across multiple authors or hostile rollback. Source observations are claims supplied by the Observer; the DNA does not cryptographically prove Solana transactions.

The adapter uses **only** its own role audit / zome solana_audit with the fixed function allowlist get_contract, record_observation and get_observation. It checks installed app/cell, agent, expected DNA hash, own ABI and external Lair. Capability grants are withheld. It intentionally accepts only fixtures explicitly labeled test_only_fixture and requires DEMO_ALLOW_TEST_ONLY_FIXTURE=1 pending an Agent 3-reviewed authenticated outbox interface. Never present fixture delivery as a genuine deposit.

## Local reproducibility / CURRENTLY UNEXECUTED for the Rust/conductor layers

Use the exact pinned Holonix commit a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da with Holochain 0.7.1. On a disposable validator, FIRST replace dna.yaml's test-only genesis/program/mint/scope with the matching *verified* Observer domain, then replace the placeholder network_seed with a new unpredictable disposable seed. Compute the DNA hash from the packed artifact, and pin it in both app deployment and the caller's DEMO_EXPECTED_DNA_HASH.

```sh
node --test tests/holochain/demo/demo-abi.test.mjs
nix develop 'github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da' --command bash holochain/demo/build.sh
cargo +1.95.0 run --manifest-path holochain/demo/ham-adapter/Cargo.toml -- preflight
# After authorized disposable install and external Lair config:
DEMO_ALLOW_TEST_ONLY_FIXTURE=1 cargo +1.95.0 run --manifest-path holochain/demo/ham-adapter/Cargo.toml -- deliver /path/to/explicitly-test-only-observation.json
cargo +1.95.0 run --manifest-path holochain/demo/ham-adapter/Cargo.toml -- read '<source-id>'
# Shut down and restart SAME conductor, repeat read and compare stored ActionHash.
```

Mandatory adapter environment: DEMO_ADMIN_PORT, DEMO_APP_PORT, DEMO_APP_ID (not containing unyt), DEMO_CONDUCTOR_CONFIG, DEMO_LAIR_PASSPHRASE_FILE, DEMO_EXPECTED_DNA_HASH, DEMO_EXPECTED_AGENT, SOLANA_GENESIS, SOLANA_PROGRAM, SOLANA_MINT, SOLANA_SCOPE. Use an **external** Lair server; prior in-process-Lair sandbox proof does not establish an external-Lair signed zome call.

**Acceptance blockers:** Rust source has not compiled in this environment (no cargo/hc/Nix); no install or signed action hash; no post-restart evidence; no authentic OBS outbox adapter; no new RAVE 5/5 test at this branch. Do not claim otherwise.

Agent 1 handoff: run the commands above in a disposable Holochain 0.7.1 environment, capture exact source SHA, HAM git pin, WASM/DNA/hApp digests, public agent ID, ActionHash, identical readback/restart, negative error classes and sanitized logs. Do not modify or call published Unyt. Agent 3 handoff: negotiate the versioned envelope against its actual original archive/outbox, include source transaction hash in witnessDigest and per-record denial fields; source archive verification must happen upstream. Agent 5: review validator completeness, the trusted outbox auth plan, app identity preflight, Lair handling and local-author retry scope. Gate C remains NO-GO.

**Published Unyt B2 remains blocked:** exact unytco/unyt-app d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf source equivalence and zome authorization are unproven. No whoami/get_status/get_parked_link_standing or economic functions have been called.
