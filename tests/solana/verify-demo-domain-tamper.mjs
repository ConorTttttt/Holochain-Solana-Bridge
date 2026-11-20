// Mutate a disposable COPY only; original CI witnesses and failed runs
// are retained. Every attack must produce a nonzero exit from the verifier.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const original = 'target/localnet-evidence';
function check(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'sol-demo-domain-tamper-'));
  try {
    cpSync(original, dir, { recursive: true });
    const path = join(dir, 'demo-source-domain.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    mutate({ manifest, dir });
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
    return spawnSync(process.execPath, ['tests/solana/verify-demo-domain.mjs'], {
      encoding: 'utf8', env: { ...process.env, DEMO_WITNESS_DIR: dir },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const good = check(() => {});
assert.equal(good.status, 0, 'original genuine demo domain must pass:\n' + good.stderr);

const attacks = {
  'substituted known placeholder scope': ({ manifest }) => {
    manifest.scopeHex = '07'.repeat(32);
  },
  'changed initialized scope': ({ manifest }) => {
    manifest.initializedScopeHex = '2a'.repeat(32);
  },
  'changed genesis identity': ({ manifest }) => {
    manifest.genesisHash += '1';
  },
  'substituted original initialization signature': ({ manifest }) => {
    manifest.transactions.initialize.signature = manifest.transactions.refund.signature;
  },
  'missing original signed initialization pointer': ({ manifest }) => {
    delete manifest.transactions.initialize.getTransactionBase64RawFile;
  },
  'escalated spendable balance': ({ manifest }) => {
    manifest.spendableBaseUnits = '1';
  },
  'escalated independent consensus': ({ manifest }) => {
    manifest.independentConsensusVerified = true;
  },
  'substituted active receipt bytes': ({ manifest, dir }) => {
    const path = join(dir, manifest.snapshots.active);
    const snapshot = JSON.parse(readFileSync(path, 'utf8'));
    snapshot.accounts[0].dataBase64 =
      Buffer.from('untrusted-substitute').toString('base64');
    writeFileSync(path, JSON.stringify(snapshot));
  },
};
for (const [name, mutate] of Object.entries(attacks)) {
  const result = check(mutate);
  assert.notEqual(result.status, 0, name + ': verifier incorrectly accepted tamper');
  assert.match(result.stderr, /AssertionError|Error:|ERR_ASSERTION/,
    name + ': expected a hard refusal, got ' + result.stderr);
  console.log('DEMO_DOMAIN_TAMPER_REJECTED ' + name);
}
console.log('DEMO_DOMAIN_NEGATIVES ' + Object.keys(attacks).length +
  ' adversarial tests plus original unchanged positive control PASS (localnet-only)');
