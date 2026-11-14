#!/usr/bin/env bash
# Install actual registry dependencies; a missing committed lockfile is reported, never concealed.
set -euo pipefail
cd "$(dirname "$0")/../.."
dir="${1:?usage: bash scripts/ci/install-node-deps.sh <relative-package-dir>}"
test -f "$dir/package.json" || { echo "PACKAGE_MANIFEST_MISSING: $dir/package.json" >&2; exit 1; }
mkdir -p ci-artifacts
if node -e 'const p=require("./"+process.argv[1]+"/package.json"); process.exit(Object.keys(p.dependencies||{}).length + Object.keys(p.devDependencies||{}).length > 0 ? 0 : 1)' "$dir"; then
  if [ -f "$dir/package-lock.json" ]; then
    echo "USING_COMMITTED_LOCK: $dir"
  else
    echo "UNLOCKED_DEPENDENCIES: $dir has no committed package-lock.json; resolving now for test evidence; cannot claim reproducible installation across runs." | tee "ci-artifacts/${dir//\//-}-lock-status.log"
    npm --prefix "$dir" install --package-lock-only --ignore-scripts --no-audit --no-fund
  fi
  npm --prefix "$dir" ci --ignore-scripts --no-audit --no-fund
  # Do not accept a changed registry resolution just because npm ci passed.
  case "$dir" in
    observer) bash scripts/ci/check-lock-digest.sh observer "$dir/package-lock.json" ;;
    tests/solana) bash scripts/ci/check-lock-digest.sh solana "$dir/package-lock.json" ;;
  esac
  sha256sum "$dir/package-lock.json" | tee "ci-artifacts/${dir//\//-}-package-lock.sha256"
  cp "$dir/package-lock.json" "ci-artifacts/${dir//\//-}-package-lock.json"
else
  echo "NO_EXTERNAL_NODE_DEPENDENCIES: $dir"
fi
