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

## Continuation: real dependency and generated-IDL check (2026-11-13)

Environment: Node v22.16.0, npm 10.9.2. Local test-only substitute SDK removed from `node_modules` before the following attempt.

```text
$ npm view @solana/kit@8.6.0 version --fetch-retries=0 --fetch-timeout=10000
npm error code EAI_AGAIN
npm error syscall getaddrinfo
npm error request to https://registry.npmjs.org/@solana%2fkit failed
exit 1

$ cd observer && npm --fetch-retries=0 --fetch-timeout=6000 install --ignore-scripts --no-audit --no-fund --package-lock-only
npm error code EAI_AGAIN
npm error request to https://registry.npmjs.org/@solana%2fkit failed:
getaddrinfo EAI_AGAIN registry.npmjs.org
exit 1

$ npm test   # NO SDK substitute present
# tests 6; pass 5; fail 1; skipped 0
# Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@solana/kit'
exit 1

$ node --test test/idl-contract.test.mjs
# tests 5; pass 5; fail 0; skipped 0
exit 0

$ node --check scripts/verify-idl.mjs
exit 0

$ node scripts/verify-idl.mjs /mnt/data/NO_ANCHOR_IDL.json Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS
FAIL CLOSED: ENOENT: no such file or directory, open '/mnt/data/NO_ANCHOR_IDL.json'
exit 1

$ curl --max-time 2 -sS http://127.0.0.1:8899 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
curl: (7) Failed to connect to 127.0.0.1 port 8899
```

The generated account discriminator calculations against **current Rust source naming** were checked with Node SHA-256:
- `BridgeConfig` → `28ce33e9f628b255`
- `DepositReceipt` → `40af18b78a6d464e`

They agree with SOL's **source-derived** `tests/solana/OBSERVER_HANDOFF.md`; this is **not** a comparison with a generated Anchor IDL or live validator account.

The upstream package registry lists `@solana/kit` version 8.6.0 and the official Kit API documents `getProgramDerivedAddress({programAddress,seeds})` as a Promise of `[Address,bump]` supporting string and bytes seeds. **Documentation review is not a runtime installation/test.** The package-lock file could not be generated because registry network access failed. Do not substitute a fabricated lockfile or promote this draft PR.

### Integration gates for the Solana and CI lanes

1. Install on a network-enabled runner: `cd observer && npm install --ignore-scripts` against exact `@solana/kit@8.6.0`; review and commit the full integrity-checked `package-lock.json` on OBS branch. Follow with `npm ci --ignore-scripts && npm ls @solana/kit && npm run check && npm test`. No shims.
2. SOL #7 must publish generated `target/idl/deposit_prototype.json` plus public deployed program address and real localnet receipt/config/vault/mint bytes. Invoke `npm run verify:idl -- ../target/idl/deposit_prototype.json <public-localnet-program-id>` and compare the output to the **same** deployed program, its account bumps and finalized RPC results. Synthetic IDL tests cannot close this gate.
3. SEC #10 test fixtures must use async `await verifySnapshot(...)`, canonical PDAs, and four accounts; the obsolete positive test for substituted receipt addresses must become an explicit negative test.
4. Report transaction-origin verification and economic eligibility as **false** even after a green local validator snapshot suite: refunds remain possible and RPC snapshots are non-authoritative.

## OBS continuation — 2026-11-13 (new transaction/indexer revision; NO runtime acceptance claim)

The historic S0 command log above predates `src/transaction.mjs`, `src/indexer.mjs`, `src/ledger.mjs` and their new tests. They are present on PR #36 but **no `node --test` or `npm ci` of this updated branch has been observed**.

Actual local command attempt (Node 22.16.0, npm 10.9.2):

```text
$ npm view @solana/kit@8.6.0 version --fetch-retries=0 --fetch-timeout=5000
npm error code EAI_AGAIN
npm error syscall getaddrinfo
npm error request to https://registry.npmjs.org/@solana%2fkit failed
exit 1
```

GitHub connector's V8 JavaScript parser successfully parsed all six new `src/{transaction,indexer,ledger}.mjs` and `test/{transaction,indexer,ledger}.test.mjs` scripts **after removing ESM imports and exports for parser-only analysis**. This is a narrow syntax check, **not** executing Node tests, resolving real SDK imports or executing application code.

Downloaded genuine Anchor/SBPF artifact 14073462857 from passing SOL run 43499386297, then ran local Python JSON/SHA256/byte-offset comparison (NOT a full Anchor recompile). Observed:
- `idl/deposit_prototype.json`: 13,002 bytes, SHA256 `a81ccda8b91e90d1522cc922bac88aecae71e872d4b22ead9196ccceaf9d41f9`.
- `deploy/deposit_prototype.so`: 221,624 bytes, SHA256 `ddbc9a56d1d7d2d0edc55153f099ed016dc6a26b30057b7bd8703c8ac7dd9dd5`.
- IDL deployed-localnet program ID `FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG`, deposit discriminator `f223c68952e1f2b6`, correct account Borsh offsets/field types/sizes 114/218 and PDA seeds. Two actual account snapshots (slots 33/67) were decoded; active/refunded amount 250000, vault 250000→0, config.total_active 250000→0, nonce 42017, PDA bumps 255/254/248, classic SPL vault.
- **No raw finalized signed transaction** exists in that artifact. Transaction inclusion/CPI verification remains UNTESTED against genuine localnet tx bytes; SOL agent was asked to capture raw `getTransaction/getBlock` to close the gate.

`observer/package-lock.json` was then committed **unchanged** from Agent 1's successful integrated CI PR #37. Verified lockfileVersion 3; root dependency `@solana/kit: 8.6.0`; 48 package entries; exact Git blob `ad4997c2c59aa9129138f8838c79f83752fe5e08`. This proves source provenance of the resolved lock but **not `npm ci` execution on the newly modified OBS branch**.

Next required running commands from a network-enabled integration checkout:

```sh
cd observer
npm ci --ignore-scripts
npm run check
npm test
npm run verify:idl -- ../target/idl/deposit_prototype.json <TRUSTED_EPHEMERAL_LOCALNET_PROGRAM_ID>
```

Use the actual SOL artifact/validator-generated IDL and new raw transaction/block fixtures. Do not claim positive signed-verifier results until the full new suite passes. Always keep `creditEligible:false` and PR draft.
