#!/usr/bin/env bash
# Non-economic, actual Holochain 0.7.1 conductor installation/restart probe.
# Does not invoke ANY Unyt coordinator zome (function permissions unknown).
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Usage: probe-verified-unyt-conductor.sh <verified-release-dir> <evidence-dir>' >&2
  exit 2
fi
VERIFIED="$(cd "$1" && pwd)"
mkdir -p "$2/logs"
OUT="$(cd "$2" && pwd)"
# Keep Lair Unix socket under SUN_LEN (108 bytes on Linux). CI workspace paths
# are too long: /home/runner/work/.../ci-artifacts/.../sandboxes/agent-a/ks.
# A private temporary root is removed at exit and is never uploaded.
ROOT="$(mktemp -d /tmp/unyt-XXXXXX)"
RUN_PID=''
cleanup() {
  if [[ -n "$RUN_PID" ]]; then
    kill -INT "$RUN_PID" 2>/dev/null || true
    wait "$RUN_PID" 2>/dev/null || true
  fi
  # Holochain prints a disposable keystore socket authentication token in
  # startup logs. Never include it in the retained public CI artifacts.
  for log in "$OUT/logs/install.log" "$OUT/logs/restart.log"; do
    if [[ -f "$log" ]]; then
      sed -Ei 's@(socket\?k=)[A-Za-z0-9_-]+@\1[REDACTED]@g' "$log"
    fi
  done
  if [[ -d "$ROOT" ]]; then
    rm -rf -- "$ROOT"
  fi
}
trap cleanup EXIT
for cmd in hc holochain sha256sum timeout grep sed sleep jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "BLOCKED_UNYT_CONDUCTOR: missing $cmd" >&2
    exit 2
  fi
done
if ! printf '%s  %s\n' \
    '0bdfd417639c55c5ee2cf71e3f35312833b6378c3aee88158645a876931877f1' \
    "$VERIFIED/unyt.happ" | sha256sum --check --status; then
  echo 'BLOCKED_UNYT_CONDUCTOR: public v0.117.0 hApp SHA-256 mismatch' >&2
  exit 2
fi

# Generated keystores and conductor databases remain disposable. The CI artifact
# publishes only logs, never conductor DBs or keystores. This known passphrase
# is intentionally suitable ONLY for an isolated throwaway test account.
PASSPHRASE='throwaway-ci-unyt-0.117.0-no-value'
cd "$ROOT"
printf '%s' "$PASSPHRASE" | timeout --signal=INT 300s hc sandbox --piped generate \
  --app-id unyt-v0117-audit \
  --in-process-lair \
  --root "$ROOT" --directories agent-a \
  "$VERIFIED/unyt.happ" > "$OUT/logs/install.log" 2>&1 || {
    echo 'BLOCKED_UNYT_CONDUCTOR: real hApp sandbox installation failed; see install.log' >&2
    exit 2
  }
if [[ ! -s "$ROOT/.hc" ]]; then
  echo 'BLOCKED_UNYT_CONDUCTOR: no sandbox path registry after install' >&2
  exit 2
fi
hc sandbox list --verbose > "$OUT/logs/installed-sandbox.log" 2>&1

# Generate starts a real conductor and installs the public hApp; this explicitly
# restarts that SAME on-disk conductor to probe persistent app/cell state.
printf '%s' "$PASSPHRASE" | timeout --signal=INT 180s hc sandbox --piped run \
  > "$OUT/logs/restart.log" 2>&1 &
RUN_PID=$!
PORT=''
for _ in $(seq 1 75); do
  if ! kill -0 "$RUN_PID" 2>/dev/null; then
    echo 'BLOCKED_UNYT_CONDUCTOR: restarted conductor terminated unexpectedly' >&2
    exit 2
  fi
  PORT="$(hc sandbox admin-ports 2>/dev/null | sed -nE 's/^[[:space:]]*\[[[:space:]]*([0-9]+)[[:space:]]*\][[:space:]]*$/\1/p' || true)"
  if [[ -n "$PORT" ]] && hc client call --port "$PORT" list-apps \
       > "$OUT/logs/installed-apps-after-restart.log" 2>&1; then
    break
  fi
  sleep 2
done
if [[ -z "$PORT" ]] || [[ ! -s "$OUT/logs/installed-apps-after-restart.log" ]]; then
  echo 'BLOCKED_UNYT_CONDUCTOR: no successful read-only admin list-apps after restart' >&2
  exit 2
fi
# Assert exact installed identity and enabled state rather than just matching text.
# The expected DNA hash is the Holochain 0.7.1 hash of the exact public
# alliance.dna present in the independently verified v0.117.0 release.
EXPECTED_DNA='uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ'
APP_INFO="$OUT/logs/installed-apps-after-restart.log"
APP_AGENT="$(jq -er --arg dna "$EXPECTED_DNA" '
  .[] |
  select(.installed_app_id == "unyt-v0117-audit" and
         .status.type == "enabled" and
         (.cell_info.alliance | length) == 1 and
         .cell_info.alliance[0].type == "provisioned" and
         .cell_info.alliance[0].value.cell_id.dna_hash == $dna and
         .cell_info.alliance[0].value.cell_id.agent_pub_key == .agent_pub_key) |
  .agent_pub_key
' "$APP_INFO")" || {
  echo 'BLOCKED_UNYT_CONDUCTOR: missing/mismatched enabled app, role or DNA identity' >&2
  exit 2
}
if ! hc client call --port "$PORT" list-cells > "$OUT/logs/cells-after-restart.log" 2>&1; then
  echo 'BLOCKED_UNYT_CONDUCTOR: post-restart read-only list-cells failed' >&2
  exit 2
fi
if ! jq -e --arg dna "$EXPECTED_DNA" --arg agent "$APP_AGENT" '
  any(.[]; .dna_hash == $dna and .agent_pub_key == $agent)
' "$OUT/logs/cells-after-restart.log" >/dev/null; then
  echo 'BLOCKED_UNYT_CONDUCTOR: installed cell identity not preserved after restart' >&2
  exit 2
fi
printf '%s\n' 'CONDUCTOR_INSTALL_RESTART_PASS: signed v0.117.0 public release in disposable Holochain 0.7.1 sandbox; admin list-apps/list-cells succeeded; no zome calls or economic validation' \
  | tee "$OUT/logs/conductor-result.log"
