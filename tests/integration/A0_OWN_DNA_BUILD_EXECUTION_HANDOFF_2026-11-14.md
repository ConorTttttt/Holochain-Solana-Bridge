# A0 P0 — actual own-DNA build execution gate and immutable integration handoff

Date: 2026-11-14. Lane: Agent 1 / CI (#16, #20). Parent candidate: PR #51,
`101e6ecfb33fbee40c21caf54bc1ff6d8fcb22b0`.
This is an **audit-only** integration follow-up. It does not adopt unreviewed
specialist source or authorize a Holochain write.

## Ground truth at inspected exact sources

| Lane | Exact SHA / PR | What can be claimed |
|---|---|---|
| Integration | `101e6ecfb33fbee40c21caf54bc1ff6d8fcb22b0` / #51 | Shared CI [43600000639](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43600000639): 6/6 pass. Real SOL/OBS/RAVE integration [43600000619](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43600000619): 3/3 pass. **Not v2 outbox or own-DNA build.** |
| Previous A0 readiness | same SHA / [43600000629](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43600000629) | Static job pass (4 tests). Own-DNA build **SKIPPED**, because its `if` accepted `workflow_dispatch` only. Readiness reported `buildInputsTracked:false`. Archived readiness artifact ID `14116505087`, uploader ZIP SHA256 `8c4101c0a8862b0e2dff29e5f4b42b0a224eef6abc320e6c9b3ea8c09aed1ff5`. |
| SOL | `640714a14ba338c615cf2ada55ca4166646a2d96` / #50 | Real local validator success is source-owner-reported; not independently adopted by A0. Fixture uses unverified `0x07` Holochain scope; source-authenticated new domain required. |
| OBS v2 | `3c919624ae9cd747501f8cb48a1f12bd8908561c` / #52 | Source-owned Kit `DemoOutbox.queueVerified` proposed. Shared CI [43599460598](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43599460598) **failed** `security/test/ledger-corruption-boundary.test.mjs` with `Indexer ledger failed: invalid or authoritative deposit evidence`. No genuine integrated same-SHA v2 replay yet. |
| Own audit DNA | `049c3787584215e016e988c1dc4430f3dad04190` / #44 | SOURCE ONLY, draft. Both `holochain/demo/Cargo.lock` and `holochain/demo/ham-adapter/Cargo.lock` absent; `dna.yaml` contains a network-seed placeholder and `0707…` scope. No actual compiled WASM/DNA/hApp, real own-DNA hash, installed app/CellId or Lair ActionHash. |
| SEC | `2f82cede69dffed2157654de6e112bf8b17ac6e4` / #33 | Current HEAD identified; **no independent exact A0 v2/source/signer/write approval** has been established. Same implementation-author identity cannot self-review. |

### Exact initial source/build blockers

Previous runtime inventory on PR #51 listed **ten missing tracked build inputs**:

`holochain/demo/{Cargo.toml,Cargo.lock,dna.yaml,happ.yaml,build.sh}`,
`holochain/demo/ham-adapter/{Cargo.toml,Cargo.lock,src/main.rs}`,
`holochain/demo/integrity/src/lib.rs`,
`holochain/demo/coordinator/src/lib.rs`.

The A4 branch contains source for eight of these but does **not** contain the two
required locks; it also refuses its own placeholder Solana scope and seed.
Do not copy a lock from an unrelated workspace, synthesize a scope, or claim the
existing `0x07` bytes are independently proven.

## What this CI follow-up changes

The original workflow's actual build job was restricted to
`if: github.event_name == 'workflow_dispatch'`. It therefore skipped every
PR event even after a successful readiness job. The follow-up removes that
restriction, checks out `github.event.pull_request.head.sha || github.sha`
for **both** jobs (the GitHub PR merge SHA is not the reviewed source HEAD), and
enforces a literal `git rev-parse HEAD` equality assertion before any build
tools are installed. All report and artifact identifiers use that same exact SHA.

The first source preflight remains:

```bash
node demo/a0-runtime-gate.mjs --out ci-artifacts/a0-runtime-readiness.json --require-build
```

If sources/locks/scope are unavailable, the required build job **FAILS with
exit code 3** at this command, before Nix/Rust/Holochain installation; its
`if: always()` artifact upload retains the blocked report. This is expected
**on the current tree**, not a claim that a new CI execution has occurred.

Only after reviewed prerequisites are adopted on an immutable A0 integration
branch may the build proceed to:

```bash
rustup toolchain install 1.95.0 --profile minimal
rustup target add wasm32-unknown-unknown --toolchain 1.95.0
nix develop 'github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da' --command bash holochain/demo/build.sh
(cd holochain/demo && sha256sum --check demo-build-artifacts.sha256)
```

These commands are **scheduled but NOT executed** by this documentation.
Their success must be confirmed by actual exact-SHA Actions job logs. The
source-owned build script must produce two WASMs, native HAM build, DNA and
hApp bundles, actual `hc dna hash` output, and both lock SHA-256s. Building
does not install a DNA, prove authorization, deliver an outbox record or create
an ActionHash.

## Required handoffs before A0 can advance

**A2 / A4 domain handoff:** source-verify a *new disposable localnet*
`genesis + program + mint + 32-byte scope` tuple and the originally submitted
signed initialization transaction and containing block. The test archive,
generated IDL, receipt PDA, original/later snapshots and DNA properties must
all derive from **the same immutable source**. Do not patch transaction
expectations or substitute a convenient fixture scope. A4 must review and
commit its two own-DNA Cargo lockfiles with native/WASM dependency provenance.

**A3 v2 handoff:** independently resolve the exact #52 SEC ledger fixture
failure, freeze the v2 typed admission and DNA ABI with A4/A5, and supply exact
source blob hashes and tests. A0 must run true in-process
`DemoOutbox.queueVerified` with the actual SOL producer witness at the
same integration SHA. Required: original submitted signed transaction,
verified whole containing block, generated IDL, canonical PDA, exact
genesis/program/mint/scope, source ledger, initial/later receipt observations,
immutable source verifier version and canonical v2 digest. A local outbox
`pending/uncertain` is **not** a successful Holochain ACK.

**A4 / A5 read-only runtime:** after a real build, install the own disposable
0.7.1 DNA; independently inspect app ID, DNA hash, full CellId, agent identity,
external Lair and HAM `CapGrantOptIn::Withheld`. Execute only approved
read-only probes. Request separate authorization for the **exact** app/DNA/
cell/agent/caller/signer/ABI/payload tuple. Until that approval exists,
**do not invoke `record_observation`**; no fake action hash, fake readback or
v1 origin-label promotion. Absolutely no published Unyt coordinator mutation.

**B1 / C:** selected containing blocks are not complete two-provider
produced-slot history, independent Solana consensus, a nonrefundable custody
guarantee or adversarial off-host rollback protection.

## Reproducibility and gated status

For each new PR candidate record SHA, tool versions, both Cargo locks,
source-owner blob hashes, downloaded original public evidence ZIP/manifest
digests, generated IDL and ELF digests, WASM/bundle digests, real DNA hash and
every real workflow job's **success/failure/skipped** conclusion. Preserve all
prior failed runs and never replace them with a static readiness pass.

- **A0**: `BLOCKED_NOT_ACCEPTED` until same-SHA v2 authenticated admission
  and independently authorized genuine signed own-DNA readback/restart.
- **B1**: `BLOCKED_HISTORY_INCOMPLETE`.
- **B2**: `BLOCKED_RELEASED_UNYT_COORDINATOR`.
- **C**: `NO_GO_ECONOMIC`.

The only allowed economic fields in all relevant records are
`creditEligible:false`,
`independentConsensusVerified:false`,
`spendableBaseUnits:"0"`,
`withdrawalAuthorized:false`.

No economic RAVE, spendable Holochain credit, withdrawals, production assets,
main merge or autonomous independent review.
