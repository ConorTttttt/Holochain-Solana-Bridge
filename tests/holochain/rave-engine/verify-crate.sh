#!/usr/bin/env bash
# Verifies exactly the published rave_engine 0.15.0 .crate archive, before tests.
set -euo pipefail
EXPECTED_SHA256=7987b4bf8932a86c7da1e85d8803c9de2c96e8c9c5a68d9d9802b19376fb8fde
URL=https://static.crates.io/crates/rave_engine/rave_engine-0.15.0.crate
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
curl --fail --location --show-error --silent --connect-timeout 15 --max-time 120 "$URL" --output "$ROOT/rave_engine-0.15.0.crate"
printf '%s  %s\n' "$EXPECTED_SHA256" "$ROOT/rave_engine-0.15.0.crate" | sha256sum --check --status
printf 'OK: rave_engine 0.15.0 published archive SHA-256 %s\n' "$EXPECTED_SHA256"
# The normalized Cargo.toml is inside the checked archive, not downloaded separately.
tar -xzOf "$ROOT/rave_engine-0.15.0.crate" rave_engine-0.15.0/Cargo.toml > "$ROOT/Cargo.toml"
grep -Eq '^name = "rave_engine"$' "$ROOT/Cargo.toml"
grep -Eq '^version = "0\.15\.0"$' "$ROOT/Cargo.toml"
grep -F 'version = "0.8.1"' "$ROOT/Cargo.toml" >/dev/null
grep -F 'version = "0.7.1"' "$ROOT/Cargo.toml" >/dev/null
grep -F 'version = "0.9.1"' "$ROOT/Cargo.toml" >/dev/null
printf 'OK: crate identity and HDI/HDK/ZFuel dependency requirements present in normalized manifest\n'
