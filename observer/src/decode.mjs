import { createHash } from 'node:crypto';

/** Base58 helpers are for address/field serialization, never signature verification. */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map([...ALPHABET].map((x, i) => [x, BigInt(i)]));

export function decode58(input) {
  if (typeof input !== 'string' || !input.length || input.length > 64) throw new Error('Invalid base58 input');
  let n = 0n;
  for (const char of input) {
    const value = INDEX.get(char);
    if (value === undefined) throw new Error('Invalid base58 alphabet');
    n = n * 58n + value;
  }
  const body = [];
  while (n > 0n) { body.unshift(Number(n % 256n)); n /= 256n; }
  let zeroes = 0;
  for (const char of input) { if (char !== '1') break; zeroes++; }
  return Buffer.from([...new Array(zeroes).fill(0), ...body]);
}

export function encode58(bytes) {
  const buf = Buffer.from(bytes);
  let n = 0n;
  for (const value of buf) n = n * 256n + BigInt(value);
  let body = '';
  while (n > 0n) { body = ALPHABET[Number(n % 58n)] + body; n /= 58n; }
  let zeroes = 0;
  for (const value of buf) { if (value !== 0) break; zeroes++; }
  return '1'.repeat(zeroes) + body;
}

export function addressBytes(value) {
  const raw = decode58(value);
  if (raw.length !== 32 || encode58(raw) !== value) throw new Error(`Invalid 32-byte canonical address: ${value}`);
  return raw;
}

export function discriminator(name) {
  return createHash('sha256').update(`account:${name}`).digest().subarray(0, 8);
}

function bool(raw, index) {
  if (raw[index] !== 0 && raw[index] !== 1) throw new Error('Noncanonical serialized boolean');
  return raw[index] === 1;
}

function coption(raw, offset, label) {
  const option = raw.readUInt32LE(offset);
  if (option !== 0 && option !== 1) throw new Error(`Noncanonical ${label} option`);
  return option === 1;
}

function check(raw, name, n) {
  if (!Buffer.isBuffer(raw) || raw.length !== n) throw new Error(`${name} account length is not ${n}`);
  if (!raw.subarray(0, 8).equals(discriminator(name))) throw new Error(`${name} discriminator mismatch`);
}

function addr(raw, at) { return encode58(raw.subarray(at, at + 32)); }
function hex(raw, at) { return raw.subarray(at, at + 32).toString('hex'); }

/** Anchor/Borsh account offsets from current source; generated IDL still required. */
export function decodeReceipt(raw) {
  check(raw, 'DepositReceipt', 218);
  return Object.freeze({
    depositor: addr(raw, 8),
    mint: addr(raw, 40),
    vault: addr(raw, 72),
    config: addr(raw, 104),
    recipientCore: hex(raw, 136),
    scope: hex(raw, 168),
    nonce: raw.readBigUInt64LE(200).toString(),
    amount: raw.readBigUInt64LE(208).toString(),
    refunded: bool(raw, 216),
    bump: raw[217],
  });
}

export function decodeConfig(raw) {
  check(raw, 'BridgeConfig', 114);
  return Object.freeze({
    admin: addr(raw, 8),
    mint: addr(raw, 40),
    scope: hex(raw, 72),
    paused: bool(raw, 104),
    totalActive: raw.readBigUInt64LE(105).toString(),
    bump: raw[113],
  });
}

/** Classic SPL token Account (165 bytes), not Token-2022. */
export function decodeTokenAccount(raw) {
  if (!Buffer.isBuffer(raw) || raw.length !== 165) throw new Error('Not a classic SPL token account (165 bytes)');
  const hasDelegate = coption(raw, 72, 'delegate');
  const isNative = coption(raw, 109, 'native');
  const hasCloseAuthority = coption(raw, 129, 'close authority');
  if (raw[108] > 2) throw new Error('Invalid token account state');
  return Object.freeze({
    mint: addr(raw, 0),
    authority: addr(raw, 32),
    amount: raw.readBigUInt64LE(64).toString(),
    hasDelegate,
    state: raw[108],
    isNative,
    hasCloseAuthority,
  });
}

/** Classic SPL token Mint (82 bytes), not Token-2022. */
export function decodeMint(raw) {
  if (!Buffer.isBuffer(raw) || raw.length !== 82) throw new Error('Not a classic SPL mint (82 bytes)');
  const hasMintAuthority = coption(raw, 0, 'mint authority');
  const hasFreezeAuthority = coption(raw, 46, 'freeze authority');
  return Object.freeze({
    hasMintAuthority,
    supply: raw.readBigUInt64LE(36).toString(),
    decimals: raw[44],
    initialized: bool(raw, 45),
    hasFreezeAuthority,
  });
}

export function strictHex32(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) throw new Error('Expected a 32-byte hexadecimal value');
  return value.toLowerCase();
}
