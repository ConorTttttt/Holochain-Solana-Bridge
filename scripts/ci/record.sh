#!/usr/bin/env bash
# Preserve failure status through tee; no secret values in output.
set -euo pipefail
if [ "$#" -lt 2 ] || [[ ! "$1" =~ ^[a-z0-9_-]+$ ]]; then
  echo "usage: bash scripts/ci/record.sh <safe-name> <command> [args...]" >&2
  exit 2
fi
name="$1"; shift
mkdir -p ci-artifacts
"$@" 2>&1 | tee "ci-artifacts/${name}.log"
