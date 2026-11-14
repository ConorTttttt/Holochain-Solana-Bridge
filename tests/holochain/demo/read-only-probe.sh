#!/usr/bin/env bash
# Read-only pre-approval HAM/Lair gate. NEVER calls record_observation.
# Run only against an installed OWN disposable audit app, not published Unyt.
set +x
set -euo pipefail
cd "$(dirname "$0")/../../.."
for exe in cargo git; do
  command -v "$exe" >/dev/null || { echo "BLOCKED: missing $exe" >&2; exit 2; }
done
manifest='holochain/demo/ham-adapter/Cargo.toml'
lock='holochain/demo/ham-adapter/Cargo.lock'
[[ -s "$lock" ]] && git ls-files --error-unmatch "$lock" >/dev/null 2>&1 ||
  { echo 'BLOCKED: native HAM Cargo.lock must be reviewed and committed' >&2; exit 3; }
for key in DEMO_ADMIN_PORT DEMO_APP_PORT DEMO_APP_ID DEMO_CONDUCTOR_CONFIG \
           DEMO_LAIR_PASSPHRASE_FILE DEMO_EXPECTED_DNA_HASH DEMO_EXPECTED_AGENT; do
  [[ -n "${!key:-}" ]] || { echo "BLOCKED: missing $key" >&2; exit 2; }
done
echo 'READ-ONLY baseline: HAM Node Lair and exact app/role/cell/agent/ABI signed contract probe.'
cargo +1.95.0 run --quiet --locked --manifest-path "$manifest" -- preflight
if [[ ${1:-} == '--negative' ]]; then
  # A successful baseline is mandatory. Each deliberate failure must have the
  # SPECIFIC expected class, not merely a network/Cargo failure.
  negative() {
    local label="$1" expected="$2" result status
    shift 2
    status=0
    result="$(env "$@" cargo +1.95.0 run --quiet --locked --manifest-path "$manifest" -- preflight 2>&1)" || status=$?
    if [[ "$status" -eq 0 || "$result" != *"$expected"* ]]; then
      echo "NEGATIVE FAILED: $label (expected sanitized $expected; got status $status)" >&2
      exit 1
    fi
    echo "NEGATIVE PASS: $label -> $expected"
  }
  negative 'forbidden published app ID' 'PUBLISHED_UNYT_APP_REFUSED' \
    DEMO_APP_ID='unyt-v0117-audit'
  negative 'uppercase published app ID' 'PUBLISHED_UNYT_APP_REFUSED' \
    DEMO_APP_ID='UNYT-v0117-audit'
  negative 'unexpected DNA' 'DEMO_DNA_OR_SIGNER_MISMATCH' \
    DEMO_EXPECTED_DNA_HASH='uhC0kWrongDisposableDna'
  negative 'unexpected agent' 'DEMO_DNA_OR_SIGNER_MISMATCH' \
    DEMO_EXPECTED_AGENT='uhCAkWrongDisposableAgent'
  negative 'missing Lair passphrase file' 'LAIR_REQUIRED_OR_INVALID' \
    DEMO_LAIR_PASSPHRASE_FILE='/not-present-a4-readonly-preflight-lair'
  negative 'missing conductor config' 'LAIR_REQUIRED_OR_INVALID' \
    DEMO_CONDUCTOR_CONFIG='/not-present-a4-readonly-conductor-config'
  echo 'READ-ONLY negative probes passed; NO mutating call was attempted.'
elif [[ $# -gt 0 ]]; then
  echo 'USAGE: read-only-probe.sh [--negative] (no deliver command)' >&2
  exit 2
else
  echo 'READ-ONLY identity/contract preflight passed; request exact SEC tuple review before any write.'
fi
