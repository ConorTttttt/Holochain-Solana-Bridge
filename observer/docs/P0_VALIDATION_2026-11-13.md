# Observer #13/#17 — P0 dependency-backed validation record (2026-11-13)

## Latest P0 continuation — failing Ed25519 checkpoint regression (13 November 2026)

**CI failure verified:** integrated workflow [43520698081](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43520698081), Observer job **132213906857**, ran **48 tests: 47 pass, 1 fail, 0 skipped** with the real pinned Kit dependency. Test `failed transactions require valid Ed25519 signatures before checkpoint advancement` raised `invalid/incomplete ordered slot listing` at the **restart** call (test line 156), *after* the expected forged-signature rejection and persisted slot-20 assertions. It is inaccurate to say this CI trace bypassed cryptography.

**Root cause: fixture, not indexer.** The `rpcMock({bothProduced:true})` implementation returned `[20,21]` for **every** `getBlocks` invocation. A resumed scan requests the inclusive range `[21,21]`; slot 20 is out of range and correctly causes the indexer to fail closed. Commit `5411c3d` makes the fixture return only produced slots inside its requested inclusive bounds and leaves the strict indexer check unchanged.

**Additional observer-only tests:** `8038360` exercises a genuine Node-crypto Ed25519 two-signer signed legacy wire for a failed transaction, forged second signer, zero-filled unsigned second signer, changed message with two signers, and an explicitly malicious out-of-range listing on restart. Each negative requires no checkpoint advancement past slot 20 and lock cleanup. `9441e89` asserts that the immutable receipt-attached downstream `solana-deposit-evidence-v1` record retains `transactionVerified:true`, `independentConsensusVerified:false`, `creditEligible:false`, receipt/occurrence identity and snapshot linkage; malformed or credit-eligible observations are refused. Existing tests still cover v0 ALT completeness, v1 wire decoding, contradictory getTransaction/getBlock metadata, unrelated forged transactions, skipped slots, provider disagreement, restart/replay, corrupt persisted ledger and crash recovery.

**Retest evidence:** V8 parse of `observer/test/indexer.test.mjs` after removing ESM imports passed. This is syntax-only; **no real-SDK `npm ci && npm run check && npm test` execution has yet run on `9441e89`**. The previous CI 47/48 is a frozen predecessor, NOT a passing result for these changes. CI must run the exact latest Observer head (and snapshot it to integration without OBS editing CI files).

**SOL provenance gate still open:** the newer integration [43520697998](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43520697998) published `integration-localnet-evidence-NO-KEYS` artifact `14083231222`. Inspection finds real account-snapshot JSON, IDL and SBPF build outputs, including `two-active-receipts.json` and `two-refunded-receipts.json`; the archive **does not contain full signed base64 `getTransaction` plus containing `getBlock` JSON files**. Its recorded snapshot `signatures` field is empty, so it cannot establish transaction provenance or be used as a forged wire fixture. SOL branch #35 now contains raw-RPC capture code, but its exact latest head must execute successfully in local-validator CI and publish the captured public-only `*.rpc.json` files. Also pin the generated program ID, compiled IDL SHA-256 and artifact source SHA to the exact run; the newer ephemeral validator program ID differs from earlier evidence. Until then no on-chain deposit attribution, historical validator-block replay or end-to-end evidence issuance may be claimed.

**Status: DRAFT / NOT RELEASE-READY.** No wallet keys or secrets captured. The ledger is locally crash-consistent but its self-checksums are not authenticated consensus. No Solana withdrawal signing, Holochain value issuance, or credit-eligibility escalation. Agent 4 consumes this schema for shadow-mode review only.

---

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

## 22:27 UTC continuation — all-block Ed25519 gating / crash-safe replay regressions

**New OBS-owned commits:** `8743c942` (indexer), `755137c5` (indexer regression fixtures), `4e7e6700` (abrupt-exit ledger regression).

During a source review of the P0 failure repair, a distinct fail-open path was found: `signatureOf()` in `indexer.mjs` only checked the *shape* of signed bytes. `indexFinalizedRange()` then skipped `meta.err !== null` transactions, allowing a forged signed message inside an RPC-reported **failed** transaction to advance the finalized checkpoint without local Ed25519 verification. The standalone `fetchFinalizedTransaction()` similarly checked a containing block's unrelated transactions structurally only.

`signatureOf()` is now async; it checks the RPC-declared wire version and calls the existing `verifyWireSignatures()` for **every required signer in every block entry**, regardless of execution status or whether an entry invokes the bridge. Both the containing-block cross-check and the historical scanner await this check before any progress. **Do not remove or soften these checks for skipped/failed transactions.**

New tests use actual Node Ed25519-signed Solana legacy wire messages and then flip a signed blockhash byte after signing. They assert (a) an invalid signature in finalized slot 21 fails before moving the persisted checkpoint beyond verified slot 20; (b) an operator can resume after replacing the untrusted provider response with correct signed bytes; (c) a matching `getTransaction` is rejected if its reported block includes a separately forged failed transaction. A subprocess test exits immediately after fsynced ledger commit without releasing the lock; lock reclamation requires explicit operator intervention after confirming termination; restart verifies the cursor and evidence replay are preserved.

**Execution level:** the changed JS sources/tests have **V8 syntax parses only**. No actual installed `@solana/kit@8.6.0` unit run, validator execution, signed localnet block fixture or new GitHub Actions result is available at this OBS head; this host's npm/GitHub outbound DNS remains unavailable. The newly added Ed25519-generated fixtures are **synthetic**, not evidence of real local-validator inclusion. PR #36 remains draft, P0 acceptance OPEN. The old 38/45 failure is an older frozen integration snapshot, and the seven corrective tests are still awaiting a current-head re-run.

**Required CI invocation:** from an integrated checkout containing this exact OBS head, run `cd observer && npm ci --ignore-scripts && npm run check && npm test` and retain the 0-skipped full test output. SOL #35 must additionally publish finalized **base64 wire `getTransaction` and full containing `getBlock` JSON** so OBS can replay the *genuine* on-chain deposit amount, CPI, receipt, vault, Holochain destination and block membership. Finality remains an RPC assertion, not independent consensus proof. RAVE must quarantine `solana-deposit-evidence-v1` and retain `creditEligible:false` / `independentConsensusVerified:false` as mandatory invariants.
