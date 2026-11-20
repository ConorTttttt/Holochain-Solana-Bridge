# Coordinator deserialization compiler fix — 14 November 2026

Parent source: A4 `c6b60ac3ab405e4b73509f6cd6a77d8d107da45c`.
Real local Rust 1.95.0 `--locked` WASM compilation reached coordinator line 54:
`error[E0277]: From<SerializedBytesError> is not implemented for WasmError`.
The integrity WASM compiled before this coordinator failure.

Map `RecordEntry::to_app_option` errors through `wasm_error!(err)` before
propagating. The pinned `holochain_wasmer_common` 0.0.103 implements
`From<SerializedBytesError>` for `WasmErrorInner`, which the macro accepts.
Malformed serialized entries still return an error. No schema, admission,
idempotency, capability, signature or economic rule changes.

Compile command (no conductor, keystore, installation or zome execution):

```sh
RUSTFLAGS='--cfg getrandom_backend="custom"' cargo +1.95.0 build --locked \
  --manifest-path holochain/demo/Cargo.toml \
  -p solana_audit_integrity -p solana_audit --release --target wasm32-unknown-unknown
```

The companion integration PR adopts the exact coordinator blob and retains all
four economic denials. Installation and every Holochain mutation remain blocked
until independently authorized for the exact call. CI at the new SHA is pending;
no signed action, readback or restart verification is claimed.


The companion integration run 43647669216 passed the real Solana lifecycle,
OBS Kit replay, source-domain binding and reviewed-lock gates, then returned
exit 101 during the build command. Archived Azure logs are inaccessible from
this workspace. Inspection of pinned Holonix shows it puts real Rust 1.95.0
binaries on PATH, rather than rustup proxies. Reproducing with the actual
installed `bin/cargo +1.95.0 --version` returns exit 101, “no such command”.
The build script now checks exact `rustc` and `cargo` 1.95.0 versions and calls
those binaries directly. This is a reproduced tooling defect and a likely CI
failure cause; packaging success still requires the new actual CI execution.
All source-domain, tracked-lock and economic gates remain intact.
