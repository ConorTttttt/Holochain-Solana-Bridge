// Fail-closed verification of public-only finalized RPC witness archives.
// Run after each actual local-validator scenario. This is NOT a transaction test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeSignedWire, assertRpcMessage, assertArchiveAttribution, fail } from './signed-message.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2];
assert.ok(['lifecycle', 'init-capture', 'u64-max', 'demo-domain'].includes(mode), 'unknown witness mode');
// WITNESS_DIR exists only so the tamper test can point at a mutated COPY.
const dir = process.env.WITNESS_DIR ?? 'target/localnet-evidence';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const idl = readJson('target/idl/deposit_prototype.json');
const expected = {
  sourceCommitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  idlSha256: digest('target/idl/deposit_prototype.json'),
  elfSha256: digest('target/deploy/deposit_prototype.so'),
  postSyncSourceSha256: digest(join(dir, 'tracked-post-sync.sha256')),
  programId: idl.address,
};
// Only the current local tracked checkout is independently checked here.
// Archived local RPC genesis/deployment data are observations, not consensus.
execFileSync('sha256sum', ['--check', join(dir, 'tracked-post-sync.sha256')],
  { stdio: 'pipe' });
const checkBinding = (object, label) => {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(object[key], value, label + ': incorrect ' + key);
  }
  assert.match(object.genesisHash, /^[1-9A-HJ-NP-Za-km-z]+$/,
    label + ': missing/invalid genesis identity');
};
const openRpc = (name, containingBlock = false) => {
  if (containingBlock && (typeof name !== 'string' || !name)) {
    fail('WITNESS_BLOCK_MISSING', 'no containing-block RPC filename');
  }
  assert.match(name, /^[A-Za-z0-9-]+\.rpc\.json$/, 'unsafe witness path');
  let response;
  try {
    response = readJson(join(dir, name));
  } catch (error) {
    if (containingBlock && error?.code === 'ENOENT') {
      fail('WITNESS_BLOCK_MISSING', name + ': original containing-block RPC file absent');
    }
    throw error; // Corrupt JSON and non-block IO errors are not missing-block claims.
  }
  if (containingBlock && (response?.result === null || response?.result === undefined)) {
    fail('WITNESS_BLOCK_MISSING', name + ': original containing-block result absent');
  }
  assert.equal(response.jsonrpc, '2.0', name + ': missing JSON-RPC version');
  assert.equal(response.error, undefined, name + ': RPC error');
  assert.ok(response.result, name + ': empty RPC result');
  return response.result;
};

// Independent wire-format decoding: no web3.js, so an SDK bug cannot hide a
// mismatch between the archived bytes and what the RPC JSON claims.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0'));
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; out = '1' + out; }
  return out;
}
function errorEmitter(logs) {
  return (logs ?? []).map(line =>
    /^Program ([1-9A-HJ-NP-Za-km-z]+) failed:/.exec(line)?.[1]).find(Boolean) ?? null;
}

const bundle = readJson(join(dir, 'sprint1-' + mode + '-transactions.json'));
assert.equal(bundle.mode, mode);
checkBinding(bundle, mode);
assert.equal(bundle.complete, true, mode + ': partial/failed witness archive is never a PASS');
assert.ok(Array.isArray(bundle.transactions), mode + ': transaction index is missing');
const recordedSignatures = new Set(bundle.transactions
  .filter((record) => typeof record.signature === 'string')
  .map((record) => record.signature));
// Every recorded claim about a signature must agree with the finalized ledger.
const recordsBySignature = new Map();
for (const record of bundle.transactions) {
  if (typeof record.signature !== 'string') continue;
  if (!recordsBySignature.has(record.signature)) recordsBySignature.set(record.signature, []);
  recordsBySignature.get(record.signature).push(record);
}
assert.ok(recordedSignatures.size > 0, mode + ': no recorded signed transactions');
assert.ok(Array.isArray(bundle.finalized) && bundle.finalized.length > 0,
  mode + ': no finalized transaction witnesses');
assert.equal(bundle.finalized.length, recordedSignatures.size,
  mode + ': finalized manifest does not cover EVERY recorded signed transaction');
const signatures = new Set();
let accepted = 0;
let rejected = 0;
for (const witness of bundle.finalized) {
  assert.match(witness.signature, /^[1-9A-HJ-NP-Za-km-z]+$/);
  assert.ok(recordedSignatures.has(witness.signature), 'unknown finalized transaction signature');
  assert.ok(!signatures.has(witness.signature), 'duplicate signature evidence');
  signatures.add(witness.signature);
  const parsed = openRpc(witness.getTransactionRawFile);
  const signed = openRpc(witness.getTransactionBase64RawFile);
  const block = openRpc(witness.getBlockRawFile, true);
  const signedBlock = openRpc(witness.getBlockBase64RawFile, true);
  assert.equal(parsed.slot, witness.slot, 'parsed transaction slot mismatch');
  assert.equal(signed.slot, witness.slot, 'signed transaction slot mismatch');
  assert.equal(block.blockhash, witness.blockhash, 'containing blockhash mismatch');
  assert.equal(signedBlock.blockhash, witness.blockhash, 'signed blockhash mismatch');
  if (!Array.isArray(signedBlock.transactions) || !Array.isArray(block.transactions)) {
    fail('WITNESS_BLOCK_MISSING', 'containing-block transaction evidence absent');
  }
  assert.equal(signedBlock.transactions.length, block.transactions.length,
    'signed and decoded blocks have different transaction counts');
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
  const decoded = decodeSignedWire(signedBytes, witness.signature);
  assert.equal(decoded.signatures[0], witness.signature,
    'archived signed bytes do not carry the witnessed transaction signature');
  const records = recordsBySignature.get(witness.signature);
  const submitted = assertArchiveAttribution(decoded, records, witness, parsed, idl);
  assert.ok(submitted.equals(signedBytes),
    'WIRE_FINALIZED_TRANSACTION: original submitted wire differs from getTransaction');
  assert.deepEqual(witness.meta.logMessages, parsed.meta?.logMessages,
    'witness logs differ from finalized getTransaction logs');
  for (const record of records) {
    if ('error' in record) {
      assert.deepEqual(record.error, witness.meta.err,
        'recorded execution result disagrees with finalized ledger: ' + record.label);
    }
    if ('emittingProgramId' in record) {
      assert.equal(record.emittingProgramId, errorEmitter(parsed.meta?.logMessages),
        'recorded failing program disagrees with finalized logs: ' + record.label);
    }
  }
  // Both containing-block formats were already checked for transaction arrays.
  const included = block.transactions.find((entry) =>
    entry.transaction?.signatures?.includes(witness.signature));
  if (!included) fail('WITNESS_BLOCK_MISSING',
    witness.signature + ': signed transaction absent from containing block');
  assertRpcMessage(decoded, parsed, included, witness.signature);
  assert.deepEqual(included.meta?.err, witness.meta.err,
    'containing block execution disagrees with transaction');
  const index = block.transactions.indexOf(included);
  const signedIncluded = signedBlock.transactions[index];
  assert.ok(Array.isArray(signedIncluded?.transaction) && signedIncluded.transaction.length === 2 &&
    signedIncluded.transaction[1] === 'base64', 'matching signed block entry missing');
  assert.equal(signedIncluded.transaction[0], signed.transaction[0],
    'getBlock transaction bytes disagree with signed getTransaction bytes');
  assert.ok(submitted.equals(Buffer.from(signedIncluded.transaction[0], 'base64')),
    'WIRE_FINALIZED_BLOCK: original submitted wire differs from getBlock');
  assert.deepEqual(signedIncluded.meta?.err, witness.meta.err,
    'signed block execution disagrees with transaction');
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
  for (const [role, signature] of Object.entries(snapshot.signatures ?? {})) {
    assert.ok(signatures.has(signature),
      name + ': snapshot cites ' + role + ' signature without a finalized witness');
  }
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
// Deployment identity: the program the validator executed must be the exact
// hashed ELF, not merely a program at the expected address.
const deployments = bundle.transactions.filter((record) =>
  record.label === 'observed-deployment-upgrade-authority-not-governed');
assert.equal(deployments.length, 1, mode + ': exactly one deployment observation required');
const deploymentRecord = deployments[0];
const deployment = openRpc(deploymentRecord.deploymentRawFile);
const [programAccount, programDataAccount] = deployment.value;
assert.ok(programAccount && programDataAccount, mode + ': missing deployed program accounts');
assert.equal(programAccount.owner, 'BPFLoaderUpgradeab1e11111111111111111111111');
assert.equal(programAccount.executable, true, mode + ': program account not executable');
const programBytes = Buffer.from(programAccount.data[0], 'base64');
assert.equal(programBytes.readUInt32LE(0), 2, mode + ': not an upgradeable Program account');
assert.equal(base58(programBytes.subarray(4, 36)), deploymentRecord.programDataAddress,
  mode + ': Program account points at a different ProgramData');
assert.equal(programDataAccount.owner, 'BPFLoaderUpgradeab1e11111111111111111111111');
const programData = Buffer.from(programDataAccount.data[0], 'base64');
assert.equal(programData.readUInt32LE(0), 3, mode + ': not a ProgramData account');
assert.equal(programData[12] === 1 ? base58(programData.subarray(13, 45)) : null,
  deploymentRecord.upgradeAuthority, mode + ': recorded upgrade authority differs');
const elf = readFileSync('target/deploy/deposit_prototype.so');
const deployedElf = programData.subarray(45, 45 + elf.length);
assert.ok(deployedElf.equals(elf), mode + ': deployed ELF bytes differ from target/deploy artifact');
assert.ok(programData.subarray(45 + elf.length).every((byte) => byte === 0),
  mode + ': unexpected nonzero bytes after deployed ELF');

console.log('PASS: ' + mode + ' genesis/source/IDL/ELF-bound witnesses: ' +
  accepted + ' accepted, ' + rejected + ' included rejected, ' +
  fixtures[mode].length + ' finalized account snapshots; all signatures ed25519-verified; ' +
  'deployed ELF byte-identical (' + expected.elfSha256 + '); ' +
  'ProgramData=' + deploymentRecord.programDataAddress + '; ' +
  'observed upgradeAuthority=' + deploymentRecord.upgradeAuthority + '; ' +
  'local RPC evidence only, NOT independently authenticated consensus');
