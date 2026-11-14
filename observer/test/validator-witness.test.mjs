import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preflightValidatorWitness } from '../scripts/replay-validator-witness.mjs';

/*
 * Structural fail-closed tests, NOT invented signed transactions or validator
 * inclusion tests. The real fixture originated in SOL's local-validator CI,
 * but it contains only account-state evidence and a reported signature.
 */
const realAccountFixture = JSON.parse(readFileSync(
  new URL('../fixtures/localnet-active-receipt.json',import.meta.url),'utf8'));
const digest = value => createHash('sha256').update(value).digest('hex');
function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'obs-real-witness-preflight-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const idlPath=join(dir,'idl.json');
  const elfPath=join(dir,'program.so');
  // These two tiny artifacts exercise manifest checks only, not build provenance.
  // No verifier is ever permitted to accept them as genuine deposit evidence.
  const idl=JSON.stringify({address:realAccountFixture.programId});
  const elf=Buffer.from('not a compiled Solana program');
  writeFileSync(idlPath,idl);
  writeFileSync(elfPath,elf);
  const trusted={
    genesisHash:realAccountFixture.genesisHash,
    programId:realAccountFixture.programId,
    sourceCommitSha:'1'.repeat(40),
    idlSha256:digest(idl),elfSha256:digest(elf),
    trustedDeploymentSlot:1,
    expected:{program:realAccountFixture.programId,
      mint:realAccountFixture.accounts[3].address,
      config:realAccountFixture.accounts[1].address,
      vault:realAccountFixture.accounts[2].address,
      scope:'01'.repeat(32)},
  };
  return {dir,mode:'lifecycle',trusted,idlPath,elfPath};
}
test('genuine local-validator account-only snapshot cannot masquerade as a signed witness bundle', t=>{
  const opts=setup(t);
  writeFileSync(join(opts.dir,'active-receipt.json'),JSON.stringify(realAccountFixture));
  assert.throws(()=>preflightValidatorWitness(opts),
    /no such file|ENOENT|no complete validator transaction manifest/);
});
test('corrupt or substituted trusted IDL hash is rejected before any archive acceptance',t=>{
  const opts=setup(t);
  opts.trusted.idlSha256='f'.repeat(64);
  assert.throws(()=>preflightValidatorWitness(opts),
    /generated IDL\/ELF bytes do not match independent binding/);
});
test('untrusted manifest cannot silently replace the program binding',t=>{
  const opts=setup(t);
  opts.trusted.expected.program='11111111111111111111111111111111';
  assert.throws(()=>preflightValidatorWitness(opts),
    /missing independent deployment manifest/);
});
test('the intake never imports a mock Solana SDK or accepts a missing signed bundle',t=>{
  const opts=setup(t);
  const record={...realAccountFixture,sourceCommitSha:opts.trusted.sourceCommitSha,
    idlSha256:opts.trusted.idlSha256,elfSha256:opts.trusted.elfSha256};
  writeFileSync(join(opts.dir,'active-receipt.json'),JSON.stringify(record));
  // A real account snapshot alone is not transaction provenance; the
  // archived signed getTransaction/full base64 getBlock must be available.
  assert.throws(()=>preflightValidatorWitness(opts));
});
