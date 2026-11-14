#!/usr/bin/env bash
# Verify RELEASE BYTES only. This is NOT a source-equivalent zome/DNA audit.
set -euo pipefail
if [[ $# -ne 1 || -z "$1" ]]; then
  echo 'Usage: verify-unyt-release.sh <artifact-output-directory>' >&2
  exit 2
fi
for cmd in curl sha256sum minisign mktemp grep cp; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "BLOCKED_UNYT_RELEASE_CHECK: missing $cmd" >&2
    exit 2
  fi
done
OUT=$1
if [[ "$OUT" != /* ]]; then OUT="$PWD/$OUT"; fi
BASE=https://github.com/unytco/unyt-sandbox/releases/download/v0.117.0
# Published at GitHub release v0.117.0; confirm via independent trusted channel
# before relying on any external economic authorization.
HAPP_SHA=0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1
DNA_SHA=918c3eb1a96c5cf00d0ca5af60f675e32a561857225883059276581c7e45aa71
SUMS_SHA=7736dee1f1d3867f99ec4098f7a30e2f9ba44475c2127191e55720fdf49f6f6f
SIG_SHA=ee846f0cb6ca17289c82de2dc15235c7eb1b3a2985f018f9b546ed4dfc7dd490
MINISIGN_KEY=RWTMgl5pLxSOVpkRiS5CMlFkrn7enASWilDEzRpfPeTBcBBJXcdu/rFO
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for f in unyt.happ alliance.dna SHA256SUMS SHA256SUMS.minisig; do
  curl --fail --location --show-error --silent --connect-timeout 15 --max-time 180 \
    "$BASE/$f" --output "$TMP/$f"
done
cd "$TMP"
printf '%s  %s\n' "$HAPP_SHA" unyt.happ "$DNA_SHA" alliance.dna \
  "$SUMS_SHA" SHA256SUMS "$SIG_SHA" SHA256SUMS.minisig | sha256sum --check
# Unyt's release README documents this public signing key; authenticate the
# *whole* signed checksum manifest before interpreting any individual entries.
minisign -VHm SHA256SUMS -P "$MINISIGN_KEY"
grep -Eq '(^|[[:space:]])unyt\.happ$' SHA256SUMS
grep -Eq '(^|[[:space:]])alliance\.dna$' SHA256SUMS
sha256sum --check --ignore-missing SHA256SUMS
mkdir -p "$OUT"
cp unyt.happ alliance.dna SHA256SUMS SHA256SUMS.minisig "$OUT/"
printf 'RELEASE_BYTES_VERIFIED: v0.117.0; NOT zome/source/deployment equivalence\n'
