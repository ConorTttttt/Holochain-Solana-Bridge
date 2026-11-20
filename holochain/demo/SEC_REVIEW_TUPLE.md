# A4 → Agent 5: controlled audit-only Holochain write review tuple (PENDING, NO APPROVAL)

**14 Nov 2026. Security request, NOT a runtime allowlist activation.** PR #44 branch `agent/rave/10-controlled-audit-dna-ham-review`. Own-source only; PR #34 release/RAVE history untouched. A source-code review is not permission to write an entry.

## Proposed *static* target boundary (known from reviewed source)

- **App:** a new installed app on a disposable 0.7.1 conductor; must be named explicitly in `DEMO_APP_ID`, must not contain `unyt`/ `Unyt`, MUST NOT be the publisher's `unyt-v0117-audit`. **Actual installed ID: PENDING**.
- **DNA:** newly compiled from `holochain/demo/integrity/src/lib.rs`, `coordinator/src/lib.rs`, own `dna.yaml`, with a fresh unpredictable demo network seed and **verified disposable localnet** genesis/program/mint/scope. Do not reuse Unyt `alliance` bytes. **Actual DNA hash: PENDING BUILD**.
- **Cell:** exact `CellId = (DNA hash, agent pubkey)` for the single provisioned `audit` role. **Actual full CellId and agent: PENDING INSTALL**.
- **Role:** `audit`. **Integrity zome:** `solana_audit_integrity`. **Coordinator zome:** `solana_audit` only. **No published `transactor` function.**
- **Allowed ABI probes:** `get_contract(()) -> DemoContract`, `get_observation(source_id: String) -> Option<AuditRecord>`, `list_observations(()) -> Vec<AuditRecord>`. The adapter currently uses only `get_contract` and `get_observation`.
- **PROPOSED mutating call, NOT YET APPROVED:** `record_observation(item: AuditObservation) -> AuditRecord { actionHash: ActionHash, observation: AuditObservation, creditEligible:false, independentConsensusVerified:false, spendableBaseUnits:"0", withdrawalAuthorized:false }`. It creates an entry *only on the calling author's source chain*, or returns the existing action for identical same-author/source ID. Different value conflicts. This is NOT globally exactly once.
- **Write input:** *only* `kind: "solana-observation-demo-v1"`, `schemaVersion:"1"`, `source.sourceEventType:"deposit"`, `proof.evidenceKind:"solana-deposit-evidence-v1"`, **`proof.evidenceOrigin:"test_only_fixture"`**, `proof.historyComplete:false`, `proof.transactionVerified:true`, `proof.verifiedByRpcClaim:true`. Three layers of literal four economic denial fields are compulsory. Source IDs `genesis:program:receipt`; occurrence IDs `genesis:program:signature:outer:index`; positive decimal u64 string, lowercase 64-hex witnessDigest, scope and base58 key lengths enforced. These booleans and a digest ARE NOT Solana authentication.
- **Signer:** `LairCredentials::Node { conductor_config, passphrase_file }` to an independently configured **external** Lair keystore; the cell's own agent; `CapGrantOptIn::Withheld`. Never store passphrase in repo or logs; no fallback grant. `DEMO_EXPECTED_DNA_HASH`, `DEMO_EXPECTED_AGENT`, `DEMO_APP_ID` must match actual installed identity. Timeout 30 seconds; explicit refused error classes.
- **Input delivery switch:** `DEMO_ALLOW_TEST_ONLY_FIXTURE=1` required for a `deliver` command. There is **no** authenticated outbox command/capability. DNA, JS ABI and adapter refuse `observer_reviewed_outbox` even if caller forges that string.
- **Excluded functionality:** `create_cap_grant`, released Unyt `transactor`, `execute_rave`, `bridge`, credits, tokens, spend, refund/revocation, withdrawal, signer quorum, consensus or independent finalized-history attestation.

## Unfilled execution-bound identifiers (hard stop before *any* zome write)

| Required | Actual value / present evidence |
| --- | --- |
| Exact source commit SHA after final test/lock changes | **PENDING exact head recording** |
| Rust 1.95.0 / pinned Holonix 0.7.1 compiled success, both WASM SHA256 | **PENDING** |
| New packed DNA SHA256, Holochain DNA hash, hApp SHA256 | **PENDING** |
| Verified disposable Solana genesis, program, mint and scope | **PENDING source-backed CI handoff** |
| New installed app ID and full provisioned CellId (DNA + agent) | **PENDING** |
| External Lair path/agent choice, nonsecret config fingerprint | **PENDING** |
| Independent Agent 5 explicit approval of **this exact** call/tuple and signer | **NOT GRANTED** |
| Real signed ActionHash, byte-identical read/restart and negative logs | **NOT RUN; prohibit claiming** |

Agent 5: only after the values above are complete, review **the exact immutable source + binaries + identity + command**, reply with an explicit call-scoped decision, and require an independently attributable security reviewer. An agent requesting approval (including Agent 4) cannot approve itself. Until then, **no `record_observation` call**, even to the synthetic fixture DNA. Read-only static inspection alone does not unlock it.

## Required negative runtime matrix when permitted

Wrong app, DNA, `CellId`, agent or role; nonexistent Lair; unexpected `CapGrantOptIn`/grant; nonallowlisted function or wrong ABI; no fixture opt-in; unreviewed outbox; unknown/missing nested fields; bad genesis, program, mint, scope, receipt, signature, nonce/instruction index, u64; missing witness; refunded/revoked status; stale/conflicting same-source ID; timeout/reconnect/restart; redaction of secret/passphrase/socket token; no duplicate action on same-author retry. All must fail closed and leave no unreviewed action. Report both successes and failures, without Holochain economics.
