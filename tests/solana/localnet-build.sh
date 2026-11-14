#!/usr/bin/env bash
# Strict localhost-only Anchor build + deploy + validator lifecycle.
# Run only in a disposable and network-isolated CI / local environment.
set -euo pipefail
cd "$(dirname "$0")/../.."

command -v rustc >/dev/null
command -v cargo >/dev/null
command -v anchor >/dev/null
command -v solana >/dev/null
command -v solana-keygen >/dev/null
command -v solana-test-validator >/dev/null
command -v node >/dev/null
command -v npm >/dev/null

# No public RPC override allowed. Keep all private material out of Git,
# logs and any artifact upload. Never print private-key contents.
umask 077
mkdir -p target/deploy target/localnet-secrets target/localnet-evidence
chmod 700 target/localnet-secrets
export ANCHOR_WALLET="$PWD/target/localnet-secrets/id.json"
export SOLANA_URL="http://127.0.0.1:8899"

if [ -e target/deploy/deposit_prototype-keypair.json ] ||
   [ -e "$ANCHOR_WALLET" ]; then
  echo "Refusing to reuse existing local keypair material. Use fresh isolated checkout." >&2
  exit 1
fi
solana-keygen new --no-bip39-passphrase --silent \
  -o target/deploy/deposit_prototype-keypair.json >/dev/null 2>&1
solana-keygen new --no-bip39-passphrase --silent -o "$ANCHOR_WALLET" >/dev/null 2>&1
solana config set --url localhost --keypair "$ANCHOR_WALLET" >/dev/null 2>&1

# The immutable Git SHA denotes the initial checkout. Anchor keys sync changes
# tracked public ID sources: preserve the full diff and hash EVERY tracked file
# before and after, so the actually compiled input tree is auditable.
test -z "$(git status --porcelain --untracked-files=no)" || {
  echo "Refusing dirty tracked checkout before anchor keys sync" >&2; exit 1;
}
git ls-files -z | xargs -0 sha256sum > target/localnet-evidence/tracked-pre-sync.sha256
anchor keys sync
git diff --binary > target/localnet-evidence/anchor-keys-sync.patch
git diff --name-only > target/localnet-evidence/anchor-keys-sync-tracked-changes.txt
git diff --check
git ls-files -z | xargs -0 sha256sum > target/localnet-evidence/tracked-post-sync.sha256
sha256sum Cargo.lock Cargo.toml Anchor.toml programs/deposit_prototype/Cargo.toml \
  programs/deposit_prototype/src/lib.rs > target/localnet-evidence/build-inputs.sha256
sha256sum Cargo.lock > target/localnet-evidence/cargo-lock.sha256

program_id="$(solana-keygen pubkey target/deploy/deposit_prototype-keypair.json)"
test "$program_id" != "Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS"
echo "Localnet public program ID: $program_id"
echo "Host versions (SBPF toolchain version is selected separately):"
rustc -V
cargo -V
solana --version
anchor --version
node --version
npm --version

# Do not accept IDL from a previous build.
rm -f target/idl/deposit_prototype.json target/deploy/deposit_prototype.so
NO_DNA=1 anchor build --tools-version v1.57 --arch v3
# Anchor invokes nested Cargo/SBPF tooling. Enforce unchanged resolved lock
# and tracked source content even when the nested CLI lacks --locked.
sha256sum --check target/localnet-evidence/cargo-lock.sha256
sha256sum --check target/localnet-evidence/tracked-post-sync.sha256 > /dev/null
test -z "$(git diff --name-only -- Cargo.lock)" || {
  echo "Anchor modified the reviewed Cargo.lock" >&2; exit 1;
}
test -s target/idl/deposit_prototype.json
test -s target/deploy/deposit_prototype.so

# The IDL address, source declaration and local program keypair must agree.
node --input-type=module - "$program_id" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const expected = process.argv[2];
const idl = JSON.parse(readFileSync('target/idl/deposit_prototype.json', 'utf8'));
const source = readFileSync('programs/deposit_prototype/src/lib.rs', 'utf8');
const toml = readFileSync('Anchor.toml', 'utf8');
assert.equal(idl.address, expected, 'IDL address does not match local program keypair');
assert.ok(source.includes('declare_id!("' + expected + '")'), 'Rust ID mismatch');
assert.ok(toml.includes('deposit_prototype = "' + expected + '"'), 'Anchor TOML ID mismatch');
console.log('PASS: IDL, Rust source, Anchor.toml and localnet public program ID match');
NODE
sha256sum target/idl/deposit_prototype.json target/deploy/deposit_prototype.so \
  | tee target/localnet-evidence/artifact-sha256.txt
printf '%s\n' "$program_id" > target/localnet-evidence/program-id.txt

# Both test commands are required. npm dependency resolution must succeed,
# not silently skip. The on-chain suite refuses the public placeholder ID.
npm --prefix tests/solana ci --no-audit --no-fund
npm --prefix tests/solana test
# Each mode requires an EMPTY validator ledger, because config PDA is
# singleton: the first-initializer attack and full-u64 mint cannot run after
# normal initialization. Anchor legacy test starts/resets its own validator.
# The tests explicitly fail if config unexpectedly persists between runs.
for scenario in lifecycle init-capture u64-max; do
  echo "Executing isolated validator scenario: $scenario"
  BRIDGE_TEST_MODE="$scenario" NO_DNA=1 anchor test --skip-build --validator legacy \
    --provider.cluster localnet --provider.wallet "$ANCHOR_WALLET"
  # An all-skipped suite or missing RPC witness is NOT an on-chain PASS.
  node tests/solana/verify-witness-bundle.mjs "$scenario"
  # The verifier must also REJECT tampered/incomplete copies of this archive.
  node tests/solana/verify-witness-tamper.mjs "$scenario"
done
# Separate two-process retained-ledger restart: it deploys the same compiled
# ELF into a brand new disposable ledger, leaves a positive liability, kills
# the validator, restarts WITHOUT --reset and reconstructs live receipts.
bash tests/solana/restart-validator.sh
echo "LOCALNET BUILD, THREE TRANSACTION SCENARIOS AND RETAINED-LEDGER RESTART PASSED"
