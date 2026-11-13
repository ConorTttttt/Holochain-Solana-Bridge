# Observer #13/#17 — P0 dependency-backed validation record (2026-11-13)

**Status: PARTIAL / NOT ACCEPTED.** Existing PR #36 remains draft; the new transaction-aware, finalized-indexer and durable-ledger suites have **not** had a complete real-`@solana/kit@8.6.0` execution at the current OBS source SHA. No issuance, no withdrawal authorization and no mainnet assets.

## 21:53 UTC continuation — genuine integrated CI failure triage and OBS-only fix

The frozen PR #37 integration snapshot [run 43510726021](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43510726021), Observer job 132179960441, executed the newer OBS suite with **real pinned @solana/kit 8.6.0**: **45 tests, 38 pass, 7 fail, 0 skip**. This is a real red result, not the earlier pre-indexer 20/20 green. All 7 failures came from signed transaction tests: six halted at `missing signed transaction signatures` (the code wrongly asserted that decoded Kit signatures were a native Map) and one returned `ReferenceError: signature is not defined` in a negative test.

Corrective commits on the **OBS branch only**:

- `3c460ef`: recognize Kit's **address-keyed SignaturesMap object**, tie the supplied transaction id to the first actual static signer, validate all header-required signer keys and perform Ed25519 checks by address. Do not rely on arbitrary object-property iteration order.
- `db1fa7c`: apply the same SDK-correct signature lookup in the historical block indexer; malformed unrelated transactions now invalidate a claimed containing block instead of being silently ignored during signature search.
- `e85b8eb`: replace remaining undefined-signature negative-test references, assert actual SDK-decoded object shape for legacy/v0, and add finalized `getTransaction`/containing-`getBlock` agreement, numeric v1 negotiation and incomplete-block rejection regressions.
- `0144159`, `6a32ccb`: compare v0 RPC loaded writable/read-only address counts exactly to the **signed** Address Lookup Table indexes; reject extra/missing loaded addresses, with an adversarial regression. Still cannot independently authenticate ALT contents from RPC claims.

**Retest status: PENDING.** No Actions run against these correction commits has passed yet; this host can inspect the CI logs and write OBS-owned Git blobs through the GitHub connector, but `git clone` and `npm ci` are blocked by outbound DNS. Do not treat the 38/45 red run as fixed until CI #32/#37 takes this updated exact OBS source SHA and archives `npm ci --ignore-scripts && npm run check && npm test` output (including signed positive legacy/v0/v1 and current real-localnet tests). Keep the PR draft and `creditEligible:false`.

### Other failures outside this lane

Same frozen integration: SOL validator job 132179958788 failed at its Node module import (`BPF_LOADER_UPGRADEABLE_PROGRAM_ID` CommonJS named export), after 7/7 layout tests passed; Agent 2 owns that fix and must regenerate finalized transaction/block witnesses. The published RAVE crate job 132179959342 had 7/8 pass (large integer model); Agent 4 owns it. No file on those branches was edited by OBS.

---

## Actual executed commands and outcomes

### Earlier integration CI (immutable, OBS **pre-transaction/indexer** version)

[GitHub Actions 43507244384](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43507244384), job 132167985612, integration head `39d5a40bad4e12d99bb2a8f595389c273d8f007f`:

```text
bash scripts/ci/record.sh observer-deps bash scripts/ci/install-node-deps.sh observer
USING_COMMITTED_LOCK: observer
PASS: approved observer dependency graph

bash scripts/ci/record.sh observer-tests npm --prefix observer test
> node --test
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 314.65431

bash scripts/ci/record.sh observer-check npm --prefix observer run check
# job conclusion: success
```

**Scope caution:** These green logs ran the older `idl-contract.test.mjs` and `verify.test.mjs` suites, **not** the new `transaction.test.mjs`, `indexer.test.mjs`, `ledger.test.mjs`. Latest integrated [run 43508478818](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43508478818) passed at checkout `ee37bd0`, but its source manifest still names OBS `56e3791` / old Observer test-tree. Do not project older success onto new code.

### Current isolated execution host (not a validator runner)

```text
node -v
v22.16.0

git clone --depth 1 --branch agent/obs/8-observer-validation https://github.com/ConorTttttt/Holochain-Solana-Bridge.git bridge
fatal: unable to access 'https://github.com/ConorTttttt/Holochain-Solana-Bridge.git/': Could not resolve host: github.com

npm view @solana/kit@8.6.0 version --fetch-retries=0 --fetch-timeout=5000
npm error code EAI_AGAIN
npm error syscall getaddrinfo
npm error request to https://registry.npmjs.org/@solana%2fkit failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org
```

Therefore **no** local `npm ci`, `npm test`, `node --test`, live validator, SDK decoding, signed transaction replay or recoverability integration run is claimed for new suites. A separate V8 JavaScript *syntax-only parse* passed for `ledger.mjs`, `ledger.test.mjs`, `transaction.test.mjs` at the revised source blobs; this is **not** a Node module loader or test execution.

## Real SOL artifact status

Actual SOL [run 43499386297, artifact 14073462857](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43499386297/artifacts/14073462857) supplies a compiled/generated IDL, localnet program binary, finalized `getMultipleAccounts` deposit/refund account bytes and real deposit/refund signature strings. Source and bytes have been inspected separately by OBS. **That bundle does not include finalized raw base64 `getTransaction` responses, SPL CPI metadata, or a containing `getBlock`.** It cannot verify transaction origin. These are required from SOL #35 and have been requested on its PR (no wallet secrets required).

The current `observer/test/transaction.test.mjs` exercises signed synthetic wire fixtures for legacy, v0 and v1, including fake Ed25519 and ambiguous delta cases; those fixtures do **not** constitute a successful live v1 validator test. The `observer/test/indexer.test.mjs` uses mocked RPC responses with empty blocks and negative cases; it does **not** establish genuine multi-deposit historical scanning. The `observer/test/ledger.test.mjs` covers source-level restart, lock and corruption cases but lacks a completed runtime test log at the revised head.

## Source corrections committed in this continuation

- `6fd4915`: v1 wire-format test now passes its real generated `tx.expectedSignature`, not an undefined `signature` binding.
- `f9669ba`: on ledger reopen, validate persisted receipt evidence digest, instruction-uniqueness, non-economic trust flags, checkpoint-bound block identities, and compatible object shapes before trusting the persisted cursor.
- `0acd42b`: adversarial recovery tests mutate persisted evidence, recompute a checksum for an unauthorized `creditEligible:true` claim, forge block map entries, and change occurrence identities; require failed construction and writer-lock cleanup.
- `60137ae`: correct lockfile status in transaction evidence contract and state limits of local checksum validation.

**Threat caveat:** An in-file digest is useful for accidental or partial corruption detection but cannot prevent a malicious file edit that recomputes hashes, or rollback to an older internally consistent ledger. Authenticated independent checkpoint anchoring is still missing.

## Acceptance gates, specific owners and safety interlocks

- **CI #37:** refresh pinned integration snapshot to latest OBS head; execute `cd observer && npm ci --ignore-scripts && npm run check && npm test`; preserve full counts/logs including new test files, zero skipped required cases; `npm run verify:idl -- ../target/idl/deposit_prototype.json <genuine generated localnet program ID>`.
- **SOL #35:** publish finalized real base64 `getTransaction` + `getBlock` matching real deposit, refund, rejected transactions and correct RPC metadata, plus block and network identities; never publish keypairs.
- **SEC #33:** independently audit CPI linkage, v0 ALT, v1 message-first decoding, provider consensus limitations, checkpoint tampering and refund tracking.
- **RAVE #34:** accept `solana-deposit-evidence-v1` only in non-economic quarantine; preserve independent receipt identity (`genesis:program:receipt`), instruction occurrence (`genesis:program:signature:outer:index`), transaction signature and `transactionHash` separately.

`independentConsensusVerified:false` and `creditEligible:false` remain mandatory; local Ed25519 signature checking against RPC bytes cannot prove independent Solana consensus, irrevocable custody or economic authorization.
