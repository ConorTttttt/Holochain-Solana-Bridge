/**
 * P0 threat-boundary regressions. PASS means an untrusted local administrator
 * can exploit the DOCUMENTED absence of external checkpoint authentication.
 * These tests are NOT security fixes or evidence of independent finality.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DepositLedger } from '../src/ledger.mjs';

const genesisHash='FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8';
const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const identity={genesisHash,program,trustedDeploymentSlot:20};
const fingerprint=evidence=>createHash('sha256')
  .update(JSON.stringify(evidence)).digest('hex');

function workspace(t) {
  const dir=mkdtempSync(join(tmpdir(),'obs-auth-boundary-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return dir;
}
function evidence(receipt,outerIndex=0) {
  return {
    kind:'solana-deposit-evidence-v1',
    id:genesisHash+':'+program+':receipt-'+receipt,
    occurrenceId:genesisHash+':'+program+':signed-transaction:outer:'+outerIndex,
    transactionHash:'transaction-'+receipt,
    amountBaseUnits:'250000',
    transactionVerified:true,
    independentConsensusVerified:false,
    creditEligible:false,
    spendableBaseUnits:'0',
    withdrawalAuthorized:false,
  };
}
function readState(path) { return JSON.parse(readFileSync(path,'utf8')); }
function writeState(path,state) { writeFileSync(path,JSON.stringify(state,null,2)+'\n'); }

test('P0 boundary: privileged checkpoint/blockhash rewrite can conceal skipped finalized slots',t=>{
  const file=join(workspace(t),'ledger.json');
  const writer=new DepositLedger(file,identity);
  writer.commit({checkpoint:21,block:{slot:21,blockhash:'real-rpc-reported-21'}});
  writer.close();
  const tampered=readState(file);
  tampered.blocks['21']='attacker-substituted-block';
  tampered.checkpoint=50;
  writeState(file,tampered);
  const reopened=new DepositLedger(file,identity);
  assert.equal(reopened.checkpoint,50);
  assert.equal(reopened.state.blocks['21'],'attacker-substituted-block');
  reopened.close();
});

test('P0 boundary: recomputed unkeyed fingerprint authenticates no attacker-modified deposit amount',t=>{
  const file=join(workspace(t),'ledger.json');
  const item=evidence(1);
  const writer=new DepositLedger(file,identity);
  writer.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},evidence:[item]});
  writer.close();
  const state=readState(file);
  const row=state.processed[item.id];
  row.evidence.amountBaseUnits='999999999';
  row.amountBaseUnits='999999999';
  row.fingerprint=fingerprint(row.evidence);
  writeState(file,state);
  const reopened=new DepositLedger(file,identity);
  assert.equal(reopened.processed[item.id].amountBaseUnits,'999999999');
  assert.equal(reopened.processed[item.id].evidence.creditEligible,false);
  reopened.close();
});

test('P0 boundary: restoring an older intact state undetectably rolls back cursor and receipts',t=>{
  const file=join(workspace(t),'ledger.json');
  const writer=new DepositLedger(file,identity);
  writer.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},evidence:[evidence(1)]});
  const older=readFileSync(file,'utf8');
  writer.commit({checkpoint:22,block:{slot:22,blockhash:'block-22'},evidence:[evidence(2,1)]});
  writer.close();
  assert.equal(Object.keys(readState(file).processed).length,2);
  writeFileSync(file,older);
  const reopened=new DepositLedger(file,identity);
  assert.equal(reopened.checkpoint,21);
  assert.equal(Object.keys(reopened.processed).length,1);
  reopened.close();
});

test('P0 boundary: deleting an unanchored ledger permits fresh empty history',t=>{
  const file=join(workspace(t),'ledger.json');
  const writer=new DepositLedger(file,identity);
  writer.commit({checkpoint:23,block:{slot:23,blockhash:'block-23'},evidence:[evidence(1)]});
  writer.close();
  unlinkSync(file);
  const reopened=new DepositLedger(file,identity);
  assert.equal(reopened.checkpoint,19);
  assert.equal(Object.keys(reopened.processed).length,0);
  reopened.close();
});

test('P0 boundary: separate independent local ledgers can accept the same deposit occurrence',t=>{
  const dir=workspace(t);
  const shared=evidence(1);
  const ledgerA=new DepositLedger(join(dir,'a.json'),identity);
  const ledgerB=new DepositLedger(join(dir,'b.json'),identity);
  assert.deepEqual(ledgerA.commit({checkpoint:21,evidence:[shared]}),
    {checkpoint:21,processed:1});
  assert.deepEqual(ledgerB.commit({checkpoint:21,evidence:[shared]}),
    {checkpoint:21,processed:1});
  ledgerA.close(); ledgerB.close();
});
