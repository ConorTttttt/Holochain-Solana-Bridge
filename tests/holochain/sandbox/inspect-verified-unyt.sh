#!/usr/bin/env bash
# Read-only inspection of verified public Unyt release bundles using real hc.
# NOT a conductor execution, installed DNA hash, source equivalence, or credit gate.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo 'Usage: inspect-verified-unyt.sh <verified-release-dir> <evidence-dir>' >&2
  exit 2
fi
VERIFIED="$(cd "$1" && pwd)"
OUT="$2"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
for cmd in holochain hc sha256sum find grep; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "BLOCKED_UNYT_BUNDLE_INSPECTION: missing $cmd" >&2
    exit 2
  fi
done
for file in unyt.happ alliance.dna SHA256SUMS SHA256SUMS.minisig; do
  if [[ ! -s "$VERIFIED/$file" ]]; then
    echo "BLOCKED_UNYT_BUNDLE_INSPECTION: missing verified $file" >&2
    exit 2
  fi
done
{
  holochain --version
  hc --version
  holochain --build-info
} >"$OUT/runtime-versions.log" 2>&1
cat "$OUT/runtime-versions.log"
if ! holochain --version | grep -Eq '(^|[[:space:]])0\.7\.1([[:space:]]|$)'; then
  echo 'BLOCKED_UNYT_BUNDLE_INSPECTION: conductor is not Holochain 0.7.1' >&2
  exit 2
fi
sha256sum "$VERIFIED/unyt.happ" "$VERIFIED/alliance.dna" > "$OUT/verified-bundle-hashes.sha256"
# hc unpack creates output directories itself and rejects pre-existing paths.
hc app unpack "$VERIFIED/unyt.happ" --output "$OUT/happ-unpacked"
hc dna unpack "$VERIFIED/alliance.dna" --output "$OUT/dna-unpacked"
find "$OUT/happ-unpacked" "$OUT/dna-unpacked" -type f -print | sort > "$OUT/unpacked-files.txt"
find "$OUT/happ-unpacked" "$OUT/dna-unpacked" -type f -name '*.wasm' -print0 | sort -z | xargs -0 -r sha256sum > "$OUT/unpacked-wasm-hashes.sha256"
if [[ ! -s "$OUT/unpacked-wasm-hashes.sha256" ]]; then
  echo 'BLOCKED_UNYT_BUNDLE_INSPECTION: hc unpack produced no WASM files' >&2
  exit 2
fi
# Bundled DNA hash is NOT the installed DNA hash after modifiers.
hc dna hash "$VERIFIED/alliance.dna" > "$OUT/bundled-dna-hash.txt"
echo 'BINARY_BUNDLES_INSPECTED: static hc unpack succeeded; no conductor, agent, zome call or deployed DNA equivalence established'
