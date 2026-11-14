// Independent Solana signed-message decoder and attribution verification.
// No Solana SDK is used: labels must agree with the actual Ed25519-signed bytes.
// ALT resolution requires independently witnessed table state, which this
// localnet evidence format does not yet archive. Fail closed on ALT lookups.
import { createPublicKey, verify as edVerify } from 'node:crypto';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ED_KEY_DER = Buffer.from('302a300506032b6570032100', 'hex');
export function base58(bytes) {
  const buf = Buffer.from(bytes);
  let n = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; out = '1' + out; }
  return out;
}
export function fail(code, detail) { throw new Error(code + ': ' + detail); }
export function requireEvidence(ok, code, detail) { if (!ok) fail(code, detail); }
export function canonical64(value, code) {
  requireEvidence(typeof value === 'string' && value.length > 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value), code, 'missing/malformed base64');
  const data = Buffer.from(value, 'base64');
  requireEvidence(data.length > 0 && data.toString('base64') === value,
    code, 'noncanonical base64');
  return data;
}

export function decodeSignedWire(bytes, label = 'signed transaction') {
  const wire = Buffer.from(bytes);
  let p = 0;
  function take(size, what) {
    requireEvidence(Number.isSafeInteger(size) && size >= 0 && p + size <= wire.length,
      'WIRE_TRUNCATED', label + ': ' + what);
    const b = wire.subarray(p, p + size);
    p += size;
    return b;
  }
  function u8(what) { return take(1, what)[0]; }
  function short(what) {
    let n = 0;
    for (let i = 0; i < 3; i++) {
      const b = u8(what);
      n |= (b & 127) << (7 * i);
      if (!(b & 128)) {
        requireEvidence(i === 0 || n >= (1 << (7 * i)), 'WIRE_SHORTVEC',
          label + ': noncanonical ' + what);
        requireEvidence(n <= 65535, 'WIRE_SHORTVEC', label + ': oversized ' + what);
        return n;
      }
    }
    fail('WIRE_SHORTVEC', label + ': overlong ' + what);
  }
  const sigCount = short('signature count');
  requireEvidence(sigCount > 0 && sigCount <= 255, 'SIGNATURE_COUNT', label);
  const signatureBuffers = Array.from({ length: sigCount }, (_, i) => take(64, 'signature ' + i));
  const messageStart = p;
  const prefix = wire[p];
  requireEvidence(prefix !== undefined, 'WIRE_TRUNCATED', label + ': no message');
  let version = 'legacy';
  if (prefix & 128) {
    version = prefix & 127;
    requireEvidence(version === 0, 'UNSUPPORTED_VERSION', label + ': version ' + version);
    p++;
  }
  const required = u8('required signers');
  const readonlySigned = u8('readonly signed count');
  const readonlyUnsigned = u8('readonly unsigned count');
  const staticCount = short('static key count');
  requireEvidence(required === sigCount && required > 0 && required <= staticCount &&
    readonlySigned < required && readonlyUnsigned <= staticCount - required,
    'SIGNATURE_COUNT', label + ': invalid message header');
  const staticKeys = Array.from({ length: staticCount }, (_, i) => base58(take(32, 'static key ' + i)));
  const recentBlockhash = base58(take(32, 'recent blockhash'));
  const count = short('instruction count');
  const compiled = [];
  for (let i = 0; i < count; i++) {
    const programIdIndex = u8('instruction program index');
    const n = short('instruction account count');
    const indices = Array.from({ length: n }, (_, j) => u8('instruction account index ' + j));
    const data = take(short('instruction data size'), 'instruction data');
    compiled.push({ index: i, programIdIndex, indices, data });
  }
  const lookups = [];
  if (version === 0) {
    const lookupCount = short('lookup count');
    for (let i = 0; i < lookupCount; i++) {
      const accountKey = base58(take(32, 'lookup address'));
      const writeCount = short('lookup writable count');
      const writableIndexes = [...take(writeCount, 'lookup writable indexes')];
      const readCount = short('lookup readonly count');
      const readonlyIndexes = [...take(readCount, 'lookup readonly indexes')];
      lookups.push({ accountKey, writableIndexes, readonlyIndexes });
    }
  }
  requireEvidence(p === wire.length, 'WIRE_TRAILING', label + ': unparsed signed bytes');
  // No witnessed ALT account contents at the lookup slot in the current artifact.
  requireEvidence(lookups.length === 0, 'ALT_UNVERIFIED',
    label + ': address-table lookups require independent table-account proof');
  const message = wire.subarray(messageStart);
  const signatures = signatureBuffers.map((sig, i) => {
    const key = Buffer.from(staticKeys[i] ? wire.subarray(0, 0) : []);
    // Recover raw pubkey from the signed message, never from an archive label.
    // For compact formats the address is already decoded; base58-decode below.
    const raw = decode58(staticKeys[i]);
    const spki = createPublicKey({ key: Buffer.concat([ED_KEY_DER, raw]),
      format: 'der', type: 'spki' });
    requireEvidence(edVerify(null, message, spki, sig), 'SIGNATURE_INVALID',
      label + ': Ed25519 signer ' + i + ' mismatch');
    return base58(sig);
  });
  const isSigner = i => i < required;
  const isWritable = i => i < required
    ? i < required - readonlySigned
    : i < staticCount - readonlyUnsigned;
  const instructions = compiled.map(ix => {
    requireEvidence(ix.programIdIndex < staticCount, 'WIRE_PROGRAM_INDEX',
      label + ': program index outside witnessed static keys');
    const accounts = ix.indices.map((index, j) => {
      requireEvidence(index < staticCount, 'WIRE_ACCOUNT_INDEX',
        label + ': account index outside witnessed static keys');
      return { index: j, pubkey: staticKeys[index],
        isSigner: isSigner(index), isWritable: isWritable(index),
        address: staticKeys[index], signer: isSigner(index), writable: isWritable(index),
        messageIndex: index };
    });
    return { index: ix.index, programIdIndex: ix.programIdIndex,
      programId: staticKeys[ix.programIdIndex], dataBase64: ix.data.toString('base64'),
      dataBase58: base58(ix.data), accountIndexes: ix.indices, accounts };
  });
  return { version, recentBlockhash, feePayer: staticKeys[0],
    staticKeys, requiredSignerKeys: staticKeys.slice(0, required), signatures,
    instructions, lookups };
}
export function decode58(string) {
  requireEvidence(typeof string === 'string' && /^[1-9A-HJ-NP-Za-km-z]+$/.test(string),
    'BASE58_INVALID', 'invalid base58 alphabet');
  let n = 0n;
  for (const c of string) n = n * 58n + BigInt(ALPHABET.indexOf(c));
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const tail = n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  const leading = /^1*/.exec(string)[0].length;
  const result = Buffer.concat([Buffer.alloc(leading), tail]);
  requireEvidence(base58(result) === string, 'BASE58_INVALID', 'noncanonical base58');
  return result;
}
function same(actual, expected, code, context) {
  requireEvidence(JSON.stringify(actual) === JSON.stringify(expected), code,
    context + ': ' + JSON.stringify(actual) + ' != ' + JSON.stringify(expected));
}
export function assertRpcMessage(decoded, parsed, blockEntry, label = 'RPC') {
  const tx = parsed?.transaction;
  requireEvidence(tx && Array.isArray(tx.signatures), 'RPC_SIGNATURES', label);
  same(tx.signatures, decoded.signatures, 'RPC_SIGNATURES', label);
  same(parsed.version, decoded.version, 'RPC_VERSION', label);
  const msg = tx.message;
  requireEvidence(msg && Array.isArray(msg.accountKeys) &&
    Array.isArray(msg.instructions), 'RPC_MESSAGE', label + ': compiled JSON missing');
  same(msg.accountKeys, decoded.staticKeys, 'RPC_ACCOUNT_KEYS', label);
  same(msg.recentBlockhash, decoded.recentBlockhash, 'RPC_BLOCKHASH', label);
  same(msg.instructions.length, decoded.instructions.length, 'RPC_INSTRUCTIONS', label);
  for (let i = 0; i < decoded.instructions.length; i++) {
    const a = msg.instructions[i], b = decoded.instructions[i];
    same(a.programIdIndex, b.programIdIndex, 'RPC_PROGRAM_INDEX', label + ' instruction ' + i);
    same(a.accounts, b.accountIndexes, 'RPC_INSTRUCTION_ACCOUNTS', label + ' instruction ' + i);
    same(a.data, b.dataBase58, 'RPC_INSTRUCTION_DATA', label + ' instruction ' + i);
  }
  if (decoded.version === 0) {
    same(msg.addressTableLookups ?? [], [], 'ALT_UNVERIFIED', label + ' lookups');
    same(parsed.meta?.loadedAddresses ?? { writable: [], readonly: [] },
      { writable: [], readonly: [] }, 'ALT_UNVERIFIED', label + ' loaded addresses');
  }
  // The containing full JSON block must agree with the separate finalized RPC.
  requireEvidence(blockEntry?.transaction, 'RPC_BLOCK_MISSING', label);
  same(blockEntry.transaction, tx, 'RPC_BLOCK_MESSAGE', label);
}
export function assertArchiveAttribution(decoded, records, witness, parsed) {
  const label = witness.signature;
  const wires = [];
  for (const record of records) {
    if (Object.hasOwn(record, 'signedWireBase64')) {
      const wire = canonical64(record.signedWireBase64, 'WIRE_MALFORMED');
      wires.push(wire);
    }
  }
  requireEvidence(wires.length > 0, 'WIRE_REQUIRED', label + ': no submitted signed wire');
  const first = wires[0];
  for (const wire of wires) requireEvidence(wire.equals(first), 'WIRE_CONFLICT',
    label + ': contradictory duplicate submitted wires');
  // Caller compares these bytes to BOTH RPC signed transaction sources.
  same(witness.messageRecentBlockhash, decoded.recentBlockhash,
    'ATTR_BLOCKHASH', label + ' witness blockhash');
  const touched = new Set();
  for (const record of records) {
    const field = (name, expected, code) => {
      if (!Object.hasOwn(record, name)) return;
      touched.add(name);
      same(record[name], expected, code, label + ': ' + record.label + '.' + name);
    };
    field('feePayer', decoded.feePayer, 'ATTR_FEE_PAYER');
    field('signerPubkeys', decoded.requiredSignerKeys, 'ATTR_SIGNERS');
    field('recentBlockhash', decoded.recentBlockhash, 'ATTR_BLOCKHASH');
    if (Object.hasOwn(record, 'instructionProgramId')) {
      requireEvidence(decoded.instructions.length === 1, 'ATTR_PROGRAM',
        label + ': scalar program attribution only valid for one instruction');
      field('instructionProgramId', decoded.instructions[0].programId, 'ATTR_PROGRAM');
    }
    if (Object.hasOwn(record, 'instructionAccounts')) {
      requireEvidence(decoded.instructions.length === 1, 'ATTR_INSTRUCTION_ACCOUNTS',
        label + ': scalar accounts attribution only valid for one instruction');
      field('instructionAccounts', decoded.instructions[0].accounts.map(a =>
        ({ address: a.address, signer: a.signer, writable: a.writable })),
      'ATTR_INSTRUCTION_ACCOUNTS');
    }
    if (Object.hasOwn(record, 'instructions')) {
      field('instructions', decoded.instructions.map(ix => ({
        index: ix.index, programId: ix.programId, dataBase64: ix.dataBase64,
        accounts: ix.accounts.map(a => ({ index: a.index, pubkey: a.pubkey,
          isSigner: a.isSigner, isWritable: a.isWritable }))
      })), 'ATTR_INSTRUCTIONS');
    }
    if (Object.hasOwn(record, 'emittingProgramId')) {
      const emitter = (parsed.meta?.logMessages ?? []).map(line =>
        /^Program ([1-9A-HJ-NP-Za-km-z]+) failed:/.exec(line)?.[1]).find(Boolean) ?? null;
      field('emittingProgramId', emitter, 'ATTR_EMITTER');
    }
  }
  for (const name of ['feePayer', 'signerPubkeys', 'recentBlockhash',
    'instructionProgramId', 'instructionAccounts', 'instructions']) {
    requireEvidence(touched.has(name), 'ATTR_REQUIRED',
      label + ': no submitted attribution for ' + name);
  }
  return first;
}
