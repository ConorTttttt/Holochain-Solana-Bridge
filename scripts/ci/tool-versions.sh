#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/ci/toolchain.env
printf 'Expected: Node=%s Rust=%s Solana=%s Anchor=%s platform-tools=%s SBPF=%s\n' \
  "$NODE_VERSION" "$RUST_VERSION" "$SOLANA_VERSION" "$ANCHOR_VERSION" "$PLATFORM_TOOLS_VERSION" "$SBPF_ARCH"
for cmd in node npm rustc cargo solana solana-test-validator anchor; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%s: ' "$cmd"
    "$cmd" --version
  else
    echo "$cmd: NOT INSTALLED"
  fi
done
command -v rustup >/dev/null 2>&1 && rustup show active-toolchain || true
