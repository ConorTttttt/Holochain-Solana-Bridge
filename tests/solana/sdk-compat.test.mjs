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

test('legacy transaction signer coverage distinguishes correctly signed, missing and wrong owner', () => {
  // The transaction is deliberately NOT sent: these are client-side signing
  // checks, and must never be counted as on-chain security rejections.
  const payer = web3.Keypair.generate();
  const tokenOwner = web3.Keypair.generate();
  const wrongOwner = web3.Keypair.generate();
  const destination = web3.Keypair.generate();
  const recentBlockhash = web3.Keypair.generate().publicKey.toBase58();
  const instruction = web3.SystemProgram.transfer({
    fromPubkey: tokenOwner.publicKey,
    toPubkey: destination.publicKey,
    lamports: 1,
  });
  const build = () => new web3.Transaction({
    feePayer: payer.publicKey, recentBlockhash,
  }).add(instruction);

  const correctlySigned = build();
  correctlySigned.sign(payer, tokenOwner);
  assert.equal(correctlySigned.verifySignatures(), true,
    'both fee payer and account owner must sign');
  assert.doesNotThrow(() => correctlySigned.serialize(),
    'complete signatures must serialize successfully');

  const missingOwner = build();
  missingOwner.partialSign(payer);
  assert.equal(missingOwner.verifySignatures(), false,
    'a fee-payer signature alone does not authorize the owner');
  assert.throws(() => missingOwner.serialize(), /signature verification failed|missing signature/i,
    'missing owner signature must fail at the client, before submission');

  const signedByWrongOwner = build();
  signedByWrongOwner.partialSign(payer);
  assert.throws(() => signedByWrongOwner.partialSign(wrongOwner), /unknown signer/i,
    'a different keypair cannot satisfy the declared owner signature');
  assert.equal(signedByWrongOwner.verifySignatures(), false);
  assert.throws(() => signedByWrongOwner.serialize(), /signature verification failed|missing signature/i);

  // This proves only the local transaction assembly contract. A signed
  // but unauthorized depositor/source pair is separately tested on-chain
  // in integration.test.mjs and must have non-null getTransaction.meta.err.
});
