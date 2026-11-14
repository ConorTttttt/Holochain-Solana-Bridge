#!/usr/bin/env bash
# Controlled, FAIL-CLOSED reproducible build of OUR OWN audit-only DNA.
# Not a Holochain installation, authorization, Unyt proof or Solana finality proof.
set -euo pipefail
cd "$(dirname "$0")"
for tool in cargo rustc hc sha256sum git; do
  command -v "$tool" >/dev/null || { echo "MISSING $tool" >&2; exit 2; }
done
for lock in Cargo.lock ham-adapter/Cargo.lock; do
  if [[ ! -s "$lock" ]]; then
    echo "BLOCKED: $lock missing; generate using Rust 1.95.0, review and commit before --locked build" >&2
    exit 3
  fi
  if ! git ls-files --error-unmatch "$lock" >/dev/null 2>&1; then
    echo "BLOCKED: $lock is not tracked in immutable repository source" >&2
    exit 3
  fi
done
if ! hc --version | grep -Eq '0\.7\.1'; then
  echo 'REQUIRE hc 0.7.1' >&2
  exit 2
fi
if grep -Eq 'DEMO-ONLY-REPLACE|0707070707070707070707070707070707070707070707070707070707070707' dna.yaml; then
  echo 'REFUSED: sample network seed or unverified localnet properties remain in dna.yaml' >&2
  exit 2
fi
# CI must run this against an immutable reviewed commit and a manifest with
# independent, source-verified DISPOSABLE Solana genesis/program/mint/scope.
# Neither a random seed nor passing YAML syntax proves that provenance.
echo 'BUILD SOURCE (not runtime/call approval):'
git rev-parse HEAD
rustc +1.95.0 -Vv
cargo +1.95.0 --version
hc --version
echo 'LOCKFILE DIGESTS:'
sha256sum Cargo.lock ham-adapter/Cargo.lock
# Fail before packing if either native signing ABI or zome WASMs fail to compile.
cargo +1.95.0 build --locked --manifest-path ham-adapter/Cargo.toml --release
# Holochain 0.7.1 WASM requires the custom getrandom backend; keep
# native HAM/Lair build separate from this WASM-only compilation flag.
RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }--cfg getrandom_backend=\"custom\"" \
  cargo +1.95.0 build --locked --manifest-path Cargo.toml \
    -p solana_audit_integrity -p solana_audit --release --target wasm32-unknown-unknown
hc dna pack .
hc app pack .
native_ham='ham-adapter/target/release/solana-audit-ham-adapter'
wasm_integrity='target/wasm32-unknown-unknown/release/solana_audit_integrity.wasm'
wasm_coordinator='target/wasm32-unknown-unknown/release/solana_audit.wasm'
bundle_dna='holochain_solana_audit_demo.dna'
bundle_happ='holochain_solana_audit_demo.happ'
for path in "$native_ham" "$wasm_integrity" "$wasm_coordinator" "$bundle_dna" "$bundle_happ"; do
  [[ -s "$path" ]] || { echo "BUILD ARTIFACT MISSING: $path" >&2; exit 3; }
done
echo 'SHA256 of actual artifacts:'
sha256sum "$native_ham" "$wasm_integrity" "$wasm_coordinator" "$bundle_dna" "$bundle_happ" \
  Cargo.lock ham-adapter/Cargo.lock | tee demo-build-artifacts.sha256
echo 'HOLOCHAIN DNA ID (not the DNA bundle SHA256):'
hc dna hash "$bundle_dna" | tee demo-build-dna-hash.txt
test -s demo-build-dna-hash.txt || { echo 'DNA HASH MISSING' >&2; exit 3; }
printf '%s\n' 'BUILT ONLY: external Lair, installed CellId, SEC-scoped write approval, signed ActionHash and readback remain separate gates.'
