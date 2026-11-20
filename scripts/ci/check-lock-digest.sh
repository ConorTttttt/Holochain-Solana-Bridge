#!/usr/bin/env bash
# Fail-closed SHA-256 approval for actual resolved dependency graphs.
# Approved graph digests originated from genuine 2026-11-13 Actions artifacts.
# RAVE's current source-owned graph additionally names serde and zfuel as
# direct harness dependencies; both were already transitively locked.
# The revised digest was recomputed from RAVE source b846c5cf, and checked
# against the previous source lock; locked execution at that SHA is pending.
# This checks resolution drift, NOT byte-identical SBPF reproducibility.
set -euo pipefail
cd "$(dirname "$0")/../.."
kind="${1:?usage: check-lock-digest.sh workspace|observer|solana|rave <lock-file>}"
path="${2:?supply path to actual lockfile}"
case "$kind" in
  workspace) expected=9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5 ;;
  observer) expected=87578ffa1a3f0d1f0102f58ac649e25cd2a9d2902889bc946213fb2f136f0f62 ;;
  solana) expected=24ad69597db242528c87a98d8bc2299574e09eb52e77e026281db01e1c9889c6 ;;
  rave) expected=8f9ee713af6e6f05fbc84c04fb72ccf8fdbe35eb031e98c1eaa82ce2ab3eab8c ;;
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
