#!/usr/bin/env bash
# Fail-closed provenance check for EXACT published rave_engine 0.15.0 bytes.
# This does not verify the deployed Unyt DNA or any Holochain coordinator.
set -euo pipefail
EXPECTED_SHA256=7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde
INDEX_URL=https://index.crates.io/ra/ve/rave_engine
ARCHIVE_URL=https://static.crates.io/crates/rave_engine/rave_engine-0.15.0.crate
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT

curl --fail --location --show-error --silent --connect-timeout 15 --max-time 120 \
  "$INDEX_URL" --output "$ROOT/registry.jsonl"
python3 - "$ROOT/registry.jsonl" "$EXPECTED_SHA256" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as file:
    entries = [json.loads(line) for line in file if line.strip()]
matching = [e for e in entries if e.get('vers') == '0.15.0']
assert len(matching) == 1, 'registry version 0.15.0 missing/duplicated'
assert matching[0]['cksum'] == sys.argv[2], 'registry checksum differs from reviewed checksum'
assert matching[0].get('yanked') is False, 'published version is yanked'
print('OK: registry-published checksum and immutable version metadata match')
PY

curl --fail --location --show-error --silent --connect-timeout 15 --max-time 120 \
  "$ARCHIVE_URL" --output "$ROOT/rave_engine-0.15.0.crate"
printf '%s  %s\n' "$EXPECTED_SHA256" "$ROOT/rave_engine-0.15.0.crate" | sha256sum --check
printf 'OK: rave_engine 0.15.0 published archive SHA-256 %s\n' "$EXPECTED_SHA256"

# Read manifest and source from verified archive, never an unrelated Git revision.
tar -xzOf "$ROOT/rave_engine-0.15.0.crate" rave_engine-0.15.0/Cargo.toml > "$ROOT/Cargo.toml"
grep -Eq '^name = "rave_engine"$' "$ROOT/Cargo.toml"
grep -Eq '^version = "0\.15\.0"$' "$ROOT/Cargo.toml"
for version in '0.8.1' '0.7.1' '0.9.1'; do
  grep -F "version = \"$version\"" "$ROOT/Cargo.toml" >/dev/null
done
for source in src/lib.rs src/reserve.rs src/rhai_engine/mod.rs \
  src/types/entries/rave/parked_link/mod.rs \
  src/types/entries/commitment.rs src/types/entries/receipt.rs \
  src/types/entries/reclaim.rs; do
  tar -tzf "$ROOT/rave_engine-0.15.0.crate" "rave_engine-0.15.0/$source" >/dev/null
done
echo 'OK: verified crate includes RAVE source paths and declared dependencies'
