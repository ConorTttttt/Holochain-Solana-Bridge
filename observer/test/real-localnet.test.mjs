/** Genuine public-only validator account bytes from SOL run 43499386297, not RPC consensus proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifySnapshot, CLASSIC_TOKEN_PROGRAM } from '../src/verify.mjs';

const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const genesis='FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8';
const mint='7t6r6MTjf6RBMoLtkPmEpK9RkG3fdw28JoimYP61hKy9';
const expected={
  program,
  receipt:'BdR4H8M6pYafRkmEM57ydhH4yGKw2q1KokyvUkxLZ2VH',
  config:'8cgyh99E7fmUyAFshwss8ZQZacpxWTyCm1ApFJFC7999',
  vault:'FsTLDdsAHYtbFCRXk1Px6mi47t1tYQadF42qQP5DWebT',
  mint, scope:'07'.repeat(32),
};
const SHA={
  active:'9f60ad342b67f890b107e0d3e7abfa943efa76fe3553c85a2438e93a17d5504f',
  refunded:'bf6cf24566c84c102cfbed62cf9e627b1b16c6be984abb896098432cf8767b16',
};
function fixture(name) {
  const json=JSON.parse(readFileSync(new URL('../fixtures/localnet-'+name+'-receipt.json',import.meta.url),'utf8'));
  assert.equal(json.programId,program);
  assert.equal(json.genesisHash,genesis);
  assert.deepEqual(json.accounts.map(x=>x.address),
    [expected.receipt,expected.config,expected.vault,expected.mint]);
  const accounts=json.accounts.map(({owner,dataBase64,executable,lamports})=>{
    assert.equal(executable,false);
    assert.ok(lamports>0);
    return {owner,raw:Buffer.from(dataBase64,'base64')};
  });
  assert.deepEqual(accounts.map(x=>x.raw.length),[218,114,165,82]);
  return {slot:json.slot,accounts};
}
test('real generated-IDL localnet active deposit account bytes are canonical via real SDK',async()=>{
  const snapshot=fixture('active');
  assert.equal(snapshot.slot,33);
  const observation=await verifySnapshot({snapshot,expected,genesisHash:genesis,source:'verified-artifact-14073462857'});
  assert.equal(observation.id,[genesis,program,expected.receipt].join(':'));
  assert.equal(observation.receiptDigest,SHA.active);
  assert.equal(observation.amountBaseUnits,'250000');
  assert.equal(observation.activeVaultBaseUnits,'250000');
  assert.equal(observation.activeLiabilitiesBaseUnits,'250000');
  assert.equal(observation.depositNonce,'42017');
  assert.equal(observation.depositor,'G5Ynb1zmxGQTtNB3a2TPFiTLqFxAjo864JSoLySMKhAu');
  assert.equal(observation.recipientCore,'09'.repeat(32));
  assert.equal(observation.holochainScope,'07'.repeat(32));
  assert.equal(observation.configBump,255);
  assert.equal(observation.receiptBump,248);
  assert.equal(observation.state,'active_refundable');
  assert.equal(observation.transactionVerified,false);
  assert.equal(observation.creditEligible,false);
});
test('genuine localnet refund preserves receipt identity but removes active custody',async()=>{
  const observation=await verifySnapshot({
    snapshot:fixture('refunded'),expected,genesisHash:genesis,source:'verified-artifact-14073462857',
  });
  assert.equal(observation.receiptDigest,SHA.refunded);
  assert.equal(observation.refunded,true);
  assert.equal(observation.activeVaultBaseUnits,'0');
  assert.equal(observation.activeLiabilitiesBaseUnits,'0');
  assert.equal(observation.state,'refunded');
  assert.equal(observation.creditEligible,false);
});
test('genuine bytes refuse a substituted token program, receipt or mint',async()=>{
  const good=fixture('active');
  const badVault={...good,accounts:good.accounts.map(x=>({...x}))};
  badVault.accounts[2].owner=program;
  await assert.rejects(verifySnapshot({
    snapshot:badVault,expected,genesisHash:genesis,
  }),/Vault is not a classic SPL/);
  const altered={...expected,receipt:expected.vault};
  await assert.rejects(verifySnapshot({
    snapshot:good,expected:altered,genesisHash:genesis,
  }),/Noncanonical receipt PDA/);
  const badMint={...good,accounts:good.accounts.map(x=>({...x}))};
  badMint.accounts[3].owner=program;
  await assert.rejects(verifySnapshot({
    snapshot:badMint,expected,genesisHash:genesis,
  }),/Mint is not owned/);
  assert.equal(good.accounts[2].owner,CLASSIC_TOKEN_PROGRAM);
});
