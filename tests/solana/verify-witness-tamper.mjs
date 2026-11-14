// Adversarial check of verify-witness-bundle.mjs against REAL archived evidence.
// Each case mutates a private COPY of target/localnet-evidence and requires the
// verifier to fail. An untampered copy must pass, so failures are attributable.
// This never writes to, or substitutes for, the genuine evidence directory.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mode = process.argv[2];
assert.ok(['lifecycle', 'init-capture', 'u64-max'].includes(mode), 'unknown witness mode');
const source = 'target/localnet-evidence';
const bundleName = 'sprint1-' + mode + '-transactions.json';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

function runVerifier(dir) {
  return spawnSync(process.execPath, ['tests/solana/verify-witness-bundle.mjs', mode], {
    env: { ...process.env, WITNESS_DIR: dir }, encoding: 'utf8',
  });
}
function withCopy(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'witness-tamper-'));
  try {
    cpSync(source, dir, { recursive: true });
    mutate(dir);
    return runVerifier(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
// Flip one byte inside the signed MESSAGE (after the signatures), in both the
// transaction and its containing block, so only ed25519 verification can fail.
function flipMessageByte(base64) {
  const bytes = Buffer.from(base64, 'base64');
  bytes[bytes.length - 1] ^= 0x01;
  return bytes.toString('base64');
}

const control = withCopy(() => {});
assert.equal(control.status, 0, 'untampered copy must verify:\n' + control.stderr);

const firstRejected = (bundle) => bundle.finalized.find((w) => w.meta.err !== null);
const cases = {
  'archive marked incomplete': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    bundle.complete = false;
    writeJson(join(dir, bundleName), bundle);
  },
  'finalized witness dropped while claiming complete': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    bundle.finalized.pop();
    writeJson(join(dir, bundleName), bundle);
  },
  'containing base64 block file missing': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    unlinkSync(join(dir, bundle.finalized[0].getBlockBase64RawFile));
  },
  'signed message altered consistently in tx and block': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const witness = bundle.finalized[0];
    const txPath = join(dir, witness.getTransactionBase64RawFile);
    const tx = readJson(txPath);
    const original = tx.result.transaction[0];
    tx.result.transaction[0] = flipMessageByte(original);
    writeJson(txPath, tx);
    const blockPath = join(dir, witness.getBlockBase64RawFile);
    const block = readJson(blockPath);
    const entry = block.result.transactions.find((item) => item.transaction[0] === original);
    assert.ok(entry, 'tamper setup: transaction not found in its block');
    entry.transaction[0] = tx.result.transaction[0];
    writeJson(blockPath, block);
    // Keep the originally-submitted-bytes record consistent too.
    for (const record of bundle.transactions) {
      if (record.signature === witness.signature && record.signedWireBase64) {
        record.signedWireBase64 = tx.result.transaction[0];
      }
    }
    writeJson(join(dir, bundleName), bundle);
  },
  'submitted wire bytes differ from finalized bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find((r) => typeof r.signedWireBase64 === 'string');
    assert.ok(record, 'tamper setup: no submitted wire bytes recorded');
    record.signedWireBase64 = flipMessageByte(record.signedWireBase64);
    writeJson(join(dir, bundleName), bundle);
  },
  'all submitted signed wires deleted': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    for (const record of bundle.transactions) delete record.signedWireBase64;
    writeJson(join(dir, bundleName), bundle);
  },
  'submitted wire field malformed': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => typeof r.signedWireBase64 === 'string');
    assert.ok(record, 'tamper setup: no original wire');
    record.signedWireBase64 = 'not-base64!!!';
    writeJson(join(dir, bundleName), bundle);
  },
  'contradictory duplicate submitted wires': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => typeof r.signedWireBase64 === 'string');
    assert.ok(record, 'tamper setup: no original wire');
    bundle.transactions.push({ ...record,
      signedWireBase64: flipMessageByte(record.signedWireBase64) });
    writeJson(join(dir, bundleName), bundle);
  },
  'fee payer attribution relabelled with intact signed bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.feePayer);
    assert.ok(record, 'tamper setup: no fee-payer field');
    record.feePayer = '11111111111111111111111111111111';
    writeJson(join(dir, bundleName), bundle);
  },
  'required signer attribution relabelled with intact signed bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.signerPubkeys);
    assert.ok(record, 'tamper setup: no signer attribution');
    record.signerPubkeys[0] = '11111111111111111111111111111111';
    writeJson(join(dir, bundleName), bundle);
  },
  'program attribution relabelled with intact signed bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.instructionProgramId);
    assert.ok(record, 'tamper setup: no program attribution');
    record.instructionProgramId = '11111111111111111111111111111111';
    writeJson(join(dir, bundleName), bundle);
  },
  'instruction data relabelled with intact signed bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.instructions?.length);
    assert.ok(record, 'tamper setup: no instructions');
    record.instructions[0].dataBase64 = 'AQ==';
    writeJson(join(dir, bundleName), bundle);
  },
  'instruction account flags relabelled with intact signed bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.instructionAccounts?.length);
    assert.ok(record, 'tamper setup: no instruction accounts');
    record.instructionAccounts[0].writable = !record.instructionAccounts[0].writable;
    writeJson(join(dir, bundleName), bundle);
  },
  'message blockhash relabelled with intact signed bytes': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.recentBlockhash);
    assert.ok(record, 'tamper setup: no recent blockhash');
    record.recentBlockhash = '11111111111111111111111111111111';
    writeJson(join(dir, bundleName), bundle);
  },
  'expected rejection relabelled as success': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const rejected = firstRejected(bundle);
    for (const record of bundle.transactions) {
      if (record.signature === rejected.signature && 'error' in record) record.error = null;
    }
    writeJson(join(dir, bundleName), bundle);
  },
  'deployed ELF byte altered': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find((r) => r.deploymentRawFile);
    const path = join(dir, record.deploymentRawFile);
    const rpc = readJson(path);
    const data = Buffer.from(rpc.result.value[1].data[0], 'base64');
    data[45 + 200] ^= 0x01;
    rpc.result.value[1].data[0] = data.toString('base64');
    writeJson(path, rpc);
  },
};
// SEC-38-3: accept only the intended rejection class, not a random crash.
const expectedFailure = {
  'archive marked incomplete': /partial\\/failed witness archive is never a PASS/,
  'finalized witness dropped while claiming complete': /finalized manifest does not cover EVERY recorded signed transaction/,
  'containing base64 block file missing': /ENOENT/,
  'signed message altered consistently in tx and block': /SIGNATURE_INVALID:/,
  'submitted wire bytes differ from finalized bytes': /WIRE_FINALIZED_TRANSACTION:/,
  'all submitted signed wires deleted': /WIRE_REQUIRED:/,
  'submitted wire field malformed': /WIRE_MALFORMED:/,
  'contradictory duplicate submitted wires': /WIRE_CONFLICT:/,
  'fee payer attribution relabelled with intact signed bytes': /ATTR_FEE_PAYER:/,
  'required signer attribution relabelled with intact signed bytes': /ATTR_SIGNERS:/,
  'program attribution relabelled with intact signed bytes': /ATTR_PROGRAM:/,
  'instruction data relabelled with intact signed bytes': /ATTR_INSTRUCTIONS:/,
  'instruction account flags relabelled with intact signed bytes': /ATTR_INSTRUCTION_ACCOUNTS:/,
  'message blockhash relabelled with intact signed bytes': /ATTR_BLOCKHASH:/,
  'expected rejection relabelled as success': /recorded execution result disagrees with finalized ledger/,
  'deployed ELF byte altered': /deployed ELF bytes differ from target\\/deploy artifact/,
};
assert.deepEqual(Object.keys(expectedFailure).sort(), Object.keys(cases).sort(),
  'every tamper mutation requires one named expected failure reason');
for (const [name, mutate] of Object.entries(cases)) {
  const result = withCopy(mutate);
  assert.notEqual(result.status, 0, 'verifier ACCEPTED tampered archive: ' + name);
  assert.match(result.stderr, expectedFailure[name],
    'WRONG REJECTION CLASS for ' + name + ':\\n' + result.stderr);
  console.log('REJECTED (' + mode + '): ' + name + ' -> ' + expectedFailure[name]);
}
console.log('PASS: ' + mode + ' verifier rejected all ' + Object.keys(cases).length +
  ' named tamper classes and accepted the untampered control');
