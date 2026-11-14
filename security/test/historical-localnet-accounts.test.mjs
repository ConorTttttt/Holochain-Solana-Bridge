/**
 * Independently decode the retained real-localnet four-account RPC fixtures.
 * Historical source data, not independently authenticated validator consensus;
 * not a current-SHA multi-depositor/u64/restart execution.
 * Requires OBS PR #36 fixture overlay; standalone SEC skip is NOT a release pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const fixture=name=>new URL('../../observer/fixtures/localnet-'+name+'-receipt.json',import.meta.url);
const u64=(buf,offset)=>buf.readBigUInt64LE(offset);
test('SEC-RAW-01: retained real localnet receipt/config/vault/mint preserve refund accounting',t=>{
  if(!existsSync(fixture('active'))||!existsSync(fixture('refunded'))){
    t.skip('OBS real-localnet four-account fixtures not overlaid; NOT a release pass');
    return;
  }
  const active=JSON.parse(readFileSync(fixture('active'),'utf8'));
  const refund=JSON.parse(readFileSync(fixture('refunded'),'utf8'));
  assert.equal(active.kind,'localnet-finalized-rpc-account-snapshot-not-consensus-proof');
  assert.equal(refund.kind,active.kind);
  assert.equal(active.genesisHash,refund.genesisHash);
  assert.equal(active.programId,refund.programId);
  assert.equal(active.accounts.length,4);
  assert.equal(refund.accounts.length,4);
  assert.ok(refund.slot>active.slot);
  const decode=fixture=>fixture.accounts.map((account,i)=>{
    assert.equal(account.address,active.accounts[i].address);
    assert.equal(account.owner,active.accounts[i].owner);
    assert.equal(account.executable,false);
    return Buffer.from(account.dataBase64,'base64');
  });
  const [ar,ac,av,am]=decode(active),[rr,rc,rv,rm]=decode(refund);
  assert.deepEqual([ar.length,ac.length,av.length,am.length],[218,114,165,82]);
  assert.deepEqual([rr.length,rc.length,rv.length,rm.length],[218,114,165,82]);
  assert.equal(u64(ar,200),42017n);
  assert.equal(u64(rr,200),42017n);
  assert.equal(u64(ar,208),250000n);
  assert.equal(u64(rr,208),250000n);
  assert.equal(ar[216],0);
  assert.equal(rr[216],1);
  assert.equal(u64(ac,105),250000n);
  assert.equal(u64(av,64),250000n);
  assert.equal(u64(rc,105),0n);
  assert.equal(u64(rv,64),0n);
  assert.equal(u64(am,36),1000000n);
  assert.equal(u64(rm,36),1000000n);
  assert.deepEqual(rr.subarray(0,216),ar.subarray(0,216));
  assert.equal(rr[217],ar[217]);
  assert.equal(u64(ac,105)-u64(rc,105),u64(av,64)-u64(rv,64));
  assert.equal(u64(ac,105)-u64(rc,105),u64(ar,208));
  assert.equal(u64(rc,105),0n);
  assert.equal(u64(rv,64),0n);
});
