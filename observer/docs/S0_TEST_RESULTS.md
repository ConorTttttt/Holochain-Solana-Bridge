# OBS #8 local execution record — 2026-11-13

Environment: Node `v22.16.0`; npm `10.9.2`. These are actual commands from this task's local isolated workspace. No Solana/Anchor validator was run.

```text
$ npm run check
> node --check src/cli.mjs && node --check src/verify.mjs &&
  node --check src/decode.mjs && node --check src/pda.mjs
exit 0

$ npm install --offline --ignore-scripts --no-audit --no-fund --package-lock=false
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/@solana%2fkit failed:
npm error cache mode is 'only-if-cached' but no cached response is available.
exit 1

$ npm test
# tests 15
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 227.587395
exit 0
```

**Critical qualification:** That `npm test` execution was performed with a **temporary test-only implementation of `@solana/kit`'s `getProgramDerivedAddress` API**, using SHA-256 and a local Ed25519 decompression test to exercise control flow. The shim is **not committed** to the repository. These tests exercised observer parsing, checks and rejection paths, but they **do not validate that the pinned maintained Solana SDK has identical runtime behavior**. No real `npm install`, SDK integration test, local validator, IDL cross-check, or deposit transaction replay has passed.

## Release/test gate still required

1. On a network-enabled CI runner, run `cd observer && npm install && npm run check && npm test` against `@solana/kit@8.6.0`. Generate and commit a dependency lockfile with verified integrity before claiming reproducible dependency installation.
2. Compare test fixtures and field offsets against the **generated Anchor IDL**, compiled SOL #7 outputs, and real localnet deposit/refund accounts. Correct parser/PDA recipes if any bytes or program IDs differ.
3. Independent SEC review and transaction-indexer follow-up are prerequisites to any stronger trust assertion. All output retains `creditEligible: false`.
