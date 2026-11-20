import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveDemoScope, assertDemoDomainShape, DEMO_SCHEMA,
  DEMO_SCOPE_TAG, ECONOMIC_DENIAL } from './demo-scope.mjs';

const identity = {
  genesisHash: 'CtKTHhEGRKTDykmrzzqDKjxGCmQKtCXDDeZ48LRoJEZQ',
  programId: 'HDBhVaCQ7fsAL9H4dNdPcRnVd2PW4VrBbTGosFitDDwk',
  mint: 'So11111111111111111111111111111111111111112',
};
const sha = 'a'.repeat(64);
const signature = '2'.repeat(87);
function witness(slot, id) {
  const file = id + '-abc.rpc.json';
  return {
    signature: signature.slice(0, -1) + String(slot),
    slot, getTransactionRawFile: file, getTransactionBase64RawFile: file,
    getBlockRawFile: file, getBlockBase64RawFile: file,
  };
}
function fixture() {
  const scope = deriveDemoScope(identity).toString('hex');
  return {
    schema: DEMO_SCHEMA,
    kind: 'disposable-localnet-source-audit-NOT-consensus-proof',
    mode: 'demo-domain', ...identity,
    config: identity.mint, vault: identity.mint, receipt: identity.mint,
    depositor: identity.mint,
    sourceCommitSha: 'b'.repeat(40), idlSha256: sha, elfSha256: sha,
    postSyncSourceSha256: sha, scopeHex: scope, initializedScopeHex: scope,
    recipientCoreHex: 'c'.repeat(64), nonce: '42017', amountBaseUnits: '250000',
    scopeDerivationTag: DEMO_SCOPE_TAG,
    witnessBundle: 'sprint1-demo-domain-transactions.json',
    snapshots: {
      active: 'demo-domain-active-receipt.json',
      refunded: 'demo-domain-refunded-receipt.json',
    },
    transactions: {
      initialize: witness(11, 'init'), deposit: witness(12, 'deposit'),
      refund: witness(13, 'refund'),
    },
    historyComplete: false, economicAuthorization: 'DENIED',
    ...ECONOMIC_DENIAL,
  };
}

test('scope is deterministic, 32-byte, bound to real genesis, program and mint', () => {
  const d = deriveDemoScope(identity);
  assert.equal(d.length, 32);
  assert.deepEqual(d, deriveDemoScope(identity));
  for (const name of Object.keys(identity)) {
    const changed = { ...identity, [name]: identity[name] + '1' };
    assert.notDeepEqual(deriveDemoScope(changed), d, name + ' must change the domain');
  }
  assert.notEqual(d.toString('hex'), '07'.repeat(32));
  assert.notEqual(d.toString('hex'), '2a'.repeat(32));
  assert.throws(() => deriveDemoScope({ ...identity, mint: 'not a base58 asset!' }));
});

test('literal denied economic fields, original witness pointers, no history claim', () => {
  const valid = fixture();
  assert.equal(assertDemoDomainShape(valid), true);
  for (const [key, value] of Object.entries({
    creditEligible: true, independentConsensusVerified: true,
    spendableBaseUnits: '1', withdrawalAuthorized: true, historyComplete: true,
    economicAuthorization: 'GRANTED',
  })) {
    const bad = structuredClone(valid);
    bad[key] = value;
    assert.throws(() => assertDemoDomainShape(bad), 'must refuse ' + key);
  }
  const missing = structuredClone(valid);
  delete missing.independentConsensusVerified;
  assert.throws(() => assertDemoDomainShape(missing));
});

test('falsely described scope, initializer scope, genesis, witness and bad filenames reject', () => {
  const v = fixture();
  for (const [key, value] of Object.entries({
    scopeHex: '07'.repeat(32),
    initializedScopeHex: '2a'.repeat(32),
    genesisHash: v.genesisHash + '1',
    mint: v.mint + '1',
    witnessBundle: 'sprint1-lifecycle-transactions.json',
  })) {
    const bad = structuredClone(v);
    bad[key] = value;
    assert.throws(() => assertDemoDomainShape(bad), 'must refuse ' + key);
  }
  const contradictory = structuredClone(v);
  contradictory.transactions.deposit.signature = contradictory.transactions.initialize.signature;
  assert.throws(() => assertDemoDomainShape(contradictory));
  const escaped = structuredClone(v);
  escaped.transactions.initialize.getBlockRawFile = '../substitute.rpc.json';
  assert.throws(() => assertDemoDomainShape(escaped));
});
