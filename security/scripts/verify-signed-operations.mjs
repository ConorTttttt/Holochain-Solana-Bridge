/** Independent SEC offline verification of submitted Solana legacy transaction bytes.
 * This does not prove finalized inclusion, getTransaction metadata, or getBlock membership.
 * Usage: node security/scripts/verify-signed-operations.mjs <operations.json> [exact-source-sha]
 */
import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(bytes) {
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex')), s = '';
  while (n > 0n) { const rem = n % 58n; s = alphabet[Number(rem)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
  return s;
}
function need(condition, context) { if (!condition) throw new Error('SEC WIRE REJECT: ' + context); }
function parseWire(bytes) {
  let offset = 0;
  function take(n) {
    need(Number.isInteger(n) && n >= 0 && offset + n <= bytes.length, 'truncated wire');
    const value = bytes.subarray(offset, offset + n); offset += n; return value;
  }
  const byte = () => take(1)[0];
  function vec() {
    let total = 0, shift = 0, part;
    do {
      part = byte(); total += (part & 127) * (2 ** shift); shift += 7;
      need(shift <= 28 && Number.isSafeInteger(total), 'invalid shortvec');
    } while (part & 128);
    return total;
  }
  const count = vec();
  need(count > 0 && count <= 32, 'invalid signature count');
  const signatures = Array.from({ length: count }, () => take(64));
  const message = bytes.subarray(offset);
  const versionByte = byte();
  need((versionByte & 128) === 0, 'non-legacy message: v0/v1 NOT VERIFIED by this tool');
  const requiredSignatures = versionByte, readonlySigned = byte(), readonlyUnsigned = byte();
  need(requiredSignatures === count, 'required signer count mismatch');
  const keys = Array.from({ length: vec() }, () => take(32));
  need(keys.length >= count && readonlySigned <= count && readonlyUnsigned <= keys.length-count,
    'invalid message account flags');
  const blockhash = take(32);
  const instructions = Array.from({ length: vec() }, () => {
    const programIndex = byte();
    const indices = Array.from(take(vec()));
    const data = take(vec());
    need(programIndex < keys.length && indices.every(i => i < keys.length), 'invalid instruction account index');
    return { programId: encode58(keys[programIndex]), accounts: indices.map(i => encode58(keys[i])),
      dataBase64: data.toString('base64') };
  });
  need(offset === bytes.length, 'trailing data');
  return { signatures, message, keys, blockhash, instructions };
}
function validSignature(message, signature, pubkey) {
  const header = Buffer.from('302a300506032b6570032100', 'hex');
  const key = createPublicKey({ key: Buffer.concat([header, pubkey]), format: 'der', type: 'spki' });
  return verify(null, message, key, signature);
}
function main() {
  const [, , file, exactSha] = process.argv;
  need(Boolean(file), 'missing signed operations archive argument');
  const journal = JSON.parse(readFileSync(file, 'utf8'));
  need(/^[0-9a-f]{40}$/.test(journal.sourceCommitSha || ''), 'missing 40-character source SHA');
  if (exactSha) need(journal.sourceCommitSha === exactSha, 'wrong exact source SHA');
  need(Array.isArray(journal.operations) && journal.operations.length > 0, 'empty operations');
  let verified = 0, mutatedRejected = 0, secondaryRejected = 0, unsigned = 0;
  for (const op of journal.operations) {
    if (!op.signedWireBase64) { unsigned++; continue; }
    need(op.status === 'included', 'operation not marked included: ' + op.label);
    const wire = Buffer.from(op.signedWireBase64, 'base64');
    need(wire.toString('base64') === op.signedWireBase64, 'noncanonical base64: ' + op.label);
    const msg = parseWire(wire);
    for (let i = 0; i < msg.signatures.length; i++)
      need(validSignature(msg.message, msg.signatures[i], msg.keys[i]), 'bad signer: ' + op.label);
    need(encode58(msg.signatures[0]) === op.signature, 'signature field mismatch: ' + op.label);
    need(encode58(msg.keys[0]) === op.feePayer, 'fee payer mismatch: ' + op.label);
    need(encode58(msg.blockhash) === op.recentBlockhash, 'recent blockhash mismatch: ' + op.label);
    need(msg.instructions.length === op.instructions?.length, 'instruction count mismatch: ' + op.label);
    for (let i = 0; i < msg.instructions.length; i++) {
      const actual = msg.instructions[i], recorded = op.instructions[i];
      need(actual.programId === recorded.programId && actual.dataBase64 === recorded.dataBase64 &&
        JSON.stringify(actual.accounts) === JSON.stringify(recorded.accounts?.map(x => x.pubkey)),
        'instruction program/accounts/data mismatch: ' + op.label);
    }
    const tampered = Buffer.from(msg.message);
    tampered[tampered.length - 1] ^= 1;
    need(!validSignature(tampered, msg.signatures[0], msg.keys[0]), 'tampered message accepted: ' + op.label);
    mutatedRejected++;
    if (msg.signatures.length > 1) {
      need(!validSignature(msg.message, msg.signatures.at(-1), msg.keys[0]),
        'wrong secondary signer accepted: ' + op.label);
      secondaryRejected++;
    }
    verified++;
  }
  need(verified > 0, 'zero signed operations');
  console.log(JSON.stringify({ verdict: 'SIGNED_SUBMITTED_WIRE_ONLY_NOT_FINALITY',
    sourceSha: journal.sourceCommitSha, idlSha256: journal.idlSha256, elfSha256: journal.elfSha256,
    totalOperations: journal.operations.length, signedWiresVerified: verified,
    mutatedMessagesRejected: mutatedRejected, secondarySignerProbes: secondaryRejected,
    operationsWithoutSignedWire: unsigned, authenticatedGetTransaction: false,
    authenticatedCompleteGetBlock: false, independentlyVerifiedConsensus: false }, null, 2));
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
