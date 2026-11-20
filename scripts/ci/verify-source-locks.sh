#!/usr/bin/env bash
# Fail closed on missing/untracked/unapproved source dependency locks.
# Keep this separate from executable tests to preserve failure evidence.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p ci-artifacts
status=0
while IFS='|' read -r manifest lock kind; do
  if [ ! -f "$manifest" ]; then
    echo "NOT_APPLICABLE: $manifest absent on this specialist branch"
    continue
  fi
  # A Node package with no dependencies does not require a registry lock:
  # fail closed on malformed manifests, but do not invent source locks.
  if [ "$kind" = observer ] || [ "$kind" = solana ]; then
    if python3 - "$manifest" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as file:
    pkg = json.load(file)
sys.exit(0 if not pkg.get('dependencies') and not pkg.get('devDependencies') else 1)
PY
    then
      echo "NOT_APPLICABLE: $manifest has no external npm dependencies" | tee -a ci-artifacts/reviewed-locks.log
      continue
    fi
  fi
  if [ ! -s "$lock" ]; then
    echo "REQUIRED_COMMITTED_LOCK_MISSING: $lock for $manifest" | tee -a ci-artifacts/reviewed-locks.log
    status=1
    continue
  fi
  if ! git ls-files --error-unmatch -- "$lock" >/dev/null 2>&1; then
    echo "LOCK_NOT_GIT_TRACKED: $lock (runner-generated artifact is not reproducible input)" | tee -a ci-artifacts/reviewed-locks.log
    status=1
    continue
  fi
  if ! bash scripts/ci/check-lock-digest.sh "$kind" "$lock"; then
    echo "LOCK_REVIEW_REQUIRED: $lock differs from approved dependency graph" | tee -a ci-artifacts/reviewed-locks.log
    status=1
    continue
  fi
  sha256sum "$lock" | tee -a ci-artifacts/reviewed-locks.log
done <<'LOCK_MANIFESTS'
Cargo.toml|Cargo.lock|workspace
observer/package.json|observer/package-lock.json|observer
tests/solana/package.json|tests/solana/package-lock.json|solana
tests/holochain/rave-engine/Cargo.toml|tests/holochain/rave-engine/Cargo.lock|rave
LOCK_MANIFESTS
if [ "$status" -ne 0 ]; then
  echo "DEPENDENCY_PROVENANCE_BLOCKED: source owners must review and commit lockfiles" | tee -a ci-artifacts/reviewed-locks.log
  exit 1
fi
echo "PASS: every applicable dependency lock is Git-tracked and matches reviewed graph" | tee -a ci-artifacts/reviewed-locks.log
