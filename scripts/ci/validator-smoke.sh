#!/usr/bin/env bash
# Ephemeral localnet RPC smoke; no program deployment, token transfer or key uploads.
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/ci/toolchain.env
for cmd in solana solana-test-validator node; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "REQUIRED_TOOL_MISSING: $cmd" >&2; exit 1; }
done
actual="$(solana --version | awk '{print $2}')"
[ "$actual" = "$SOLANA_VERSION" ] || { echo "TOOLCHAIN_MISMATCH: Solana $actual" >&2; exit 1; }
mkdir -p ci-artifacts
ledger="$(mktemp -d -t bridge-ci-ledger.XXXXXXXX)"
cleanup() {
  if [ -n "${pid:-}" ]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf -- "$ledger"
}
trap cleanup EXIT
solana-test-validator --reset --ledger "$ledger" --rpc-port 8899 --bind-address 127.0.0.1 >ci-artifacts/validator-process.log 2>&1 &
pid=$!
healthy=0
for i in $(seq 1 60); do
  kill -0 "$pid" 2>/dev/null || { echo "VALIDATOR_EXITED_EARLY" >&2; exit 1; }
  if node --input-type=module -e '
    const r=await fetch("http://127.0.0.1:8899",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getHealth"}),
      signal:AbortSignal.timeout(1500)
    });
    const json=await r.json();
    if (!r.ok || json.result!=="ok") process.exit(1);
  ' >/dev/null 2>&1; then
    healthy=1; break
  fi
  sleep 2
done
[ "$healthy" -eq 1 ] || { echo "VALIDATOR_HEALTH_TIMEOUT" >&2; exit 1; }
echo "POSITIVE: disposable localnet reports healthy RPC."
solana --url http://127.0.0.1:8899 genesis-hash
solana --url http://127.0.0.1:8899 block-height
node --input-type=module -e '
  const r=await fetch("http://127.0.0.1:8899", {
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:2,method:"__bridge_ci_invalid_method__"})
  });
  const json=await r.json();
  if (!json.error || json.result) process.exit(1);
  console.log("NEGATIVE: unknown RPC method rejected.");
'
echo "SMOKE_ONLY: no on-chain initialize/deposit/refund lifecycle tests."
