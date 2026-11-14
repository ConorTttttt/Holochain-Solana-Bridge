// Synthetic cryptographic fixtures only: NO claimed validator inclusion.
// Exercises valid legacy multisigner and valid v0 (without address lookups).
// ALT-including v0 is deliberately rejected pending authenticated ALT witnesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { base58, decode58, decodeSignedWire, assertRpcMessage, assertArchiveAttribution } from './signed-message.mjs';

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

test('multi-instruction privilege union is effective at signed-message scope', () => {
  const payer = key('union payer'), shared = key('union shared account');
  const program = key('union target program');
  const blockhash = createHash('sha256').update('union blockhash').digest();
  // The original first builder instruction requested shared READONLY,
  // while the second requested it WRITABLE. Solana's compiled static key
  // header records writable for *both* occurrences; the per-instruction
  // requested bit cannot be reconstructed from signed wire bytes alone.
  const firstRequestedWritable = false, secondRequestedWritable = true;
  assert.equal(firstRequestedWritable, false);
  assert.equal(secondRequestedWritable, true);
  const instructions = [Buffer.from([0x11]), Buffer.from([0x22])].map(data =>
    Buffer.concat([Buffer.from([2]), vec(1), Buffer.from([1]),
      vec(data.length), data]));
  const message = Buffer.concat([
    Buffer.from([1, 0, 1]), vec(3), payer.raw, shared.raw, program.raw,
    blockhash, vec(2), ...instructions,
  ]);
  const signature = sign(null, message, payer.privateKey);
  const wire = Buffer.concat([vec(1), signature, message]);
  const decoded = decodeSignedWire(wire);
  assert.equal(decoded.instructions.length, 2);
  for (const ix of decoded.instructions) {
    assert.equal(ix.accounts[0].pubkey, shared.address);
    assert.equal(ix.accounts[0].isWritable, true,
      'compiled message must promote shared account to writable for both instructions');
  }
  const tx = {
    signatures: [base58(signature)],
    message: {
      accountKeys: [payer.address, shared.address, program.address],
      recentBlockhash: base58(blockhash),
      instructions: [
        { programIdIndex: 2, accounts: [1], data: base58(Buffer.from([0x11])) },
        { programIdIndex: 2, accounts: [1], data: base58(Buffer.from([0x22])) },
      ],
    },
  };
  assertRpcMessage(decoded, { version: 'legacy', transaction: tx },
    { transaction: structuredClone(tx) }, 'signed union');
  const rpcTamper = structuredClone(tx);
  rpcTamper.message.instructions[0].accounts[0] = 0;
  rejected('RPC_INSTRUCTION_ACCOUNTS', () =>
    assertRpcMessage(decoded, { version: 'legacy', transaction: rpcTamper },
      { transaction: structuredClone(rpcTamper) }, 'union tamper'));
  const wireTamper = Buffer.from(wire);
  wireTamper[wireTamper.length - 1] ^= 1;
  rejected('SIGNATURE_INVALID', () => decodeSignedWire(wireTamper));
});

test('synthetic classic SPL Token request ABI is separately authenticated by opcode', () => {
  // The localnet tests actually submit unauthorized MintTo and SetAuthority
  // instructions to the SPL Token program. Those must not be judged against
  // the bridge Anchor IDL; they have their own public standard-program ABI.
  const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const authority = key('spl synthetic payer authority');
  const mint = key('spl synthetic mint');
  const destination = key('spl synthetic destination');
  const token = { address: TOKEN, raw: decode58(TOKEN) };
  const idl = { address: key('unrelated anchor program').address, instructions: [] };
  const hash = createHash('sha256').update('spl synthetic blockhash').digest();
  for (const opcode of [7, 6]) {
    const mintTo = opcode === 7;
    const accounts = mintTo ? [authority, mint, destination, token] : [authority, mint, token];
    const accountIndexes = mintTo ? [1, 2, 0] : [1, 0];
    const data = mintTo
      ? Buffer.from([7, 1, 0, 0, 0, 0, 0, 0, 0])
      : Buffer.concat([Buffer.from([6, 0, 1]), mint.raw]);
    // Unsigned token program is readonly; unsigned mint/destination writable.
    const message = Buffer.concat([
      Buffer.from([1, 0, 1]), vec(accounts.length), ...accounts.map(a => a.raw),
      hash, vec(1), Buffer.from([accounts.length - 1]),
      vec(accountIndexes.length), Buffer.from(accountIndexes),
      vec(data.length), data,
    ]);
    const signature = sign(null, message, authority.privateKey);
    const wire = Buffer.concat([vec(1), signature, message]);
    const decoded = decodeSignedWire(wire);
    const effective = decoded.instructions[0].accounts.map(a =>
      ({ index: a.index, pubkey: a.pubkey, isSigner: a.isSigner,
        isWritable: a.isWritable }));
    const requested = effective.map(a => ({ ...a,
      isWritable: a.pubkey === authority.address ? false : a.isWritable }));
    assert.equal(requested.at(-1).isWritable, false,
      'authority requested readonly despite payer effective writable');
    const record = {
      label: 'SYNTHETIC-SPL-' + opcode, signature: base58(signature),
      signedWireBase64: wire.toString('base64'),
      feePayer: authority.address, signerPubkeys: [authority.address],
      recentBlockhash: base58(hash), instructionProgramId: TOKEN,
      instructions: [{ index: 0, programId: TOKEN, dataBase64: data.toString('base64'),
        accounts: effective }],
      instructionAccounts: effective.map(a =>
        ({ address: a.pubkey, signer: a.isSigner, writable: a.isWritable })),
      requestedInstructions: [{ index: 0, programId: TOKEN,
        dataBase64: data.toString('base64'), accounts: requested }],
      requestedInstructionAccounts: requested.map(a =>
        ({ address: a.pubkey, signer: a.isSigner, writable: a.isWritable })),
    };
    const rpc = { meta: { logMessages: [] } };
    const witness = { signature: record.signature, messageRecentBlockhash: base58(hash) };
    assert.deepEqual(assertArchiveAttribution(decoded, [record], witness, rpc, idl), wire);
    const tamper = structuredClone(record);
    tamper.requestedInstructions[0].accounts[0].isWritable = false;
    tamper.requestedInstructionAccounts[0].writable = false;
    rejected('ATTR_REQUESTED_IDL', () =>
      assertArchiveAttribution(decoded, [tamper], witness, rpc, idl));
    const effectiveTamper = structuredClone(record);
    effectiveTamper.instructions[0].accounts.at(-1).isWritable = false;
    rejected('ATTR_INSTRUCTIONS', () =>
      assertArchiveAttribution(decoded, [effectiveTamper], witness, rpc, idl));
  }
  // Unknown foreign programs have NO default "trust request labels" mode.
  const { decoded, record, rpc, witness } = fixture('legacy', 1);
  rejected('ATTR_REQUESTED_PROGRAM', () =>
    assertArchiveAttribution(decoded, [record], witness, rpc, idl));
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

test('SEC-38-3 cryptographic wire payer/header/program/account mutations select exact invariants', () => {
  const { wire, message, decoded, fixtureSigners, record, rpc, witness } = fixture('legacy', 1);
  const payer = fixtureSigners[0];
  const signMessage = (msg, signer = payer) =>
    Buffer.concat([vec(1), sign(null, msg, signer.privateKey), msg]);
  const changedPayer = key('SEC-38-3 substituted fee payer');
  const feePayerMessage = Buffer.from(message);
  feePayerMessage.set(changedPayer.raw, 4); // three-byte header + one-byte static count
  rejected('SIGNATURE_INVALID', () => decodeSignedWire(
    Buffer.concat([wire.subarray(0, 65), feePayerMessage])));
  const coherentlySignedSubstitution = decodeSignedWire(signMessage(feePayerMessage, changedPayer));
  assert.equal(coherentlySignedSubstitution.feePayer, changedPayer.address);
  rejected('ATTR_FEE_PAYER', () => assertArchiveAttribution(
    coherentlySignedSubstitution, [record], witness, rpc));

  const impossibleRequired = Buffer.from(message);
  impossibleRequired[0] = 2; // compact wire declares one signature
  rejected('SIGNATURE_COUNT', () => decodeSignedWire(signMessage(impossibleRequired)));
  const impossibleReadonly = Buffer.from(message);
  impossibleReadonly[1] = 1; // all required signers readonly, payer cannot be writable
  rejected('SIGNATURE_COUNT', () => decodeSignedWire(signMessage(impossibleReadonly)));

  const staticCount = decoded.staticKeys.length;
  const ixAt = 3 + 1 + 32 * staticCount + 32 + 1;
  const invalidProgramIndex = Buffer.from(message);
  invalidProgramIndex[ixAt] = 255;
  rejected('WIRE_PROGRAM_INDEX', () =>
    decodeSignedWire(signMessage(invalidProgramIndex)));
  const invalidAccountIndex = Buffer.from(message);
  assert.equal(invalidAccountIndex[ixAt + 1], 2);
  invalidAccountIndex[ixAt + 2] = 255;
  rejected('WIRE_ACCOUNT_INDEX', () =>
    decodeSignedWire(signMessage(invalidAccountIndex)));

  // A validly signed change to a different in-range program index is still
  // contradictory to submitted attribution and the original RPC JSON.
  const changedProgram = Buffer.from(message);
  changedProgram[ixAt] = staticCount - 1;
  const changedDecoded = decodeSignedWire(signMessage(changedProgram));
  rejected('ATTR_PROGRAM', () =>
    assertArchiveAttribution(changedDecoded, [record], witness, rpc));
  rejected('RPC_PROGRAM_INDEX', () =>
    assertRpcMessage(changedDecoded, rpc, { transaction: rpc.transaction }, 'program-index mutation'));
  // A changed signed-wire account index also disagrees with signed RPC identity.
  const changedAccount = Buffer.from(message);
  changedAccount[ixAt + 2] = 1;
  const changedAccountDecoded = decodeSignedWire(signMessage(changedAccount));
  rejected('RPC_INSTRUCTION_ACCOUNTS', () => assertRpcMessage(
    changedAccountDecoded, rpc, { transaction: rpc.transaction }, 'account-index mutation'));
});

test('SEC-38-3 rejects duplicate requested and effective instruction evidence', () => {
  const { decoded, record, rpc, witness } = fixture('legacy', 1);
  const duplicateEffective = structuredClone(record);
  duplicateEffective.instructions.push(structuredClone(record.instructions[0]));
  rejected('ATTR_INSTRUCTIONS', () =>
    assertArchiveAttribution(decoded, [duplicateEffective], witness, rpc));
  const duplicateRequested = structuredClone(record);
  duplicateRequested.requestedInstructions.push(structuredClone(record.requestedInstructions[0]));
  rejected('ATTR_REQUESTED_REQUIRED', () =>
    assertArchiveAttribution(decoded, [duplicateRequested], witness, rpc));
  const conflictingDuplicate = structuredClone(record);
  conflictingDuplicate.requestedInstructionAccounts[0].writable = false;
  rejected('ATTR_REQUESTED_ACCOUNTS', () =>
    assertArchiveAttribution(decoded, [record, conflictingDuplicate], witness, rpc));
});

test('SEC-38-3 v0 ALT RPC claims fail closed even for a signed no-ALT control', () => {
  const { decoded, rpc } = fixture(0, 1);
  const loaded = structuredClone(rpc);
  loaded.meta.loadedAddresses.readonly.push(key('invented ALT loaded key').address);
  rejected('ALT_UNVERIFIED', () =>
    assertRpcMessage(decoded, loaded, { transaction: loaded.transaction }));
});
