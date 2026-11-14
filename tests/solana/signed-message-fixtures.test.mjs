// Synthetic cryptographic fixtures only: NO claimed validator inclusion.
// Exercises valid legacy multisigner and valid v0 (without address lookups).
// ALT-including v0 is deliberately rejected pending authenticated ALT witnesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { base58, decodeSignedWire, assertRpcMessage, assertArchiveAttribution } from './signed-message.mjs';

function vec(n) {
  assert.ok(Number.isSafeInteger(n) && n >= 0 && n < 65536);
  const bytes = [];
  do { let b = n & 127; n >>>= 7; if (n) b |= 128; bytes.push(b); } while (n);
  return Buffer.from(bytes);
}
function key(name) {
  // Public, intentionally reproducible test-only seed. NEVER use for funds.
  const seed = createHash('sha256').update('PUBLIC TEST FIXTURE: ' + name).digest();
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const raw = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
  return { privateKey, raw, address: base58(raw) };
}
function fixture(version, signerCount) {
  const payer = key('payer/' + version + '/' + signerCount);
  const second = key('second/' + version + '/' + signerCount);
  const program = key('program/' + version + '/' + signerCount);
  const other = key('other/' + version + '/' + signerCount);
  const signers = signerCount === 2 ? [payer, second] : [payer];
  const accounts = [...signers, program, other];
  const programIndex = signers.length;
  const otherIndex = accounts.length - 1;
  const hash = createHash('sha256').update('blockhash/' + version + '/' + signerCount).digest();
  const instructionData = Buffer.from([1, 2, 3, 0, 255, 9, 8, 7, 23]);
  const ix = Buffer.concat([
    Buffer.from([programIndex]), vec(2), Buffer.from([0, otherIndex]),
    vec(instructionData.length), instructionData
  ]);
  const message = Buffer.concat([
    ...(version === 0 ? [Buffer.from([0x80])] : []),
    Buffer.from([signers.length, signerCount === 2 ? 1 : 0, accounts.length - signers.length]),
    vec(accounts.length), ...accounts.map(a => a.raw), hash, vec(1), ix,
    ...(version === 0 ? [vec(0)] : [])
  ]);
  const sigs = signers.map(s => sign(null, message, s.privateKey));
  const wire = Buffer.concat([vec(sigs.length), ...sigs, message]);
  const decoded = decodeSignedWire(wire);
  const rpc = {
    version, transaction: {
      signatures: sigs.map(base58),
      message: { accountKeys: accounts.map(a => a.address),
        recentBlockhash: base58(hash),
        instructions: [{ programIdIndex: programIndex, accounts: [0, otherIndex],
          data: base58(instructionData) }],
        ...(version === 0 ? { addressTableLookups: [] } : {})
      }
    },
    meta: { err: null, logMessages: [],
      ...(version === 0 ? { loadedAddresses: { writable: [], readonly: [] } } : {}) }
  };
  const record = {
    label: 'PUBLIC-SYNTHETIC-FIXTURE', signature: sigs.map(base58)[0],
    signedWireBase64: wire.toString('base64'), feePayer: payer.address,
    signerPubkeys: signers.map(s => s.address), recentBlockhash: base58(hash),
    instructionProgramId: program.address,
    instructions: [{ index: 0, programId: program.address,
      dataBase64: instructionData.toString('base64'),
      accounts: [
        { index: 0, pubkey: payer.address, isSigner: true, isWritable: true },
        { index: 1, pubkey: other.address, isSigner: false, isWritable: false }
      ]
    }],
    instructionAccounts: [
      { address: payer.address, signer: true, writable: true },
      { address: other.address, signer: false, writable: false }
    ],
    emittingProgramId: null
  };
  record.requestedInstructions = structuredClone(record.instructions);
  record.requestedInstructionAccounts = structuredClone(record.instructionAccounts);
  return { wire, message, fixtureSigners: signers, decoded, record, rpc,
    witness: { signature: record.signature, messageRecentBlockhash: base58(hash) } };
}
function rejected(code, fn) {
  assert.throws(fn, err => err instanceof Error && err.message.startsWith(code + ':'),
    'expected exactly ' + code + ' failure');
}
for (const [name, version, signers] of [
  ['legacy multisigner', 'legacy', 2],
  ['v0 single-signer no ALT', 0, 1],
  ['v0 multisigner no ALT', 0, 2],
]) {
  test(name + ': independently signed message, RPC and attribution pass', () => {
    const { wire, decoded, record, rpc, witness } = fixture(version, signers);
    assert.equal(decoded.version, version);
    assert.equal(decoded.requiredSignerKeys.length, signers);
    assert.deepEqual(decoded.signatures, rpc.transaction.signatures);
    assertRpcMessage(decoded, rpc, { transaction: structuredClone(rpc.transaction) }, name);
    assert.deepEqual(assertArchiveAttribution(decoded, [record], witness, rpc), wire);
  });
}
test('readonly requested fee-payer signer becomes writable in signed message', () => {
  const { wire, decoded, record, rpc, witness } = fixture('legacy', 1);
  assert.equal(decoded.instructions[0].accounts[0].isWritable, true,
    'fee payer must be writable in the effective compiled message');
  // Model an Anchor instruction declaring a readonly signer that also pays
  // fees. The wire proves the effective writable bit; the pinned IDL (not
  // the wire) attests the requested readonly intent.
  record.requestedInstructions[0].accounts[0].isWritable = false;
  record.requestedInstructionAccounts[0].writable = false;
  const idl = {
    address: record.instructionProgramId,
    instructions: [{
      discriminator: [...Buffer.from(record.instructions[0].dataBase64, 'base64').subarray(0, 8)],
      accounts: [{ signer: true, writable: false },
        { signer: false, writable: false }],
    }],
  };
  assert.deepEqual(assertArchiveAttribution(decoded, [record], witness, rpc, idl), wire);
  const effectiveTamper = structuredClone(record);
  effectiveTamper.instructionAccounts[0].writable = false;
  rejected('ATTR_INSTRUCTION_ACCOUNTS', () =>
    assertArchiveAttribution(decoded, [effectiveTamper], witness, rpc, idl));
  const idlTamper = structuredClone(record);
  idlTamper.requestedInstructions[0].accounts[0].isWritable = true;
  idlTamper.requestedInstructionAccounts[0].writable = true;
  rejected('ATTR_REQUESTED_IDL', () =>
    assertArchiveAttribution(decoded, [idlTamper], witness, rpc, idl));
  const requestedCoherenceTamper = structuredClone(record);
  requestedCoherenceTamper.requestedInstructionAccounts[0].writable = true;
  rejected('ATTR_REQUESTED_ACCOUNTS', () =>
    assertArchiveAttribution(decoded, [requestedCoherenceTamper], witness, rpc, idl));
});

test('synthetic signed-message tamper and attribution tamper reject by class', () => {
  const { wire, decoded, record, rpc, witness } = fixture(0, 2);
  const corruptedSignature = Buffer.from(wire);
  corruptedSignature[2] ^= 1;
  rejected('SIGNATURE_INVALID', () => decodeSignedWire(corruptedSignature));
  const corruptedMessage = Buffer.from(wire);
  corruptedMessage[corruptedMessage.length - 2] ^= 1;
  rejected('SIGNATURE_INVALID', () => decodeSignedWire(corruptedMessage));
  for (const [code, mutate] of [
    ['ATTR_FEE_PAYER', r => { r.feePayer = key('imposter').address; }],
    ['ATTR_SIGNERS', r => { r.signerPubkeys.reverse(); }],
    ['ATTR_PROGRAM', r => { r.instructionProgramId = key('imposter').address; }],
    ['ATTR_INSTRUCTIONS', r => { r.instructions[0].dataBase64 = 'AQ=='; }],
    ['ATTR_INSTRUCTIONS', r => { r.instructions[0].accounts[0].isWritable = false; }],
    ['ATTR_INSTRUCTION_ACCOUNTS', r => { r.instructionAccounts[0].writable = false; }],
    ['ATTR_BLOCKHASH', r => { r.recentBlockhash = key('imposter').address; }]
  ]) {
    const copy = structuredClone(record);
    mutate(copy);
    rejected(code, () => assertArchiveAttribution(decoded, [copy], witness, rpc));
  }
  rejected('ATTR_BLOCKHASH', () => assertArchiveAttribution(decoded, [record],
    { ...witness, messageRecentBlockhash: '1'.repeat(32) }, rpc));
  rejected('WIRE_REQUIRED', () => {
    const copy = structuredClone(record); delete copy.signedWireBase64;
    assertArchiveAttribution(decoded, [copy], witness, rpc);
  });
  rejected('WIRE_MALFORMED', () =>
    assertArchiveAttribution(decoded, [{ ...record, signedWireBase64: '!!!' }], witness, rpc));
  rejected('WIRE_CONFLICT', () => {
    const copy = { ...record, signedWireBase64: Buffer.from('different').toString('base64') };
    assertArchiveAttribution(decoded, [record, copy], witness, rpc);
  });
  rejected('RPC_ACCOUNT_KEYS', () => {
    const copy = structuredClone(rpc); copy.transaction.message.accountKeys.reverse();
    assertRpcMessage(decoded, copy, { transaction: copy.transaction });
  });
  rejected('RPC_INSTRUCTION_DATA', () => {
    const copy = structuredClone(rpc); copy.transaction.message.instructions[0].data = '1';
    assertRpcMessage(decoded, copy, { transaction: copy.transaction });
  });
});
test('ALT lookup data cannot be accepted merely by supplying RPC account labels', () => {
  const { message, fixtureSigners } = fixture(0, 1);
  // Sign the ALTERED message with a real fixture key, so ALT_UNVERIFIED
  // cannot be masked by an invalid Ed25519 signature.
  const lookupTable = key('lookup table').raw;
  const altMessage = Buffer.concat([
    message.subarray(0, message.length - 1), vec(1), lookupTable, vec(1),
    Buffer.from([0]), vec(0)
  ]);
  const withAlt = Buffer.concat([
    vec(1), sign(null, altMessage, fixtureSigners[0].privateKey), altMessage
  ]);
  rejected('ALT_UNVERIFIED', () => decodeSignedWire(withAlt));
});
