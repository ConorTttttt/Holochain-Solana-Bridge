import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DepositLedger} from '../src/ledger.mjs';

const genesisHash='FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8';
const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const options={genesisHash,program,trustedDeploymentSlot:5};
const id=genesisHash+':'+program+':receipt-1';
function deposit() {
  return {kind:'solana-deposit-evidence-v1',id,occurrenceId:id+':deposit',
    transactionHash:'deposit-hash',amountBaseUnits:'250000',finalizedSlot:17,
    receiptAddress:'receipt-1',refundedAtObservation:false,
    receiptSnapshot:{refunded:false},
    transactionVerified:true,creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false};
}
function refund(override={}) {
  return {kind:'solana-refund-evidence-v1',id,receiptAddress:'receipt-1',
    depositOccurrenceId:deposit().occurrenceId,depositTransactionHash:deposit().transactionHash,
    amountBaseUnits:'250000',transactionHash:'refund-hash',occurrenceId:id+':refund',
    finalizedSlot:65,signature:'real-signature-is-required-upstream',
    preObservation:{refunded:false,finalizedSlot:17},
    postObservation:{refunded:true,finalizedSlot:65},
    historyCoveredByTwoRpcClaims:true,transactionVerified:true,
    creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false,...override};
}
function filenameFor(t) {
  const dir=mkdtempSync(join(tmpdir(),'obs-refund-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return join(dir,'ledger.json');
}
test('refund revocation and checkpoint are one durable atomic transition', t => {
  const filename=filenameFor(t),ledger=new DepositLedger(filename,options);
  ledger.commit({checkpoint:17,block:{slot:17,blockhash:'deposit-block'},evidence:[deposit()]});
  assert.equal(ledger.receiptState(id),'active_refundable_unverified');
  ledger.commit({checkpoint:65,block:{slot:65,blockhash:'refund-block'},refunds:[refund()]});
  assert.equal(ledger.receiptState(id),'refunded');
  assert.equal(ledger.checkpoint,65);
  ledger.close();
  const reopened=new DepositLedger(filename,options);
  assert.equal(reopened.receiptState(id),'refunded');
  assert.equal(reopened.processed[id].refund.evidence.creditEligible,false);
  assert.equal(reopened.processed[id].refund.evidence.spendableBaseUnits,'0');
  reopened.close();
});
test('incomplete history, conflicting refund, repeat, missing deposit and rollback preserve prior bytes',t=>{
  const filename=filenameFor(t),ledger=new DepositLedger(filename,options);
  ledger.commit({checkpoint:17,evidence:[deposit()]});
  const initial=readFileSync(filename,'utf8');
  const refuse=(r,pattern=/refund|duplicate|incomplete/) => {
    assert.throws(()=>ledger.commit({checkpoint:65,refunds:[r]}),pattern);
    assert.equal(ledger.checkpoint,17);
    assert.equal(readFileSync(filename,'utf8'),initial);
  };
  refuse(refund({historyCoveredByTwoRpcClaims:false}));
  refuse(refund({creditEligible:true}));
  refuse(refund({spendableBaseUnits:'1'}));
  refuse(refund({withdrawalAuthorized:true}));
  refuse(refund({depositOccurrenceId:'other'}));
  refuse(refund({amountBaseUnits:'1'}));
  refuse(refund({postObservation:{refunded:false,finalizedSlot:65}}));
  refuse(refund({finalizedSlot:16}));
  refuse(refund({id:'missing'}));
  ledger.commit({checkpoint:65,refunds:[refund()]});
  const after=readFileSync(filename,'utf8');
  assert.throws(()=>ledger.commit({checkpoint:66,refunds:[refund()]}),/duplicate refund/);
  assert.throws(()=>ledger.commit({checkpoint:64}),/regression/);
  assert.equal(readFileSync(filename,'utf8'),after);
  ledger.close();
});
test('recovery rejects escalated or forged local refund fingerprints but is NOT hostile-host authentication',t=>{
  const filename=filenameFor(t),ledger=new DepositLedger(filename,options);
  ledger.commit({checkpoint:17,evidence:[deposit()]});
  ledger.commit({checkpoint:65,refunds:[refund()]});
  ledger.close();
  const original=JSON.parse(readFileSync(filename,'utf8'));
  const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
  for(const corrupt of [
    row=>{row.refund.evidence.spendableBaseUnits='1';row.refund.fingerprint=digest(row.refund.evidence);},
    row=>{row.refund.evidence.withdrawalAuthorized=true;row.refund.fingerprint=digest(row.refund.evidence);},
    row=>{row.refund.evidence.depositOccurrenceId='forged';row.refund.fingerprint=digest(row.refund.evidence);},
    row=>{row.refund.evidence.postObservation.refunded=false;row.refund.fingerprint=digest(row.refund.evidence);},
    row=>{row.refund.evidence.historyCoveredByTwoRpcClaims=false;row.refund.fingerprint=digest(row.refund.evidence);},
  ]) {
    const copy=structuredClone(original);
    corrupt(copy.processed[id]);
    writeFileSync(filename,JSON.stringify(copy)+'\n');
    assert.throws(()=>new DepositLedger(filename,options),/corrupt/);
    assert.equal(existsSync(filename+'.lock'),false);
  }
  // A hostile host can roll back/rewrite a valid old copy of this unsigned file.
  // A local hash, lock and fsync cannot authenticate monotonicity.
  writeFileSync(filename,JSON.stringify(original)+'\n');
  const clean=new DepositLedger(filename,options);
  assert.equal(clean.receiptState(id),'refunded');
  clean.close();
});
