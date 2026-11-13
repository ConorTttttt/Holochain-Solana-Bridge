#!/usr/bin/env bash
# Fail-closed SHA-256 approval for actual resolved dependency graphs.
# These digests were taken from genuine 2026-11-13 Actions artifacts, not guessed.
# This detects resolution drift. Until agent-owned locks are committed it is
# NOT an offline/byte-for-byte reproducible install.
set -euo pipefail
cd "$(dirname "$0")/../.."
kind="${1:?usage: check-lock-digest.sh workspace|observer|solana|rave <lock-file>}"
path="${2:?supply path to actual lockfile}"
case "$kind" in
  workspace) expected=9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5 ;;
  observer) expected=87578ffa1a3f0d1f0102f58ac649e25cd2a9d2902889bc946213fb2f136f0f62 ;;
  solana) expected=24ad69597db242528c87a98d8bc2299574e09eb52e77e026281db01e1c9889c6 ;;
  rave) expected=e4f82e37be720566dcea35a59e3681777444cbe6584ad1c7b8730c2367f0f001 ;;
  *) echo "UNRECOGNIZED_DEPENDENCY_LOCK: $kind" >&2; exit 1 ;;
esac
test -s "$path" || { echo "REQUIRED_LOCK_MISSING: $path" >&2; exit 1; }
actual="$(sha256sum "$path" | awk '{print $1}')"
mkdir -p ci-artifacts
printf '%s %s expected=%s actual=%s\n' "$kind" "$path" "$expected" "$actual" | tee "ci-artifacts/lock-integrity-${kind}.log"
if [ "$actual" != "$expected" ]; then
  echo "DEPENDENCY_GRAPH_DRIFT: $kind lock digest differs from reviewed CI artifact. Resolve/approve a new lock explicitly; do not silently upgrade." >&2
  exit 1
fi
echo "PASS: approved $kind dependency graph"
