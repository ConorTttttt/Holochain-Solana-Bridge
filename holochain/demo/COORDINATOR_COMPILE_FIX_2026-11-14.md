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
