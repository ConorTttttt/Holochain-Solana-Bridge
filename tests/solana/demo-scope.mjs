// Disposable localnet ONLY. This digest is a scope derivation, not a consensus
// proof, a secret, a custody commitment or permission for economic use.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const DEMO_SCOPE_TAG = 'HSC/demo-localnet-source-scope/v1\0';
export const DEMO_SCHEMA = 'HSC/demo-solana-source-domain/v1';
export const ECONOMIC_DENIAL = Object.freeze({
  creditEligible: false,
  independentConsensusVerified: false,
  spendableBaseUnits: '0',
  withdrawalAuthorized: false,
});
const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const HEX32 = /^[0-9a-f]{64}$/;

export function deriveDemoScope({ genesisHash, programId, mint }) {
  for (const [field, value] of Object.entries({ genesisHash, programId, mint })) {
    assert.equal(typeof value, 'string', field + ' must be a base58 string');
    assert.match(value, B58, field + ' must be base58');
  }
  // Explicit NUL-delimited, ordered ASCII identities. Never derive from a
  // historical fixture or an environment-supplied authority/scope override.
  return createHash('sha256').update(DEMO_SCOPE_TAG)
    .update(genesisHash).update('\0').update(programId).update('\0')
    .update(mint).digest();
}

export function assertDemoDomainShape(d) {
  assert.ok(d && typeof d === 'object' && !Array.isArray(d));
  assert.equal(d.schema, DEMO_SCHEMA);
  assert.equal(d.mode, 'demo-domain');
  assert.equal(d.kind, 'disposable-localnet-source-audit-NOT-consensus-proof');
  for (const [key, value] of Object.entries(ECONOMIC_DENIAL)) {
    assert.ok(Object.hasOwn(d, key), 'missing economic denial ' + key);
    assert.equal(d[key], value, 'economic denial changed: ' + key);
  }
  for (const key of ['sourceCommitSha', 'idlSha256', 'elfSha256', 'postSyncSourceSha256']) {
    assert.match(d[key], key === 'sourceCommitSha' ? /^[0-9a-f]{40}$/ : HEX32, key);
  }
  for (const key of ['programId', 'genesisHash', 'mint', 'config', 'vault',
    'receipt', 'depositor']) {
    assert.equal(typeof d[key], 'string', key);
    assert.match(d[key], B58, key);
  }
  for (const key of ['scopeHex', 'initializedScopeHex', 'recipientCoreHex']) {
    assert.match(d[key], HEX32, key);
  }
  assert.equal(d.scopeDerivationTag, DEMO_SCOPE_TAG);
  const derived = deriveDemoScope(d).toString('hex');
  assert.equal(d.scopeHex, derived, 'scope is not derived from this exact localnet domain');
  assert.equal(d.initializedScopeHex, derived, 'executed config scope disagrees');
  assert.notEqual(derived, '07'.repeat(32), 'known lifecycle placeholder');
  assert.notEqual(derived, '2a'.repeat(32), 'known attacker placeholder');
  assert.notEqual(derived, '00'.repeat(32), 'zero placeholder');
  assert.match(d.nonce, /^(0|[1-9][0-9]*)$/);
  assert.match(d.amountBaseUnits, /^[1-9][0-9]*$/);
  assert.equal(d.witnessBundle, 'sprint1-demo-domain-transactions.json');
  assert.deepEqual(d.snapshots, {
    active: 'demo-domain-active-receipt.json',
    refunded: 'demo-domain-refunded-receipt.json',
  });
  for (const stage of ['initialize', 'deposit', 'refund']) {
    const w = d.transactions?.[stage];
    assert.ok(w && typeof w === 'object', 'missing ' + stage + ' witness');
    assert.match(w.signature, B58, stage + ' signature');
    assert.ok(Number.isSafeInteger(w.slot) && w.slot > 0, stage + ' finalized slot');
    for (const field of ['getTransactionRawFile', 'getTransactionBase64RawFile',
      'getBlockRawFile', 'getBlockBase64RawFile']) {
      assert.match(w[field], /^[a-zA-Z0-9-]+\.rpc\.json$/, stage + '/' + field);
    }
  }
  assert.equal(new Set(Object.values(d.transactions).map(w => w.signature)).size, 3,
    'initialize/deposit/refund must have three distinct original signatures');
  assert.equal(d.historyComplete, false);
  assert.equal(d.economicAuthorization, 'DENIED');
  return true;
}
