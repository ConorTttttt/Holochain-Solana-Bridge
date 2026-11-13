// Fail-closed verification of public-only finalized RPC witness archives.
// Run after each actual local-validator scenario. This is NOT a transaction test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2];
assert.ok(['lifecycle', 'init-capture', 'u64-max'].includes(mode), 'unknown witness mode');
const dir = 'target/localnet-evidence';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const idl = readJson('target/idl/deposit_prototype.json');
const expected = {
  sourceCommitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  idlSha256: digest('target/idl/deposit_prototype.json'),
  elfSha256: digest('target/deploy/deposit_prototype.so'),
  programId: idl.address,
};
const checkBinding = (object, label) => {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(object[key], value, label + ': incorrect ' + key);
  }
  assert.match(object.genesisHash, /^[1-9A-HJ-NP-Za-km-z]+$/,
    label + ': missing/invalid genesis identity');
};
const openRpc = (name) => {
  assert.match(name, /^[A-Za-z0-9-]+\.rpc\.json$/, 'unsafe witness path');
  const response = readJson(join(dir, name));
  assert.equal(response.jsonrpc, '2.0', name + ': missing JSON-RPC version');
  assert.equal(response.error, undefined, name + ': RPC error');
  assert.ok(response.result, name + ': empty RPC result');
  return response.result;
};

const bundle = readJson(join(dir, 'sprint1-' + mode + '-transactions.json'));
assert.equal(bundle.mode, mode);
checkBinding(bundle, mode);
assert.ok(Array.isArray(bundle.finalized) && bundle.finalized.length > 0,
  mode + ': no finalized transaction witnesses');
const signatures = new Set();
let accepted = 0;
let rejected = 0;
for (const witness of bundle.finalized) {
  assert.match(witness.signature, /^[1-9A-HJ-NP-Za-km-z]+$/);
  assert.ok(!signatures.has(witness.signature), 'duplicate signature evidence');
  signatures.add(witness.signature);
  const parsed = openRpc(witness.getTransactionRawFile);
  const signed = openRpc(witness.getTransactionBase64RawFile);
  const block = openRpc(witness.getBlockRawFile);
  assert.equal(parsed.slot, witness.slot, 'parsed transaction slot mismatch');
  assert.equal(signed.slot, witness.slot, 'signed transaction slot mismatch');
  assert.equal(block.blockhash, witness.blockhash, 'containing blockhash mismatch');
  assert.deepEqual(parsed.meta?.err, witness.meta.err, 'parsed transaction error mismatch');
  assert.deepEqual(signed.meta?.err, witness.meta.err, 'signed transaction error mismatch');
  assert.equal(parsed.version, signed.version, 'parsed/base64 version mismatch');
  assert.ok(parsed.transaction.signatures.includes(witness.signature),
    'parsed transaction missing signature');
  assert.ok(Array.isArray(signed.transaction) && signed.transaction.length === 2 &&
    signed.transaction[1] === 'base64', 'missing signed base64 transaction');
  const signedBytes = Buffer.from(signed.transaction[0], 'base64');
  assert.ok(signedBytes.length > 64, 'truncated signed transaction');
  assert.equal(signedBytes.toString('base64'), signed.transaction[0],
    'noncanonical signed base64');
  assert.ok(Array.isArray(block.transactions), 'full containing block is missing');
  const included = block.transactions.find((entry) =>
    entry.transaction?.signatures?.includes(witness.signature));
  assert.ok(included, 'signed transaction absent from containing block');
  assert.deepEqual(included.meta?.err, witness.meta.err,
    'containing block execution disagrees with transaction');
  if (witness.meta.err === null) accepted += 1;
  else rejected += 1;
}
assert.ok(accepted > 0 && rejected > 0,
  mode + ': require both included successes and on-chain failures');

const fixtures = {
  lifecycle: ['active-receipt', 'refunded-receipt', 'two-active-receipts',
    'two-refunded-receipts', 'sprint1-two-wallets-live'],
  'init-capture': ['sprint1-initializer-capture'],
  'u64-max': ['sprint1-u64-refunded'],
};
for (const name of fixtures[mode]) {
  const snapshot = readJson(join(dir, name + '.json'));
  checkBinding(snapshot, name);
  assert.equal(snapshot.genesisHash, bundle.genesisHash, name + ': genesis changed');
  const rpc = openRpc(snapshot.getMultipleAccountsRawFile);
  assert.equal(rpc.context.slot, snapshot.slot, name + ': snapshot slot differs');
  assert.equal(rpc.value.length, snapshot.accounts.length, name + ': account count differs');
  rpc.value.forEach((raw, index) => {
    const entry = snapshot.accounts[index];
    assert.ok(raw && raw.data?.[1] === 'base64', name + ': non-base64 account');
    assert.equal(raw.data[0], entry.dataBase64, name + ': account bytes differ');
    assert.equal(raw.owner, entry.owner, name + ': account owner differs');
    assert.equal(raw.lamports, entry.lamports, name + ': account lamports differ');
  });
}
console.log('PASS: ' + mode + ' genesis/source/IDL/ELF-bound witnesses: ' +
  accepted + ' accepted, ' + rejected + ' included rejected, ' +
  fixtures[mode].length + ' finalized account snapshots');
