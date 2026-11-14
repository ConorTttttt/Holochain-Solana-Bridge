/**
 * Synthetic schema/denial tests ONLY. These fixtures are NOT Solana deposits,
 * contain no real signatures, and cannot authorize a Holochain write.
 * The actual CI-positive envelope must come from the genuine OBS replay.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeAuditOnlyEnvelope } from './observation-contract.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
function synthetic(){
  const wire=Buffer.from('not-a-signed-transaction-contract-test');
  const expected={
    genesisHash:'synthetic-genesis',program:'synthetic-program',
    mint:'synthetic-mint',holochainScope:'ee'.repeat(32),
  };
  const receiptAddress='synthetic-receipt';
  const base={
    id:expected.genesisHash+':'+expected.program+':'+receiptAddress,
    program:expected.program,mint:expected.mint,holochainScope:expected.holochainScope,
    receiptAddress,depositor:'synthetic-depositor',recipientCore:'aa'.repeat(32),
    depositNonce:'10',amountBaseUnits:'250000',
  };
  const snapshot={
    ...base,kind:'solana-receipt-observation-v1',
    genesisHash:expected.genesisHash,finalizedSlot:33,refunded:false,
    receiptDigest:hash('synthetic receipt bytes'),
    creditEligible:false,transactionVerified:false,
  };
  const evidence={
    ...base,kind:'solana-deposit-evidence-v1',
    verifiedByRpcClaim:true,transactionVerified:true,
    independentConsensusVerified:false,creditEligible:false,
    signature:'synthetic-unverified-signature',transactionVersion:'legacy',
    transactionHash:hash(wire),blockhash:'synthetic-blockhash',instructionPath:'outer:0',
    finalizedSlot:22,observationSlot:33,refundedAtObservation:false,
    receiptSnapshot:snapshot,
  };
  const rpcTransaction={
    slot:22,version:'legacy',transaction:[wire.toString('base64'),'base64'],
    meta:{err:null,fee:5000,logMessages:['synthetic only'],preBalances:[0]},
  };
  return {evidence,rpcTransaction,expected};
}
test('schema projection denies credit/withdrawal in every nested record',()=>{
  const original=synthetic();
  const record=makeAuditOnlyEnvelope(original);
  assert.equal(record.kind,'solana-observation-demo-v1');
  assert.equal(record.status,'signed_transaction_verified_rpc_claim');
  assert.equal(record.historyIndexed,false);
  assert.equal(record.deliveryAuthorized,false);
  assert.equal(record.destination.actionHash,null);
  assert.equal(record.destination.state,'not_bound_or_written');
  assert.match(record.witness.originalRpcMetadataSha256,/^[0-9a-f]{64}$/);
  for(const nested of [record,record.source,record.witness,record.destination]){
    assert.equal(nested.creditEligible,false);
    assert.equal(nested.independentConsensusVerified,false);
    assert.equal(nested.spendableBaseUnits,'0');
    assert.equal(nested.withdrawalAuthorized,false);
  }
  assert.equal(Object.isFrozen(record),true);
});
for(const [name,mutate] of [
  ['wrong program',x=>x.expected.program='different-program'],
  ['wrong genesis',x=>x.expected.genesisHash='different-genesis'],
  ['wrong mint',x=>x.expected.mint='different-mint'],
  ['wrong scope',x=>x.expected.holochainScope='11'.repeat(32)],
  ['forged receipt identity',x=>x.evidence.receiptAddress='other-receipt'],
  ['snapshot amount contradiction',x=>x.evidence.receiptSnapshot.amountBaseUnits='999999'],
  ['snapshot recipient contradiction',x=>x.evidence.receiptSnapshot.recipientCore='bb'.repeat(32)],
  ['snapshot refund contradiction',x=>x.evidence.receiptSnapshot.refunded=true],
  ['nondecimal amount',x=>{x.evidence.amountBaseUnits='2.1';x.evidence.receiptSnapshot.amountBaseUnits='2.1';}],
  ['no verified transaction',x=>x.evidence.transactionVerified=false],
  ['no verified RPC claim',x=>x.evidence.verifiedByRpcClaim=false],
  ['economic grant',x=>x.evidence.creditEligible=true],
  ['nested withdrawal grant',x=>x.evidence.receiptSnapshot.withdrawalAuthorized=true],
  ['false independent finality grant',x=>x.evidence.independentConsensusVerified=true],
  ['tampered original wire',x=>x.rpcTransaction.transaction[0]=Buffer.from('tampered').toString('base64')],
  ['malformed wire',x=>x.rpcTransaction.transaction=['not base64','base64']],
  ['failed execution',x=>x.rpcTransaction.meta.err={InstructionError:[0,1]}],
  ['wrong source transaction slot',x=>x.rpcTransaction.slot=99],
  ['wrong source transaction version',x=>x.rpcTransaction.version=0],
]){
  test('fail closed on '+name,()=>{
    const fixture=structuredClone(synthetic());
    mutate(fixture);
    assert.throws(()=>makeAuditOnlyEnvelope(fixture),/AUDIT_DEMO_REFUSED/);
  });
}
test('refunded snapshot is audit-only and still cannot authorize a record write',()=>{
  const fixture=synthetic();
  fixture.evidence.refundedAtObservation=true;
  fixture.evidence.receiptSnapshot.refunded=true;
  const record=makeAuditOnlyEnvelope(fixture);
  assert.equal(record.status,'refunded_at_observation');
  assert.equal(record.source.refundedAtObservation,true);
  assert.equal(record.withdrawalAuthorized,false);
  assert.equal(record.deliveryAuthorized,false);
});
