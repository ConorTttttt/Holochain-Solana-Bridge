import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DepositLedger } from '../src/ledger.mjs';

// These are negative economic-boundary fixtures, NOT fabricated signed deposits.
const trusted={genesisHash:'isolated-test-genesis',program:'test-program',trustedDeploymentSlot:1};
const safeEvidence=()=>({
  kind:'solana-deposit-evidence-v1', id:'receipt:one', occurrenceId:'sig:outer:0',
  transactionHash:'wirehash', amountBaseUnits:'123', transactionVerified:true,
  creditEligible:false, independentConsensusVerified:false,
  spendableBaseUnits:'0', withdrawalAuthorized:false,
});
function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'obs-shadow-ledger-denial-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return join(dir,'ledger.json');
}
test('ledger refuses economic-field escalation without changing bytes/checkpoint',t=>{
  const path=setup(t),ledger=new DepositLedger(path,trusted);
  try {
    ledger.commit({checkpoint:1,block:{slot:1,blockhash:'first'},evidence:[safeEvidence()]});
    const before=readFileSync(path,'utf8');
    for (const patch of [
      {spendableBaseUnits:'1'}, {withdrawalAuthorized:true},
      {creditEligible:true}, {independentConsensusVerified:true},
    ]) {
      assert.throws(()=>ledger.commit({checkpoint:2,block:{slot:2,blockhash:'other'},
        evidence:[{...safeEvidence(),...patch}]}),/invalid or authoritative deposit evidence/);
      assert.equal(ledger.checkpoint,1);
      assert.equal(readFileSync(path,'utf8'),before,'rejected input must not change durable state');
    }
  } finally {ledger.close();}
});
test('recovery refuses hostile economic flags even after fingerprint recomputation',t=>{
  const path=setup(t);
  const ledger=new DepositLedger(path,trusted);
  try {ledger.commit({checkpoint:1,evidence:[safeEvidence()]});}
  finally {ledger.close();}
  for (const patch of [{spendableBaseUnits:'999'},{withdrawalAuthorized:true}]) {
    const payload=JSON.parse(readFileSync(path,'utf8'));
    const row=payload.processed['receipt:one'];Object.assign(row.evidence,patch);
    row.fingerprint=createHash('sha256').update(JSON.stringify(row.evidence)).digest('hex');
    writeFileSync(path,JSON.stringify(payload));
    const prior=readFileSync(path,'utf8');
    assert.throws(()=>new DepositLedger(path,trusted),/corrupt stored receipt evidence/);
    assert.equal(readFileSync(path,'utf8'),prior);
    assert.equal(existsSync(path+'.lock'),false);
    // restore safe evidence for the independent next case
    const clean=JSON.parse(prior);
    clean.processed['receipt:one'].evidence=safeEvidence();
    clean.processed['receipt:one'].fingerprint=createHash('sha256')
      .update(JSON.stringify(safeEvidence())).digest('hex');
    writeFileSync(path,JSON.stringify(clean));
  }
});
