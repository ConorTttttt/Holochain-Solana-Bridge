#!/usr/bin/env bash
# Fail on missing tools, wrong tool versions, compilation errors, or absent IDL.
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/ci/toolchain.env
for cmd in rustc cargo solana anchor; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "REQUIRED_TOOL_MISSING: $cmd" >&2; exit 1; }
done
check_version() {
  local name="$1" actual="$2" expected="$3"
  if [ "$actual" != "$expected" ]; then
    echo "TOOLCHAIN_MISMATCH: $name expected $expected got $actual" >&2
    exit 1
  fi
}
check_version rust "$(rustc --version | awk '{print $2}')" "$RUST_VERSION"
check_version solana "$(solana --version | awk '{print $2}')" "$SOLANA_VERSION"
check_version anchor "$(anchor --version | awk '{print $NF}')" "$ANCHOR_VERSION"
echo "Running required Anchor build; no deployment and no key sync."
NO_DNA=1 anchor build --tools-version "$PLATFORM_TOOLS_VERSION" --arch "$SBPF_ARCH"
test -s target/idl/deposit_prototype.json || { echo "IDL_MISSING: target/idl/deposit_prototype.json" >&2; exit 1; }
sha256sum target/idl/deposit_prototype.json
