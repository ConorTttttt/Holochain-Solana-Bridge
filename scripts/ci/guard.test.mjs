import test from 'node:test';
import assert from 'node:assert/strict';
import {blockedPath, blockedContent} from './guard.mjs';

test('accepts source paths, example env and non-secret text',()=>{
  for(const path of ['observer/src/verify.mjs','scripts/ci/guard.mjs','.env.example','programs/deposit_prototype/src/lib.rs'])
    assert.equal(blockedPath(path),null);
  assert.equal(blockedContent('public keys are not private credentials'),null);
});
test('rejects generated artifacts and wallet file paths',()=>{
  for(const path of ['target/idl/deposit_prototype.json','target/deploy/a.so','observer/node_modules/x','.env.production','config/wallet-dev.json','program-keypair.json','secret.pem'])
    assert.ok(blockedPath(path),path);
});
test('rejects private key text, token and exported Solana keypair (adversarial)',()=>{
  const priv='-----BEGIN '+'PRIVATE KEY-----\nAAA';
  const token='gh'+'p_'+'A'.repeat(30);
  const solana=JSON.stringify(Array.from({length:64},(_,i)=>i));
  for(const s of [priv,token,solana]) assert.ok(blockedContent(s));
});
