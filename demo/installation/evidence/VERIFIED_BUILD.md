# Verified original build and exact prepared installation request

Baseline source: `03b567a992bcd31930b49d08f594a4ef7ff58680` (PR #66).
Independent read-only verification: [run 43653123179](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43653123179), source `8ecbee6818b6b1aba355bf8bcbbefd3fd68666f8`.
Original build run: 43648980986; shared run: 43648981038. Both exact-head SUCCESS, attempt 1; original installation steps SKIPPED.

| Original artifact | Actual SHA256 | Bytes |
| --- | --- | ---: |
| holochain/demo/ham-adapter/target/release/solana-audit-ham-adapter | `e3e40f1c3d50959082569206a0f5cd6e1f72a3c20751ec9a26dbe13aba60b5b9` | 12972424 |
| holochain/demo/target/wasm32-unknown-unknown/release/solana_audit_integrity.wasm | `1e5bbdf9eeec4edfea66748e65bd539b5d69a17c3122c0ec361c8e212f46b4ca` | 2110819 |
| holochain/demo/target/wasm32-unknown-unknown/release/solana_audit.wasm | `552d0392d33004e18e8f0533866a470c7e03afce4eabac4c19717a48e6f7a7ba` | 3761973 |
| holochain/demo/holochain_solana_audit_demo.dna | `a9bc44fb3477ea4d056f420c821a34cb88a8b0517297da1b4570d02f75fec627` | 1179551 |
| holochain/demo/holochain_solana_audit_demo.happ | `a68826c9f5e6bc007c5e22cb34e4a856265ec07be78b624a26efd433e9d98050` | 1174345 |
| holochain/demo/Cargo.lock | `c5774a18ba821005d80e51c7bf1663062817ce06e585a2bc2245e09da3b4d6c6` | 30553 |
| holochain/demo/ham-adapter/Cargo.lock | `08347c32d9f0fd5c479c8a28c1c1766c8497abbb45d0219c4b4fa96e2c3cc399` | 102990 |

Actual DNA hash, recomputed with pinned hc: `uhC0kCn-ld2PREMKI6nDVq4XssTKHgs8QHOszCC3a32pXCZjowgXt`.
Original compiler log SHA256: `eab07e9d78b14e12529725acbf33f833d2933b15ab96e225d8dfef73406a7f96`.

Original ZIP IDs/digests: [baseline.json](../baseline.json). Full source binding and runtime tools: the JSON files beside this document.

## Prepared request

[installation-request.prepared.json](installation-request.prepared.json) is the exact canonical request emitted by that verifier. Its immutable executor source is `8ecbee6818b6b1aba355bf8bcbbefd3fd68666f8`; later evidence-only commits do not change that identity. It binds original bundles, exact Node/hc/Holochain/Lair and executor code hashes, app/paths/argv and prohibited operations.

The target host fingerprint is deliberately null. Freeze it on the designated disposable host using the runbook before independent signature and administrative allowlisting. Changing any field requires a new request digest and approval. This document and prepared JSON grant no authority.

No trust root, independent key, durable broker, installation approval or real runtime identity exists for this request. The next permitted action is independent review and read-only host freeze/provisioning; hc generation remains prohibited until authenticated authorization is supplied.

Real proposed hc argv (execution is NOT authorized):

```text
/nix/store/5sw0c4hxnf472k6m13l5s37sdfxpypf4-hc-0.7.1/bin/hc sandbox --piped generate --app-id hsc-audit-demo-readonly --root /var/lib/hsc-audit-installation/attempts/6b81899a097bdf55bc52ca060518537a --directories agent-a /var/lib/hsc-audit-installation/inputs/03b567a992bcd31930b49d08f594a4ef7ff58680/holochain_solana_audit_demo.happ network mem
```

AgentPubKey, full ordered CellId, admin port, Lair socket/server association and private config are allocated only during authorized generation. Authenticate them using the runbook; no later signed zome call is authorized by installation approval.
