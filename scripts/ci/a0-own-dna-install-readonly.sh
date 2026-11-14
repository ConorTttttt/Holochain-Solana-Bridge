#!/usr/bin/env bash
# CI-owned real Holochain 0.7.1 disposable OWN-DNA install and admin READ ONLY.
# NOT external Lair/HAM signing or record_observation, grant, economic credit.
set +x
set -Eeuo pipefail
umask 077
if [[ $# -ne 3 ]]; then
  echo 'Usage: a0-own-dna-install-readonly.sh <verified-happ> <verified-dna> <output-dir>' >&2
  exit 2
fi
HAPP="$(realpath "$1")"
DNA="$(realpath "$2")"
mkdir -p "$3/logs"
OUT="$(cd "$3" && pwd)"
ROOT="$(mktemp -d /tmp/hsc-own-dna-XXXXXX)"
RUN_PID=''
cleanup(){
  local rc=$?
  if [[ -n "$RUN_PID" ]]; then
    kill -INT "$RUN_PID" 2>/dev/null || true
    wait "$RUN_PID" 2>/dev/null || true
  fi
  for log in "$OUT/logs/install.log" "$OUT/logs/restart.log"; do
    if [[ -f "$log" ]]; then sed -Ei 's@(socket\?k=)[A-Za-z0-9_-]+@\1[REDACTED]@g' "$log"; fi
  done
  rm -rf -- "$ROOT"
  if [[ "$rc" != 0 ]]; then
    printf 'BLOCKED_OWN_DNA_INSTALL_READONLY: exit=%s (inspect sanitized logs)\n' "$rc" >&2
  fi
}
trap cleanup EXIT
for cmd in hc holochain jq timeout sha256sum sed sleep grep realpath; do
  command -v "$cmd" >/dev/null || { echo "MISSING_READONLY_TOOL:$cmd" >&2; exit 2; }
done
test -s "$HAPP"
test -s "$DNA"
hc --version | grep -Eq '0\.7\.1'
holochain --version | grep -Eq '0\.7\.1'
printf '%s\n' 'Immutable source and bundle identity is checked in the invoking CI job.'
hc dna hash "$DNA" > "$OUT/logs/real-hc-dna-hash.txt"
EXPECTED_DNA="$(grep -Eo 'uhC0k[A-Za-z0-9_-]+' "$OUT/logs/real-hc-dna-hash.txt" | head -1)"
[[ -n "$EXPECTED_DNA" ]] || { echo 'MISSING_ACTUAL_HC_DNA_HASH' >&2; exit 2; }
# Private throwaway keystore under short Unix path. This DOES NOT establish
# Agent 4's separately required external-Lair HAM signing approval.
PASSPHRASE='throwaway-own-dna-audit-ci-no-value'
cd "$ROOT"
printf '%s' "$PASSPHRASE" | timeout --signal=INT 300s hc sandbox --piped generate \
  --app-id hsc-audit-demo-readonly --in-process-lair --root "$ROOT" \
  --directories agent-a "$HAPP" network mem > "$OUT/logs/install.log" 2>&1 || {
    echo 'FIRST_FAILING_COMMAND: hc sandbox --piped generate (own DNA)' >&2
    exit 2
  }
test -s "$ROOT/.hc" || { echo 'MISSING_OWN_DNA_SANDBOX_REGISTRY' >&2; exit 2; }
hc sandbox list --verbose > "$OUT/logs/sandbox-inventory.log" 2>&1
printf '%s' "$PASSPHRASE" | timeout --signal=INT 240s hc sandbox --piped run \
  > "$OUT/logs/restart.log" 2>&1 &
RUN_PID=$!
PORT=''
for _ in $(seq 1 75); do
  kill -0 "$RUN_PID" 2>/dev/null || {
    echo 'FIRST_FAILING_COMMAND: hc sandbox --piped run (conductor stopped)' >&2
    exit 2
  }
  PORT="$(hc sandbox admin-ports 2>/dev/null | sed -nE 's/^[[:space:]]*\[[[:space:]]*([0-9]+)[[:space:]]*\][[:space:]]*$/\1/p' || true)"
  if [[ -n "$PORT" ]] && hc client call --port "$PORT" list-apps \
    > "$OUT/logs/installed-apps.json" 2>&1; then break; fi
  sleep 2
done
if [[ -z "$PORT" || ! -s "$OUT/logs/installed-apps.json" ]]; then
  echo 'FIRST_FAILING_COMMAND: hc client call --port <admin> list-apps' >&2
  exit 2
fi
APP_ID='hsc-audit-demo-readonly'
# Exact required ONE owned audit cell, app ID, enabled state, agent and DNA
# hash must agree. Never assume the bundled hash equals installed identity.
CELL_IDENTITY="$(jq -cer --arg app "$APP_ID" --arg dna "$EXPECTED_DNA" '
  [ .[] | select(.installed_app_id == $app and .status.type == "enabled") |
    . as $info |
    select((.cell_info.audit | length) == 1 and
      .cell_info.audit[0].type == "provisioned" and
      .cell_info.audit[0].value.cell_id.dna_hash == $dna and
      .cell_info.audit[0].value.cell_id.agent_pub_key == $info.agent_pub_key) |
    {dnaHash:.cell_info.audit[0].value.cell_id.dna_hash,
     signer:.agent_pub_key,
     agentPubKey:.cell_info.audit[0].value.cell_id.agent_pub_key}
  ] | if length == 1 then .[0] else error("AMBIGUOUS_OR_WRONG_OWN_AUDIT_CELL") end
' "$OUT/logs/installed-apps.json")" || {
  echo 'OWN_DNA_INSTALLED_APP_ROLE_DNA_AGENT_MISMATCH' >&2; exit 2;
}
hc client call --port "$PORT" list-cells > "$OUT/logs/installed-cells.json" 2>&1 || {
  echo 'FIRST_FAILING_COMMAND: hc client call --port <admin> list-cells' >&2
  exit 2
}
# Validate CellId appears EXACTLY ONCE (list-cells read-only).
jq -e --argjson identity "$CELL_IDENTITY" '
  [ .[] | select(.dna_hash == $identity.dnaHash and
                  .agent_pub_key == $identity.agentPubKey) ] | length == 1
' "$OUT/logs/installed-cells.json" >/dev/null || {
  echo 'OWN_DNA_CELLID_NOT_UNIQUE_OR_MISSING' >&2; exit 2;
}
printf '%s' "$CELL_IDENTITY" | jq --arg app "$APP_ID" \
  '{schema:"hsc-a0-owned-dna-disposable-readonly-v1",
    appId:$app, role:"audit",
    cellId:{dnaHash:.dnaHash,agentPubKey:.agentPubKey},
    signer:.signer,
    installation:"OWN_AUDIT_DNA_ACTUAL_DISPOSABLE_CONDUCTOR_INSTALLED",
    adminReadOnlyListAppsAndCells:true,
    hamExternalLairPreflight:"BLOCKED_NO_EXTERNAL_LAIR_CONFIG",
    signedObservationActionHash:null, approvedV2Abi:false,
    signedZomeCallExecuted:false,capabilityGrantExecuted:false,
    creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:"0",withdrawalAuthorized:false}' \
  > "$OUT/own-dna-install-readonly.json"
sha256sum "$OUT/own-dna-install-readonly.json" > "$OUT/own-dna-install-readonly.sha256"
echo 'OWN_DNA_INSTALL_ADMIN_READ_ONLY_PASS; EXTERNAL_LAIR_HAM_PREFLIGHT_BLOCKED; NO ZOME WRITE'
