import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewShadowEvidence } from '../../holochain/transaction-shadow.mjs';

const binding = { genesisHash:'genesis', program:'program', mint:'mint',
  holochainScope:'scope', dnaHash:'dna', agreementHash:'agreement', deploymentEpoch:'1' };
const snapshot = {kind:'solana-receipt-observation-v1', id:'genesis:program:receipt',
  genesisHash:'genesis', program:'program', receiptAddress:'receipt',
  configAddress:'config', vaultAddress:'vault', mint:'mint', depositor:'depositor',
  recipientCore:'recipient', holochainScope:'scope', depositNonce:'10',
  amountBaseUnits:'9007199254740993', finalizedSlot:100,
  receiptDigest:'a'.repeat(64), configDigest:'b'.repeat(64),
  vaultDigest:'c'.repeat(64), mintDigest:'d'.repeat(64),
  mintSupplyBaseUnits:'9007199254740999', activeVaultBaseUnits:'9007199254740993',
  activeLiabilitiesBaseUnits:'9007199254740993', configBump:255, receiptBump:248,
  commitmentRequested:'finalized', transactionVerified:false,
  evidenceTrust:'untrusted_rpc_snapshot', refunded:false,
  state:'active_refundable', creditEligible:false,
  independentConsensusVerified:false, spendableBaseUnits:'0', withdrawalAuthorized:false};
const evidence = { ...Object.fromEntries(['id','program','receiptAddress','configAddress',
  'vaultAddress','mint','depositor','recipientCore','holochainScope','depositNonce',
  'amountBaseUnits','configBump','receiptBump'].map(k=>[k,snapshot[k]])),
  kind:'solana-deposit-evidence-v1', receiptSnapshot:snapshot,
  source:'two_rpc_block_read', sourceTokenAccount:'source',
  signature:'sig', transactionVersion:0, finalizedSlot:80,
  blockhash:'blockhash', transactionHash:'e'.repeat(64),
  instructionPath:'outer:1', cpiPath:'inner:1:0',
  occurrenceId:'genesis:program:sig:outer:1',
  verifiedByRpcClaim:true, transactionVerified:true, independentConsensusVerified:false,
  evidenceTrust:'rpc_finalized_transaction_and_later_account_snapshot',
  observationSlot:100, refundedAtObservation:false,
  limitations:['RPC provider claims are not independent consensus','Deposits remain refundable'],
  creditEligible:false, spendableBaseUnits:'0', withdrawalAuthorized:false};
function denyEconomic(result) {
  assert.equal(result.creditEligible,false);
  assert.equal(result.spendableBaseUnits,'0');
  assert.equal(result.withdrawalAuthorized,false);
  assert.equal(result.independentConsensusVerified,false);
  assert.equal(result.conductorExecuted,false);
}

test('OBS transaction evidence is only quarantined, with no Holochain authority', () => {
  const journal=new Map();
  const out=reviewShadowEvidence(evidence,binding,journal);
  assert.equal(out.verdict,'quarantined');
  denyEconomic(out);
  assert.equal(journal.get(evidence.id).transactionHash,evidence.transactionHash);
});

test('conflicting signed-wire hash or occurrence for same receipt is rejected', () => {
  const journal=new Map();
  reviewShadowEvidence(evidence,binding,journal);
  for(const mutation of [
    {transactionHash:'f'.repeat(64)},
    {signature:'other',occurrenceId:'genesis:program:other:outer:1'},
  ]) {
    const out=reviewShadowEvidence({...evidence,...mutation},binding,journal);
    assert.equal(out.verdict,'rejected');
    assert.ok(out.findings.some(x=>x==='TX_CONFLICTING_TRANSACTION_HASH' ||
      x==='TX_CONFLICTING_OCCURRENCE'));
    denyEconomic(out);
    assert.equal(journal.get(evidence.id).transactionHash,evidence.transactionHash);
  }
});

test('distinct receipts cannot share same source transaction instruction occurrence', () => {
  const journal=new Map();
  reviewShadowEvidence(evidence,binding,journal);
  const anotherSnapshot={...snapshot,id:'genesis:program:other-receipt',receiptAddress:'other-receipt'};
  const out=reviewShadowEvidence({...evidence,id:anotherSnapshot.id,
    receiptAddress:anotherSnapshot.receiptAddress,receiptSnapshot:anotherSnapshot},binding,journal);
  assert.equal(out.verdict,'rejected');
  assert.ok(out.findings.includes('TX_DUPLICATE_INSTRUCTION_OCCURRENCE'));
  assert.equal(journal.size,1);
  denyEconomic(out);
});

test('unsafe instruction indexes and mismatched amounts fail without changing journal', () => {
  const journal=new Map();
  for(const mutation of [
    {cpiPath:'inner:1:9007199254740993'},
    {instructionPath:'outer:9007199254740993',
      cpiPath:'inner:9007199254740993:0',
      occurrenceId:'genesis:program:sig:outer:9007199254740993'},
    {amountBaseUnits:'9007199254740994'},
  ]) {
    const out=reviewShadowEvidence({...evidence,...mutation},binding,journal);
    assert.equal(out.verdict,'rejected');
    assert.equal(journal.size,0);
    denyEconomic(out);
  }
});

test('different DNA journals still permit shadow replay; not global anti-double-spend', () => {
  const a=reviewShadowEvidence(evidence,binding,new Map());
  const b=reviewShadowEvidence(evidence,{...binding,dnaHash:'migrated'},new Map());
  assert.equal(a.verdict,'quarantined');
  assert.equal(b.verdict,'quarantined');
  denyEconomic(a); denyEconomic(b);
});
