#!/usr/bin/env bash
# Non-economic, actual Holochain 0.7.1 conductor installation/restart probe.
# Does not invoke ANY Unyt coordinator zome (function permissions unknown).
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Usage: probe-verified-unyt-conductor.sh <verified-release-dir> <evidence-dir>' >&2
  exit 2
fi
VERIFIED="$(cd "$1" && pwd)"
mkdir -p "$2/logs" "$2/sandboxes"
OUT="$(cd "$2" && pwd)"
for cmd in hc holochain sha256sum timeout grep sed sleep; do
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
cd "$OUT"
printf '%s' "$PASSPHRASE" | timeout --signal=INT 300s hc sandbox --piped generate \
  --app-id unyt-v0117-audit \
  --in-process-lair \
  --root "$OUT/sandboxes" --directories agent-a \
  "$VERIFIED/unyt.happ" > "$OUT/logs/install.log" 2>&1 || {
    echo 'BLOCKED_UNYT_CONDUCTOR: real hApp sandbox installation failed; see install.log' >&2
    exit 2
  }
if [[ ! -s "$OUT/.hc" ]]; then
  echo 'BLOCKED_UNYT_CONDUCTOR: no sandbox path registry after install' >&2
  exit 2
fi
hc sandbox list --verbose > "$OUT/logs/installed-sandbox.log" 2>&1

# Generate starts a real conductor and installs the public hApp; this explicitly
# restarts that SAME on-disk conductor to probe persistent app/cell state.
RUN_PID=''
cleanup() {
  if [[ -n "$RUN_PID" ]]; then
    kill -INT "$RUN_PID" 2>/dev/null || true
    wait "$RUN_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
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
if ! grep -Fq 'unyt-v0117-audit' "$OUT/logs/installed-apps-after-restart.log"; then
  echo 'BLOCKED_UNYT_CONDUCTOR: app missing from post-restart admin list' >&2
  exit 2
fi
if ! hc client call --port "$PORT" list-cells > "$OUT/logs/cells-after-restart.log" 2>&1; then
  echo 'BLOCKED_UNYT_CONDUCTOR: post-restart read-only list-cells failed' >&2
  exit 2
fi
printf '%s\n' 'CONDUCTOR_INSTALL_RESTART_PASS: signed v0.117.0 public release in disposable Holochain 0.7.1 sandbox; admin list-apps/list-cells succeeded; no zome calls or economic validation' \
  | tee "$OUT/logs/conductor-result.log"
