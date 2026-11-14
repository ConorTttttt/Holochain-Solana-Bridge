#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for tool in cargo hc sha256sum; do command -v "$tool" >/dev/null || { echo "MISSING $tool" >&2; exit 2; }; done
# Only a pinned 0.7.1 HC toolchain may produce authoritative artifacts.
if ! hc --version | grep -Eq '0\.7\.1'; then echo 'REQUIRE hc 0.7.1' >&2; exit 2; fi
if grep -q 'DEMO-ONLY-REPLACE-WITH-FRESH-RANDOM-SEED' dna.yaml; then
  echo 'REFUSED: replace sample network_seed and source scope from verified disposable localnet' >&2; exit 2
fi
cargo build --manifest-path Cargo.toml -p solana_audit_integrity -p solana_audit \
  --release --target wasm32-unknown-unknown
hc dna pack .
hc app pack .
sha256sum target/wasm32-unknown-unknown/release/solana_audit*.wasm ./*.dna ./*.happ
printf '%s\n' 'Build is NOT runtime proof: install and signed HAM read/write/restart remain mandatory.'
