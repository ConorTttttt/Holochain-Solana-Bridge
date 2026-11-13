import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import web3 from '@solana/web3.js';
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID } from './sdk-compat.mjs';

const require = createRequire(import.meta.url);

test('pinned Solana CommonJS SDK loads through supported ESM default interop', () => {
  const cjs = require('@solana/web3.js');
  const manifest = require('@solana/web3.js/package.json');
  assert.equal(manifest.version, '1.98.4', 'unreviewed Solana SDK version');
  assert.equal(cjs, web3, 'ESM default must be the CommonJS module exports');
  for (const name of ['Connection', 'Keypair', 'PublicKey', 'SystemProgram',
    'Transaction', 'sendAndConfirmTransaction']) {
    assert.ok(cjs[name], 'missing supported web3.js export: ' + name);
  }
  assert.equal(typeof cjs.LAMPORTS_PER_SOL, 'number');
});

test('upgradeable loader address is the canonical Solana loader-v3 program ID', () => {
  const canonical = 'BPFLoaderUpgradeab1e11111111111111111111111';
  assert.equal(BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58(), canonical);
  assert.equal(BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBuffer().length, 32);
  // If a future SDK begins exporting this constant, do not silently accept a
  // different program owner; only the protocol's canonical address is valid.
  if (web3.BPF_LOADER_UPGRADEABLE_PROGRAM_ID !== undefined) {
    assert.equal(web3.BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58(), canonical);
  }
});
