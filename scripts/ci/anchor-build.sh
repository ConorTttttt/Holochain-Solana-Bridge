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
# Anchor CLI 1.2.2 can return exit 0 after reporting key mismatch and generating *only* a host IDL.
# A real SBPF build must produce a non-empty eBPF ELF .so in addition to the IDL.
test -s target/deploy/deposit_prototype.so || { echo "SBPF_BINARY_MISSING: anchor build did not create target/deploy/deposit_prototype.so" >&2; exit 1; }
command -v readelf >/dev/null || { echo "REQUIRED_TOOL_MISSING: readelf" >&2; exit 1; }
if ! readelf -h target/deploy/deposit_prototype.so | grep -E 'Machine:.*(Linux BPF|BPF)' >/dev/null; then
  echo "INVALID_SBPF_BINARY: expected Linux BPF ELF" >&2
  exit 1
fi
node --input-type=module - <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const idl=JSON.parse(readFileSync('target/idl/deposit_prototype.json','utf8'));
const programId=readFileSync('ci-artifacts/localnet-program-id.txt','utf8').trim();
assert.equal(idl.address,programId,'generated IDL does not match temporary local program ID');
console.log('PASS: IDL address matches ephemeral localnet program key');
NODE
sha256sum target/idl/deposit_prototype.json target/deploy/deposit_prototype.so
