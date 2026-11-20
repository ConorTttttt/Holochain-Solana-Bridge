#!/usr/bin/env bash
# Preflight for real conductor integration; refuses to claim DNA equivalence.
set -euo pipefail
for command_name in holochain hc cargo rustc sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "BLOCKED_REAL_HOLOCHAIN_SANDBOX: missing $command_name" >&2
    exit 2
  fi
done
holochain --version
hc --version
cargo --version
rustc --version
: "${UNYT_HAPP_PATH:?BLOCKED_REAL_HOLOCHAIN_SANDBOX: supply verified compiled Unyt .happ path}"
: "${UNYT_HAPP_SHA256:?BLOCKED_REAL_HOLOCHAIN_SANDBOX: supply reviewed sha256 of .happ}"
: "${UNYT_DNA_HASH:?BLOCKED_REAL_HOLOCHAIN_SANDBOX: supply verified deployed DNA hash}"
: "${UNYT_SOURCE_COMMIT:?BLOCKED_REAL_HOLOCHAIN_SANDBOX: supply exact zome source commit}"
test -s "$UNYT_HAPP_PATH"
printf '%s  %s\n' "$UNYT_HAPP_SHA256" "$UNYT_HAPP_PATH" | sha256sum --check
# Presence alone is NOT source equivalence or a zome validation execution.
# Require a separately reviewed hc sandbox generate/install/zome-call test.
echo 'BLOCKED_REAL_HOLOCHAIN_SANDBOX: zome validation harness unavailable' >&2
exit 2
