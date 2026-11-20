# A1 P0 canonical CI integration — evidence register (14 November 2026)

## Continuation decision

Canonical continuation is **PR #61**, branch `integration/demo/2026-11-14-a1-source-domain-obsv2`, starting HEAD `fc0cc94e17e7dbb4c6f3c8c9d6086fe3ae23e249`. Do **not** create a third architecture, merge into main, alter source-owner branches, or claim successes from other SHAs. PR #60 is retained as an immutable comparator; no branch deletion or evidence rewriting.

PR #61 keeps the SAME-WORKFLOW dependency graph `solana-lifecycle → cross-lane-js → own-dna-same-run-build-readonly` and requires a real successful source/Observer run **before** attempting a Holochain build. PR #60 supplied the stronger executed proof that the signed-source replay **can** succeed; its post-generated-source provenance failure is fixed in this continuation without relaxing the immutable Git checks. The A4 source template properties from the archived #55 example remain separate from this execution's derived DNA.

## Original, independently inspectable failed jobs and retained artifacts

| Candidate | Exact source HEAD | Original failing job | Failure | Original same-run artifact |
|---|---|---|---|---|
| PR #61 | `fc0cc94e17e7dbb4c6f3c8c9d6086fe3ae23e249` | `132589205296`, run `43640196929` | `OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN` | OBS/crosslane `14132232214`, SHA-256 `d57b4955f5b84707998e48f7c836845f810e0332305ae981e99a487b1b2d8c56`; validator `14132311001`, SHA-256 `5b161273230662947a6a5b4a69114a004ed896d0f8a84a4b0383d78e66470bbb` |
| PR #60 | `b869da9ab07dd7c4aefec67c671aaf683bdccef1` | `132589804322`, run `43640351458` | `SOL upstream owned blob mismatch: Anchor.toml` **after** successful original signed replay | OBS/crosslane `14131783723`, SHA-256 `80733a54a0e69f7dca194d42f8b0b8bec8a50f290920f513a0af0031313fa420`; validator `14131743763`, SHA-256 `b78c8994e2f61a29b9ce3ec948ca8cb778c86d5d8c2f0ca6092876538eef9be4` |

Original PR #60 exception: expected original `Anchor.toml` Git blob `6a890f430895d2b616d8a0513a4b32ec303843e6`; observed post-sync disposable working-tree blob `1cac0f99600cfa6881308afc225f8f06a66aa10c`. The prior source patch verifier successfully reconstructed the producer patch with both pre- and post-patch tree SHA-256 manifests, not an unrelated source modification. This commit now separately compares (1) immutable `HEAD:path` Git objects against `ci-integration-snapshot.json` owner blob SHAs and (2) the exact original source-owned public patch, path allowlist, full post-sync tracked-tree SHA-256 manifest, generated deployment input manifest, and original archive. Extra tracked modifications fail. An arbitrary local checksum is not source authentication.

## Observer replay (no production guard change)

OBS #57 is pinned at `38847cf1399c59fd1a1665c8bef2249479d7da03`; its `observer/src/demo-outbox.mjs` guard is unchanged. CI launches `scripts/ci/a0-demo-domain-kit-v2.mjs` via `node --test`, and the A1 preauthorization runner repeats it via a separate `node --test` child. The OBS-owned replay itself narrowly sets `OBS_ALLOW_ARCHIVED_RPC_REPLAY=1` only around the archived RPC queueing exercise. No arbitrary fetch override is enabled for production. Signed original wire, Kit verification, IDL/PDA/SPL/receipt, durable reopened `pending` outbox, no ACK and transport refusal are still required.

## Source domain and seven stages

Source-owner provenance: SOL #55 `c071e4c98e7b2dd04a18374f3792c0a90ce4b284`; OBS #57 `38847cf1399c59fd1a1665c8bef2249479d7da03`; approved source snapshot for A4 `990bd4e4d67d0f5f4ab8851ee1397be3ca62f20a`; SEC fixture #53 `da98cc24f6bda74c4282175c8e2d7cc0d7494f35`. Source-specific object SHAs remain in `ci-integration-snapshot.json`.

Source-derived DNA seed now includes exact signed initialized scope, genesis, program, mint, **original producer SHA**, original source-domain manifest SHA-256, and original full archive manifest SHA-256. Both digests are recomputed from the original same-run source bytes; these are public provenance inputs, not authorizations. Original archived #55 DNA YAML is preserved unchanged in the Git tree. The CI runner may stage an execution-bound YAML **only** in its disposable checkout.

Seven-stage report: stages 1–2 require actual original same-SHA Solana and OBS signed replay artifacts, stage 3 requires real compiled and installed DNA with actual ordered CellId and read-only identity evidence; stage 4 requires separate independently authenticated **exact** source/binaries/cell/signer/function/payload approval; stages 5–7 need genuine executed signed action, typed readback and restart evidence. None can be inferred from green static tests.

## Source-owned native lock blocker (not bypassed)

At inspected A4 PR #44 live HEAD `01241af206288e7d8f2b69008eff2fbf3abcc7c9`, `holochain/demo/ham-adapter/Cargo.lock` returns 404. The root Holochain WASM lock is present. A1 does **not** adopt the unreviewed native Cargo lock artifact, invent a binary, generate an installed CellId, or grant/call any zome. The exact-head post-commit Holochain build and installation statuses must be read from the **new** GitHub Actions jobs; without A4 reviewed native bytes they are expected to fail closed. External Lair identity and independent SEC exact-call approval are not supplied.

```json
{"creditEligible":false,"independentConsensusVerified":false,"spendableBaseUnits":"0","withdrawalAuthorized":false}
```

**Absolute holds:** no production custody, credits, withdrawals, settlement, published Unyt mutation, unauthorized Holochain signed write, fabricated ACK/ActionHash, or main-branch merge.
