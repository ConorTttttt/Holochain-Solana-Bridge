# Agent 4 exact demo-build status — 14 November 2026

**Source:** PR #44, `agent/rave/10-controlled-audit-dna-ham-review`. Not Unyt release. No new GitHub Actions run has been observed for PR #44, and no Holochain zome write is authorized. The branch may advance after this report; reference the final exact SHA before executing.

## Executed, real local checks

Local shell: Linux x86_64; Node `v22.16.0`; GNU Bash `5.2.37`; no Cargo/Rust, Nix/Holonix, `hc`, conductor, or external Lair available. Local copy of A4 JS ABI and regression file checked by Git blob SHA against committed GitHub blobs.

```text
$ node --test tests/holochain/demo/demo-abi.test.mjs
# tests 36
# pass 36
# fail 0
# cancelled 0
# skipped 0
# todo 0

$ nix develop 'github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da' --command bash holochain/demo/build.sh
bash: line 1: nix: command not found

$ cargo +1.95.0 build --locked --manifest-path holochain/demo/ham-adapter/Cargo.toml
bash: line 1: cargo: command not found
```

These two missing-executable failures are the **first actual blocking errors** in this execution environment. Do not claim a compilation failure or success from source code that was never compiled. The test results are synthetic *schema* acceptance/rejection, not validator-backed or Holochain runtime tests.

## Preflight fixes staged on A4 branch, not compiled

- Isolated Holochain WASM workspace `integrity`+`coordinator` from native `ham-adapter`; native manifest now has explicit package/dependency metadata and its own future `Cargo.lock`.
- `build.sh` requires a reviewed `holochain/demo/Cargo.lock` and uses `cargo +1.95.0 build --locked` before `hc dna pack` and `hc app pack`; no implicit dependency changes.
- The checked-in `dna.yaml` contains **deliberate placeholder** `DEMO-ONLY-REPLACE-WITH-FRESH-RANDOM-SEED`. Replacing it and replacing fixture domain properties requires **source-verified** disposable localnet genesis/program/mint/scope. Build must fail closed until these are provided. Do not swap in random-looking unverified values and call them deposit evidence.
- Rust 1.95.0 + pinned Holonix 0.7.1 must be run in a networked, controlled CI runner. Generate both Cargo locks via `cargo +1.95.0 generate-lockfile --manifest-path holochain/demo/Cargo.toml` and `cargo +1.95.0 generate-lockfile --manifest-path holochain/demo/ham-adapter/Cargo.toml`, review and commit the actual files, then run **both** builds with `--locked`. The uncommitted/missing locks are a further reproducibility blocker **after the missing local toolchain**.
- In real CI capture `rustc +1.95.0 -Vv`, `hc --version`, `cargo --version`, `git rev-parse HEAD`, both generated WASM SHA-256s, DNA SHA-256 and actual Holochain DNA hash, hApp SHA-256, both lockfile SHA-256s. Attach full CI logs and *sanitized* outputs. Run `hc dna inspect`/`hc app inspect` if supported by the pinned CLI; never infer DNA hash merely from `.dna` SHA256.
- Bundle must be newly produced from **own** zome WASMs, not reused verified signed Unyt v0.117.0 bytes. Existing PR #34 run 43583914753 is a **historical independent RAVE 5/5 PASS**, not PR #44 integration validation.

## Runtime hard stops

- No compiled own DNA, actual installed app/cell/DNA hash, external Lair signer, security-approved exact `record_observation` target, public `ActionHash` or restart readback exists in this execution.
- A1 PR #45 only exports an intentionally **source-only** `source/witness/destination` envelope; it must not be reinterpreted as A4's strict `source/proof` destination record. A3 authenticated outbox and domain-bound digest/receipt absent.
- Existing audit schema and source do **not** support refund/revocation; `historyComplete:false`, `independentConsensusVerified:false`, all four denial fields and deposit-only v1 are fixed.
- No published Unyt coordinator call, economic RAVE, credit, grant or withdrawal. Gate C NO-GO.

**Acceptance outcome: BLOCKED on real runner/toolchain + lockfiles + source-verified DNA scope, then SEC approval + real signed conductor tests.** This is a precise partial technical result, NOT a full demo.
