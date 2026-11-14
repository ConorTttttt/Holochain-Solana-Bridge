#!/usr/bin/env bash
# Actual Holochain 0.7.1 read-only installation of OUR compiled audit-only DNA.
# Never invokes record_observation, a capability grant, Unyt or economic zomes.
# No Lair passphrase, token, key material or conductor database leaves the runner.
set -euo pipefail
set +x
[[ $# == 3 ]] || { echo 'USAGE: a4-install-readonly.sh <own-happ> <own-dna> <public-evidence-dir>' >&2; exit 2; }
for cmd in hc holochain jq python3 sha256sum timeout find realpath; do
  command -v "$cmd" >/dev/null || { echo "A4_MISSING_TOOL:$cmd" >&2; exit 2; }
done
HAPP="$(realpath "$1")"; DNA="$(realpath "$2")"
[[ -s "$HAPP" && -s "$DNA" ]] || { echo 'A4_BUNDLE_MISSING' >&2; exit 3; }
OUT="$3"; mkdir -p "$OUT"; OUT="$(realpath "$OUT")"
ROOT="$(mktemp -d /tmp/hsc-a4-XXXXXX)"
PID=''; APP='hsc-owned-audit-demo55-readonly'
cleanup() {
  if [[ -n "$PID" ]]; then kill -INT "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi
  for f in "$OUT"/*.log; do
    [[ -f "$f" ]] || continue
    sed -Ei -e 's@(socket\\?k=)[^[:space:]"\\\\]+@\\1[REDACTED]@g' \\
      -e 's@((token|passphrase|password|secret)[[:space:]]*[:=][[:space:]]*)[^[:space:]",}]+@\\1[REDACTED]@Ig' "$f"
  done
  rm -rf -- "$ROOT"
}
trap cleanup EXIT
[[ "$(hc --version)" == *'0.7.1'* ]] || { echo 'A4_HC_VERSION_REFUSED' >&2; exit 2; }
EXPECTED_DNA="$(hc dna hash "$DNA" | grep -oE 'uhC0k[[:alnum:]_-]+' | head -1)"
[[ "$EXPECTED_DNA" == uhC0k* ]] || { echo 'A4_DNA_HASH_NOT_FROM_HC' >&2; exit 3; }
sha256sum "$HAPP" "$DNA" > "$OUT/installed-bundle-sha256.log"
PASSPHRASE="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
printf '%s' "$PASSPHRASE" > "$ROOT/lair-passphrase"
chmod 600 "$ROOT/lair-passphrase"
cd "$ROOT"
# Deliberately OMIT --in-process-lair. A separate Lair process must be reachable
# using the node conductor config, and HAM must sign a read-only get_contract.
printf '%s' "$PASSPHRASE" | timeout --signal=INT 300s hc sandbox --piped generate \\
  --app-id "$APP" --root "$ROOT" --directories agent-a \\
  "$HAPP" network mem > "$OUT/install.log" 2>&1 || {
    echo 'A4_EXTERNAL_LAIR_SANDBOX_INSTALL_FAILED' >&2; exit 3;
  }
[[ -s "$ROOT/.hc" ]] || { echo 'A4_SANDBOX_REGISTRY_MISSING' >&2; exit 3; }
mapfile -d '' CONFIGS < <(find "$ROOT" -name 'conductor-config.yaml' -type f -print0)
[[ ${#CONFIGS[@]} == 1 ]] || { echo 'A4_EXPECT_ONE_CONDUCTOR_CONFIG' >&2; exit 3; }
CONFIG="${CONFIGS[0]}"
printf '%s' "$PASSPHRASE" | timeout --signal=INT 180s hc sandbox --piped run > "$OUT/restart.log" 2>&1 &
PID=$!
PORT=''
for _ in $(seq 1 75); do
  kill -0 "$PID" 2>/dev/null || { echo 'A4_CONDUCTOR_TERMINATED' >&2; exit 3; }
  PORT="$(hc sandbox admin-ports 2>/dev/null | sed -nE 's/^[[:space:]]*\\[[[:space:]]*([0-9]+)[[:space:]]*\\][[:space:]]*$/\\1/p' || true)"
  if [[ -n "$PORT" ]] && hc client call --port "$PORT" list-apps > "$OUT/list-apps.log" 2>&1; then break; fi
  sleep 2
done
[[ -n "$PORT" && -s "$OUT/list-apps.log" ]] || { echo 'A4_ADMIN_LIST_APPS_FAILED' >&2; exit 3; }
AGENT="$(jq -er --arg app "$APP" --arg dna "$EXPECTED_DNA" '
  .[] | select(.installed_app_id==$app and .status.type=="enabled" and
    (.cell_info.audit|length)==1 and .cell_info.audit[0].type=="provisioned" and
    .cell_info.audit[0].value.cell_id.dna_hash==$dna and
    .cell_info.audit[0].value.cell_id.agent_pub_key==.agent_pub_key) | .agent_pub_key
' "$OUT/list-apps.log")" || { echo 'A4_APP_ROLE_CELL_ID_MISMATCH' >&2; exit 3; }
hc client call --port "$PORT" list-cells > "$OUT/list-cells.log" 2>&1 || {
  echo 'A4_ADMIN_LIST_CELLS_FAILED' >&2; exit 3;
}
jq -e --arg dna "$EXPECTED_DNA" --arg agent "$AGENT" '
  any(.[]; .dna_hash==$dna and .agent_pub_key==$agent)
' "$OUT/list-cells.log" >/dev/null || { echo 'A4_INSTALLED_CELL_NOT_FOUND' >&2; exit 3; }
APP_PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
EXE="${A4_HAM_BINARY:-}"
[[ -n "$EXE" && -x "$EXE" ]] || { echo 'A4_NATIVE_BINARY_MISSING' >&2; exit 3; }
export DEMO_ADMIN_PORT="$PORT" DEMO_APP_PORT="$APP_PORT" DEMO_APP_ID="$APP"
export DEMO_CONDUCTOR_CONFIG="$CONFIG" DEMO_LAIR_PASSPHRASE_FILE="$ROOT/lair-passphrase"
export DEMO_EXPECTED_DNA_HASH="$EXPECTED_DNA" DEMO_EXPECTED_AGENT="$AGENT"
# Archived source is visibly distinguished from any current same-run validator.
for k in SOLANA_GENESIS SOLANA_PROGRAM SOLANA_MINT SOLANA_SCOPE; do
  [[ -n "${!k:-}" ]] || { echo "A4_SOURCE_PROPERTY_MISSING:$k" >&2; exit 3; }
done
"$EXE" preflight > "$OUT/ham-signed-readonly.log" 2>&1 || {
  echo 'A4_EXTERNAL_LAIR_SIGNED_PREFLIGHT_FAILED' >&2; exit 3;
}
grep -Fx 'DEMO_HAM_PREFLIGHT_OK (signed demo agent; no Unyt call)' "$OUT/ham-signed-readonly.log" >/dev/null || {
  echo 'A4_READONLY_ABI_RESPONSE_MISMATCH' >&2; exit 3;
}
negative() {
  local label="$1" error="$2"; shift 2
  local output='' code=0
  output="$(env "$@" "$EXE" preflight 2>&1)" || code=$?
  [[ "$code" != 0 && "$output" == *"$error"* ]] || { echo "A4_NEGATIVE_FAILED:$label" >&2; exit 3; }
  printf '%s\\n' "NEGATIVE_PASS:$label:$error" >> "$OUT/refusal-classes.log"
}
negative published_app PUBLISHED_UNYT_APP_REFUSED DEMO_APP_ID='UNYT-published-not-ours'
negative wrong_agent DEMO_DNA_OR_SIGNER_MISMATCH DEMO_EXPECTED_AGENT='uhCAkWrongAgent'
negative wrong_dna DEMO_DNA_OR_SIGNER_MISMATCH DEMO_EXPECTED_DNA_HASH='uhC0kWrongDNA'
negative missing_lair LAIR_REQUIRED_OR_INVALID DEMO_LAIR_PASSPHRASE_FILE='/not-present-a4-lair'
negative missing_conductor LAIR_REQUIRED_OR_INVALID DEMO_CONDUCTOR_CONFIG='/not-present-a4-config'
python3 - "$OUT/runtime-identity.json" "$APP" "$EXPECTED_DNA" "$AGENT" <<'PY'
import json,sys
filename,app,dna,agent=sys.argv[1:]
identity={'installedAppId':app,'role':'audit','dnaHash':dna,'cellId':[dna,agent],
          'agentPubKey':agent,'signer':'LairCredentials::Node external, CapGrantOptIn::Withheld',
          'readOnlyFunction':'solana_audit/get_contract',
          'creditEligible':False,'independentConsensusVerified':False,
          'spendableBaseUnits':'0','withdrawalAuthorized':False,
          'noMutationAttempted':True,'source':'archived SOL-55; not same-run source'}
with open(filename,'w') as f:json.dump(identity,f,sort_keys=True,indent=2)
PY
printf '%s\\n' 'A4_EXTERNAL_LAIR_READONLY_PASS no mutating zome, grant or economics'
