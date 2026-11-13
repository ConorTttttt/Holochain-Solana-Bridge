#!/usr/bin/env bash
# Prepare a disposable LOCALNET-ONLY program keypair in an ephemeral CI checkout.
# This modifies only the working copy's placeholder program ID; never commit keys or modified program files.
set -euo pipefail
cd "$(dirname "$0")/../.."
for cmd in solana-keygen anchor git node; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "REQUIRED_TOOL_MISSING: $cmd" >&2; exit 1; }
done
test -f Anchor.toml
test -f programs/deposit_prototype/src/lib.rs
if [ -e target/deploy/deposit_prototype-keypair.json ]; then
  echo "REFUSE_KEYPAIR_REUSE: expected clean CI checkout" >&2
  exit 1
fi
umask 077
mkdir -p target/deploy ci-artifacts
chmod 700 target/deploy
solana-keygen new --no-bip39-passphrase --silent -o target/deploy/deposit_prototype-keypair.json >/dev/null 2>&1
public_id="$(solana-keygen pubkey target/deploy/deposit_prototype-keypair.json)"
if [ "$public_id" = 'Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS' ]; then
  echo "LOCAL_PROGRAM_ID_STILL_PLACEHOLDER" >&2
  exit 1
fi
# The key material stays under ignored target/deploy and must never be uploaded.
anchor keys sync
node --input-type=module - "$public_id" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const publicId=process.argv[2];
assert.match(publicId,/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const source=readFileSync('programs/deposit_prototype/src/lib.rs','utf8');
const toml=readFileSync('Anchor.toml','utf8');
assert.ok(source.includes('declare_id!("' + publicId + '")'), 'source key not synchronized');
assert.ok(toml.includes('deposit_prototype = "' + publicId + '"'), 'Anchor.toml key not synchronized');
console.log('PASS: ephemeral localnet public program ID agrees with source and Anchor config');
NODE
printf '%s\n' "$public_id" > ci-artifacts/localnet-program-id.txt
# Ensure CI's ID sync does not mutate the economic source outside the program-ID lines.
python3 - <<'PY'
import re, subprocess, sys
paths = subprocess.check_output(['git','diff','--name-only'], text=True).splitlines()
allowed = {'Anchor.toml','programs/deposit_prototype/src/lib.rs'}
if set(paths) - allowed:
    sys.exit('Unexpected tracked file modified by key sync: ' + ', '.join(set(paths)-allowed))
for path in paths:
    current=open(path).read()
    original=subprocess.check_output(['git','show',f'HEAD:{path}'], text=True)
    if path=='Anchor.toml':
        regex=r'(deposit_prototype\s*=\s*")[1-9A-HJ-NP-Za-km-z]{32,44}(")'
    else:
        regex=r'(declare_id!\(")[1-9A-HJ-NP-Za-km-z]{32,44}("\))'
    masked=lambda s: re.sub(regex, r'\1<PROGRAM_ID>\2', s)
    if masked(current)!=masked(original):
        sys.exit('Key sync changed non-ID program source/config: '+path)
print('PASS: temporary source changes limited to synchronized public program ID')
PY
rm -f target/idl/deposit_prototype.json target/deploy/deposit_prototype.so
echo "LOCALNET_KEY_PREPARED: private key remains under ignored target/deploy (never uploaded)."
