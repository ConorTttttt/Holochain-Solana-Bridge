/**
 * Independent SEC adversarial tests of the actual OBS persistent receipt journal.
 * Synthetic non-economic records: never establish consensus or release value.
 * Requires OBS PR #36 in a full integration checkout.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('SEC-LEDGER: replay, conflicting identity, fork and independent journal boundaries', async t => {
  let DepositLedger;
  try {
    ({ DepositLedger }=await import('../../observer/src/ledger.mjs'));
  } catch(e) {
    if(e?.code==='ERR_MODULE_NOT_FOUND' && /observer\/src\/ledger\.mjs/.test(e.message)) {
      t.skip('OBS PR #36 not overlaid; NOT a passing release gate'); return;
    }
    throw e;
  }
  const dir=mkdtempSync(join(tmpdir(),'sec-observer-ledger-'));
  const genesisHash='genesis-fixture', program='program-fixture', trustedDeploymentSlot=10;
  const opts={genesisHash,program,trustedDeploymentSlot};
  const filename=join(dir,'primary.json');
  const entry=Object.freeze({
    kind:'solana-deposit-evidence-v1',id:'genesis:program:receipt-A',
    occurrenceId:'genesis:program:sig-A:outer:0',
    transactionHash:'a'.repeat(64),amountBaseUnits:'9007199254740993',
    creditEligible:false,transactionVerified:true,independentConsensusVerified:false,
  });
  let primary;
  try {
    primary=new DepositLedger(filename,opts);
    assert.equal(primary.commit({checkpoint:10,block:{slot:10,blockhash:'blockA'},
      evidence:[entry]}).processed,1);

    await t.test('identical receipt replay is idempotent; no second entitlement',()=>{
      assert.equal(primary.commit({checkpoint:10,evidence:[entry]}).processed,1);
      assert.equal(Object.keys(primary.processed).length,1);
    });

    await t.test('same receipt with a different occurrence or amount is rejected',()=>{
      assert.throws(()=>primary.commit({checkpoint:10,evidence:[{
        ...entry,occurrenceId:'genesis:program:sig-B:outer:0'}]}),/conflicting duplicate/);
      assert.throws(()=>primary.commit({checkpoint:10,evidence:[{
        ...entry,amountBaseUnits:'9007199254740992'}]}),/conflicting duplicate/);
    });

    await t.test('a second receipt cannot reuse the same instruction occurrence',()=>{
      assert.throws(()=>primary.commit({checkpoint:10,evidence:[{
        ...entry,id:'genesis:program:receipt-B'}]}),/duplicated instruction occurrence/);
    });

    await t.test('same finalized slot cannot be replaced by contradictory blockhash',()=>{
      assert.throws(()=>primary.commit({checkpoint:10,block:{
        slot:10,blockhash:'blockB'},evidence:[]}),/conflicting finalized blockhash/);
    });

    await t.test('an independent journal CAN record the same identity; this is not global uniqueness',()=>{
      const secondary=new DepositLedger(join(dir,'isolated.json'),opts);
      try {
        assert.equal(secondary.commit({checkpoint:10,block:{
          slot:10,blockhash:'blockA'},evidence:[entry]}).processed,1);
        assert.equal(Object.keys(primary.processed).length,1);
        assert.equal(Object.keys(secondary.processed).length,1);
        // This is an explicit limitation, NOT proof of a deployed double payment.
      } finally {secondary.close();}
    });

    primary.close(); primary=null;
    await t.test('reopened journal preserves processed receipt and rejects conflicting replay',()=>{
      const recovered=new DepositLedger(filename,opts);
      try {
        assert.equal(Object.keys(recovered.processed).length,1);
        assert.equal(recovered.commit({checkpoint:10,evidence:[entry]}).processed,1);
        assert.throws(()=>recovered.commit({checkpoint:10,evidence:[{
          ...entry,transactionHash:'b'.repeat(64)}]}),/conflicting duplicate/);
      } finally {recovered.close();}
    });
  } finally {
    primary?.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
