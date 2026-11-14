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


// This changes the ORIGINAL signed wire consistently across every archive copy,
// getTransaction and getBlock. Without the real private signer key, any changed
// signed message must fail Ed25519. Structural index classes are instead tested
// with deliberately re-signed synthetic wires in signed-message-fixtures.test.mjs.
function mutateArchivedSignedMessage(dir, mutate) {
  const bundle = readJson(join(dir, bundleName));
  const witness = bundle.finalized[0];
  const txPath = join(dir, witness.getTransactionBase64RawFile);
  const tx = readJson(txPath);
  const oldBase64 = tx.result.transaction[0];
  const wire = Buffer.from(oldBase64, 'base64');
  assert.equal(wire[0], 1, 'tamper setup: expected single-signer legacy localnet witness');
  const messageStart = 65; // one compact signature count + one 64-byte signature
  assert.equal(wire[messageStart] & 0x80, 0,
    'tamper setup: actual archive fixture must be legacy');
  const staticCount = wire[messageStart + 3];
  assert.ok(staticCount > 0 && staticCount < 128);
  const instructionOffset = messageStart + 3 + 1 + staticCount * 32 + 32 + 1;
  mutate(wire, { messageStart, instructionOffset });
  const changed = wire.toString('base64');
  assert.notEqual(changed, oldBase64);
  tx.result.transaction[0] = changed;
  writeJson(txPath, tx);
  const blockPath = join(dir, witness.getBlockBase64RawFile);
  const block = readJson(blockPath);
  const matching = block.result.transactions.find(t => t.transaction?.[0] === oldBase64);
  assert.ok(matching, 'tamper setup: containing-block original wire is missing');
  matching.transaction[0] = changed;
  writeJson(blockPath, block);
  let copies = 0;
  for (const record of bundle.transactions) {
    if (record.signature === witness.signature && typeof record.signedWireBase64 === 'string') {
      assert.equal(record.signedWireBase64, oldBase64);
      record.signedWireBase64 = changed;
      copies++;
    }
  }
  assert.ok(copies, 'tamper setup: no submitted original wires');
  writeJson(join(dir, bundleName), bundle);
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
  'containing parsed block file missing': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    unlinkSync(join(dir, bundle.finalized[0].getBlockRawFile));
  },
  'containing base64 block field absent': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    delete bundle.finalized[0].getBlockBase64RawFile;
    writeJson(join(dir, bundleName), bundle);
  },
  'containing block RPC result null': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const path = join(dir, bundle.finalized[0].getBlockBase64RawFile);
    const rpc = readJson(path);
    rpc.result = null;
    writeJson(path, rpc);
  },
  'signed wire fee payer key mutated without re-signing': (dir) =>
    mutateArchivedSignedMessage(dir, (wire, { messageStart }) => {
      wire[messageStart + 4] ^= 1; // first static key (actual fee payer)
    }),
  'signed wire required-signature header mutated': (dir) =>
    mutateArchivedSignedMessage(dir, (wire, { messageStart }) => {
      wire[messageStart]++; // signature-count vs required-count invariant fires first
    }),
  'signed wire compiled program index mutated without re-signing': (dir) =>
    mutateArchivedSignedMessage(dir, (wire, { instructionOffset }) => {
      wire[instructionOffset] = 255;
    }),
  'signed wire compiled account index mutated without re-signing': (dir) =>
    mutateArchivedSignedMessage(dir, (wire, { instructionOffset }) => {
      assert.ok(wire[instructionOffset + 1] > 0);
      wire[instructionOffset + 2] = 255; // first compiled account index
    }),
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
    // Multiple operation labels may contain the SAME original submitted wire.
    // Mutate every copy identically to isolate RPC/wire mismatch; contradictory
    // duplicate wires are tested separately as WIRE_CONFLICT.
    const altered = flipMessageByte(record.signedWireBase64);
    let changed = 0;
    for (const entry of bundle.transactions) {
      if (entry.signature !== record.signature ||
          !Object.hasOwn(entry, 'signedWireBase64')) continue;
      assert.equal(typeof entry.signedWireBase64, 'string');
      entry.signedWireBase64 = altered;
      changed++;
    }
    assert.ok(changed > 0, 'tamper setup: signature had no submitted wires');
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
  'requested privilege flags falsified against pinned IDL': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.requestedInstructions?.length &&
      r.requestedInstructionAccounts?.length);
    assert.ok(record, 'tamper setup: missing separate requested account records');
    record.requestedInstructions[0].accounts[0].isWritable =
      !record.requestedInstructions[0].accounts[0].isWritable;
    record.requestedInstructionAccounts[0].writable =
      record.requestedInstructions[0].accounts[0].isWritable;
    writeJson(join(dir, bundleName), bundle);
  },
  'requested accounts contradict builder intent': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.requestedInstructionAccounts?.length);
    assert.ok(record, 'tamper setup: no requested account flags');
    record.requestedInstructionAccounts[0].writable =
      !record.requestedInstructionAccounts[0].writable;
    writeJson(join(dir, bundleName), bundle);
  },
  'duplicate signed-effective instruction metadata': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.instructions?.length);
    assert.ok(record);
    record.instructions.push(structuredClone(record.instructions[0]));
    writeJson(join(dir, bundleName), bundle);
  },
  'duplicate requested instruction evidence': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.requestedInstructions?.length);
    assert.ok(record);
    record.requestedInstructions.push(structuredClone(record.requestedInstructions[0]));
    writeJson(join(dir, bundleName), bundle);
  },
  'contradictory duplicated builder metadata': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const record = bundle.transactions.find(r => r.requestedInstructionAccounts?.length);
    assert.ok(record);
    const copy = structuredClone(record);
    copy.requestedInstructionAccounts[0].writable =
      !copy.requestedInstructionAccounts[0].writable;
    bundle.transactions.push(copy);
    writeJson(join(dir, bundleName), bundle);
  },
  'containing block execution metadata contradicts tx': (dir) => {
    const bundle = readJson(join(dir, bundleName));
    const witness = bundle.finalized[0];
    const path = join(dir, witness.getBlockRawFile);
    const block = readJson(path);
    const entry = block.result.transactions.find(t =>
      t.transaction?.signatures?.includes(witness.signature));
    assert.ok(entry);
    entry.meta.err = entry.meta.err === null ? { InstructionError: [0, 'tampered'] } : null;
    writeJson(path, block);
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
  'archive marked incomplete': /partial\/failed witness archive is never a PASS/,
  'finalized witness dropped while claiming complete': /finalized manifest does not cover EVERY recorded signed transaction/,
  'containing base64 block file missing': /WITNESS_BLOCK_MISSING:/,
  'containing parsed block file missing': /WITNESS_BLOCK_MISSING:/,
  'containing base64 block field absent': /WITNESS_BLOCK_MISSING:/,
  'containing block RPC result null': /WITNESS_BLOCK_MISSING:/,
  'signed wire fee payer key mutated without re-signing': /SIGNATURE_INVALID:/,
  'signed wire required-signature header mutated': /SIGNATURE_COUNT:/,
  'signed wire compiled program index mutated without re-signing': /SIGNATURE_INVALID:/,
  'signed wire compiled account index mutated without re-signing': /SIGNATURE_INVALID:/,
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
  'requested privilege flags falsified against pinned IDL': /ATTR_REQUESTED_IDL:/,
  'requested accounts contradict builder intent': /ATTR_REQUESTED_ACCOUNTS:/,
  'duplicate signed-effective instruction metadata': /ATTR_INSTRUCTIONS:/,
  'duplicate requested instruction evidence': /ATTR_REQUESTED_REQUIRED:/,
  'contradictory duplicated builder metadata': /ATTR_REQUESTED_ACCOUNTS:/,
  'containing block execution metadata contradicts tx': /containing block execution disagrees with transaction/,
  'message blockhash relabelled with intact signed bytes': /ATTR_BLOCKHASH:/,
  'expected rejection relabelled as success': /recorded execution result disagrees with finalized ledger/,
  'deployed ELF byte altered': /deployed ELF bytes differ from target\/deploy artifact/,
};
assert.deepEqual(Object.keys(expectedFailure).sort(), Object.keys(cases).sort(),
  'every tamper mutation requires one named expected failure reason');
for (const [name, mutate] of Object.entries(cases)) {
  const result = withCopy(mutate);
  assert.notEqual(result.status, 0, 'verifier ACCEPTED tampered archive: ' + name);
  assert.match(result.stderr, expectedFailure[name],
    'WRONG REJECTION CLASS for ' + name + ':\n' + result.stderr);
  console.log('REJECTED (' + mode + '): ' + name + ' -> ' + expectedFailure[name]);
}
console.log('PASS: ' + mode + ' verifier rejected all ' + Object.keys(cases).length +
  ' named tamper classes and accepted the untampered control');
