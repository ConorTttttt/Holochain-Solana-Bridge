/** Offline Borsh layout/observer handshake. This does NOT prove the Rust program compiled. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeConfig, decodeReceipt, decodeTokenAccount, discriminator, encode58 } from '../../observer/src/decode.mjs';

const pubkey = (byte) => Buffer.alloc(32, byte);
const u64max = (1n << 64n) - 1n;
const config = Buffer.alloc(114);
const receipt = Buffer.alloc(218);
const mint = pubkey(2);
const admin = pubkey(1);
const vault = pubkey(3);
const configKey = pubkey(4);
const scope = pubkey(5);
const recipientCore = pubkey(6);

// The offsets below follow the Rust field order after Anchor's 8-byte discriminator.
discriminator('BridgeConfig').copy(config, 0);
admin.copy(config, 8);
mint.copy(config, 40);
scope.copy(config, 72);
config[104] = 1;
config.writeBigUInt64LE(u64max, 105);
config[113] = 254;
discriminator('DepositReceipt').copy(receipt, 0);
admin.copy(receipt, 8);
mint.copy(receipt, 40);
vault.copy(receipt, 72);
configKey.copy(receipt, 104);
recipientCore.copy(receipt, 136);
scope.copy(receipt, 168);
receipt.writeBigUInt64LE(u64max, 200);
receipt.writeBigUInt64LE(250_000n, 208);
receipt[216] = 1;
receipt[217] = 255;

test('Anchor discriminator SHA-256 and exact account sizes', () => {
  assert.equal(config.length, 8 + 32 * 3 + 1 + 8 + 1);
  assert.equal(receipt.length, 8 + 32 * 6 + 8 + 8 + 1 + 1);
  for (const name of ['BridgeConfig', 'DepositReceipt']) {
    assert.deepEqual(discriminator(name), createHash('sha256').update('account:' + name).digest().subarray(0, 8));
  }
});

test('Observer consumes exact BridgeConfig Borsh positions and full u64', () => {
  assert.deepEqual(decodeConfig(config), {
    admin: encode58(admin), mint: encode58(mint), scope: scope.toString('hex'),
    paused: true, totalActive: u64max.toString(), bump: 254,
  });
  assert.throws(() => decodeConfig(config.subarray(0, -1)), /length/);
  const flipped = Buffer.from(config); flipped[0] ^= 1;
  assert.throws(() => decodeConfig(flipped), /discriminator/);
  const invalidBool = Buffer.from(config); invalidBool[104] = 2;
  assert.throws(() => decodeConfig(invalidBool), /boolean/);
});

test('Observer consumes exact DepositReceipt Borsh positions and full u64', () => {
  assert.deepEqual(decodeReceipt(receipt), {
    depositor: encode58(admin), mint: encode58(mint), vault: encode58(vault), config: encode58(configKey),
    recipientCore: recipientCore.toString('hex'), scope: scope.toString('hex'),
    nonce: u64max.toString(), amount: '250000', refunded: true, bump: 255,
  });
  const invalidBool = Buffer.from(receipt); invalidBool[216] = 2;
  assert.throws(() => decodeReceipt(invalidBool), /boolean/);
});

test('Vault classic SPL token layout and unapproved authorities', () => {
  const tokenAccount = Buffer.alloc(165);
  mint.copy(tokenAccount, 0); configKey.copy(tokenAccount, 32);
  tokenAccount.writeBigUInt64LE(250_000n, 64); tokenAccount[108] = 1;
  assert.deepEqual(decodeTokenAccount(tokenAccount), {
    mint: encode58(mint), authority: encode58(configKey), amount: '250000',
    hasDelegate: false, state: 1, hasCloseAuthority: false,
  });
  const delegated = Buffer.from(tokenAccount); delegated.writeUInt32LE(1, 72);
  assert.equal(decodeTokenAccount(delegated).hasDelegate, true);
});

const rustSource = new URL('../../programs/deposit_prototype/src/lib.rs', import.meta.url);
test('Rust source size constants and PDA seeds remain synchronized',
  { skip: !existsSync(rustSource) && 'Rust source unavailable in isolated offline copy' }, () => {
    const source = readFileSync(rustSource, 'utf8');
    assert.match(source, /BridgeConfig\s*\{\s*pub const SIZE: usize = 32 \+ 32 \+ 32 \+ 1 \+ 8 \+ 1;/);
    assert.match(source, /DepositReceipt\s*\{\s*pub const SIZE: usize = \(32 \* 6\) \+ 8 \+ 8 \+ 1 \+ 1;/);
    assert.match(source, /seeds = \[b"config"\]/);
    assert.match(source, /seeds = \[b"vault", mint\.key\(\)\.as_ref\(\)\]/);
    assert.match(source, /seeds = \[b"deposit", depositor\.key\(\)\.as_ref\(\), &nonce\.to_le_bytes\(\)\]/);
  });
