#!/usr/bin/env bash
# Actual retained-ledger crash/restart evidence, NOT a reset disguised as recovery.
# Requires compiled Anchor ELF/IDL and disposable keypair from localnet-build.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
export SOLANA_URL=http://127.0.0.1:8899
export ANCHOR_WALLET="${ANCHOR_WALLET:-$PWD/target/localnet-secrets/id.json}"
ledger="$PWD/target/restart-ledger"
evidence="$PWD/target/localnet-evidence"
validator_pid=""

command -v solana >/dev/null
command -v solana-keygen >/dev/null
command -v solana-test-validator >/dev/null
command -v anchor >/dev/null
command -v node >/dev/null
test -s target/deploy/deposit_prototype.so
test -s target/idl/deposit_prototype.json
test -s target/deploy/deposit_prototype-keypair.json
test -s "$ANCHOR_WALLET"
test ! -e "$ledger" || { echo "Restart ledger already exists; refusing to reuse" >&2; exit 1; }
if (echo >/dev/tcp/127.0.0.1/8899) >/dev/null 2>&1; then
  echo "Port 8899 already occupied; do not target an unrelated validator" >&2
  exit 1
fi
umask 077
mkdir -p "$evidence"

stop_validator() {
  if [ -n "$validator_pid" ]; then
    kill "$validator_pid" >/dev/null 2>&1 || true
    wait "$validator_pid" >/dev/null 2>&1 || true
    validator_pid=""
  fi
}
trap stop_validator EXIT
start_validator() {
  local phase="$1"
  shift
  solana-test-validator --ledger "$ledger" --rpc-port 8899 "$@" \
    >"$evidence/restart-validator-$phase.log" 2>&1 &
  validator_pid=$!
  for _ in $(seq 1 90); do
    if ! kill -0 "$validator_pid" >/dev/null 2>&1; then
      echo "Restart validator $phase exited; see archived local log" >&2
      exit 1
    fi
    if solana --url "$SOLANA_URL" cluster-version >/dev/null 2>&1; then
      echo "Validator $phase RPC is ready"
      return 0
    fi
    sleep 1
  done
  echo "Validator $phase never became available" >&2
  exit 1
}

# Phase 1: fresh ledger, real deploy, live refundable receipt and positive vault.
start_validator before --reset
public_wallet="$(solana-keygen pubkey "$ANCHOR_WALLET")"
solana --url "$SOLANA_URL" airdrop 10 "$public_wallet" >/dev/null
NO_DNA=1 anchor deploy --provider.cluster localnet --provider.wallet "$ANCHOR_WALLET"
BRIDGE_RESTART_PHASE=setup node --test tests/solana/restart-reconcile.test.mjs
test -s "$evidence/restart-state.json"
stop_validator

# Phase 2: start a NEW validator process using SAME ledger and NO --reset.
# The test requires matching genesis, byte-for-byte persisted data and full
# program account enumeration; state loss is a hard failure.
start_validator after
BRIDGE_RESTART_PHASE=verify node --test tests/solana/restart-reconcile.test.mjs
test -s "$evidence/restart-after.json"
stop_validator
echo "REAL RETAINED-LEDGER VALIDATOR RESTART + LIABILITY RECONSTRUCTION PASSED"
