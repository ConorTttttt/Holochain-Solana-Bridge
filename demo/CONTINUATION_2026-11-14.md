# Same-run audit demo continuation — 14 November 2026

Continuation of PR #61 `baa9f164cf9fa39b34ae1d1d0c3007c7e9197dc1`, refs #20.
No independent authorization for any Holochain mutation has been supplied.

Changes:

- Adopt the exact A4 `c6b60ac3ab405e4b73509f6cd6a77d8d107da45c` reviewed
  native lock, macro manifest/lock correction and build script. Preserve both
  lock graphs and source-owner blob provenance; do not regenerate dependencies.
- Adopt the coordinator error mapping from companion PR #65, source
  `f34fc17` (full SHA recorded in `ci-integration-snapshot.json`). Actual locked
  Rust 1.95.0 compilation reproduced E0277, then both corrected integrity and
  coordinator WASMs compiled successfully. Review still pending.
- Correct the cross-lane artifact download destination to `ci-artifacts/`.
  GitHub strips that directory when uploading a single directory; the source
  binding step otherwise reads missing OBS files. PR #61 run 43645043998 job
  132604192413 actually failed at source binding, before its native-lock gate.
- Verify already committed native/WASM graphs with full locked Cargo metadata
  instead of treating the now-present reviewed native lock as a bootstrap error.
- Preserve actual native binary, WASMs, bundles and locks as build artifacts.
- Stop before installation/genesis as well as before zome writes. Automatic
  installers and installed-state promotion are disabled; the CI installer
  refuses with exit 3 before allocating a keystore. Caller approval flags
  cannot override this. Compilation and bundle packing do not run a conductor.
- After successful same-run SOL/OBS-bound packing, emit the build digests,
  actual `hc dna hash` and proposed installer request. This is a review request,
  not authorization; runtime paths/agent remain unallocated. Installation and
  external-Lair identity require their own independent exact-call authorization.

Executed local checks: Node v24.22.1; runtime/ABI suite 60/60 and independent
mutation-boundary tests 2/2; Observer suite 149/149, no skips/failures; shell
syntax; native lock structural review. Actual corrected WASM build succeeded
using Rust 1.95.0, locked HDK 0.7.1/HDI 0.8.1. Native build and new exact-SHA CI
are pending at the time of this note. Local output is not CI or installation
proof. No existing remote branch or main was updated.

Remaining: same-run native/WASM and bundle evidence, independent authorization
before installation, actual installed app/CellId/agent, external-Lair signer,
reviewed v2 ABI, independently approved exact canonical call, signed ActionHash,
typed readback and restart/replay verification. No DEMO READY claim.

`creditEligible:false`, `independentConsensusVerified:false`,
`spendableBaseUnits:"0"`, `withdrawalAuthorized:false`; history incomplete;
published Unyt and economic gates remain blocked.
