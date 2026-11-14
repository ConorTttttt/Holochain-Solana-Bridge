/**
 * CI-only replay of ORIGINAL finalized Solana local-validator JSON-RPC responses.
 * Requires genuine base64 signed transaction AND complete base64 containing block.
 * Unlike synthetic signed-message tests, the wire bytes originate in the real
 * local validator; unlike consensus proof, a single localhost RPC is not independent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getTransactionDecoder, getCompiledTransactionMessageDecoder, getBase64Encoder } from '@solana/kit';
import { encode58, decodeReceipt } from '../src/decode.mjs';
import { fetchFinalizedTransaction } from '../src/indexer.mjs';
import { sameSolanaExecutionMeta } from '../../scripts/ci/s0-solana-execution-meta.mjs';
import { verifyWireSignatures, verifyDepositCandidates, attachReceiptObservation } from '../src/transaction.mjs';
import { DepositLedger } from '../src/ledger.mjs';
import { makeAuditOnlyEnvelope } from '../../demo/observation-contract.mjs';
import { verifySnapshot } from '../src/verify.mjs';
import { reviewShadow } from '../../holochain/shadow-review.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const root='target/localnet-evidence/';
function load(name) {
  assert.match(name,/^[a-zA-Z0-9-]+(?:\.rpc)?\.json$/,'unsafe witness filename');
  return JSON.parse(readFileSync(root+name,'utf8'));
}
function checkSigned(raw, signature) {
  assert.ok(Array.isArray(raw) && raw.length===2 && raw[1]==='base64');
  const bytes=Buffer.from(raw[0], 'base64');
  assert.ok(bytes.length>0 && bytes.toString('base64')===raw[0],'noncanonical wire');
  const signed=getTransactionDecoder().decode(getBase64Encoder().encode(raw[0]));
  const compiled=getCompiledTransactionMessageDecoder().decode(signed.messageBytes);
  const first=compiled.staticAccounts[0];
  assert.ok(first && signed.signatures[first] instanceof Uint8Array,'first signature missing');
  assert.equal(encode58(signed.signatures[first]),signature,'RPC signature/wire mismatch');
  return { signed, compiled };
}
for (const mode of ['lifecycle','init-capture','u64-max']) {
  test('genuine finalized signed wire and block replay: '+mode,async()=>{
    const index=load('sprint1-'+mode+'-transactions.json');
    assert.equal(index.mode,mode);
    assert.ok(index.genesisHash && index.programId);
    assert.ok(index.finalized.length>0,'empty real validator witness');
    let verified=0, authenticated=0, depositCount=0;
    const signed=new Set(index.transactions.filter(x=>x.signature).map(x=>x.signature));
    assert.equal(index.finalized.length,signed.size,'missing transaction witness');
    for (const item of index.finalized) {
      assert.ok(signed.has(item.signature),'unlisted signature');
      assert.ok(item.getTransactionBase64RawFile && item.getBlockBase64RawFile,
        'signed-wire RPC files missing: SOL source backport or live validator capture required');
      const txEnvelope=load(item.getTransactionBase64RawFile);
      const blockEnvelope=load(item.getBlockBase64RawFile);
      assert.equal(txEnvelope.error,undefined);
      assert.equal(blockEnvelope.error,undefined);
      const tx=txEnvelope.result, block=blockEnvelope.result;
      assert.ok(tx && block);
      assert.equal(tx.slot,item.slot);
      assert.equal(block.blockhash,item.blockhash);
      assert.equal(block.parentSlot,item.parentSlot);
      assert.equal(block.previousBlockhash,item.previousBlockhash);
      assert.deepEqual(tx.meta?.err,item.meta.err);
      const decoded=checkSigned(tx.transaction,item.signature);
      assert.equal(decoded.compiled.version,tx.version);
      await verifyWireSignatures({signedTransaction:decoded.signed,compiledMessage:decoded.compiled});
      authenticated++;
      let occurrences=0;
      for (const candidate of block.transactions) {
        const temp=getTransactionDecoder().decode(getBase64Encoder().encode(candidate.transaction?.[0] || ''));
        const cm=getCompiledTransactionMessageDecoder().decode(temp.messageBytes);
        const sig=encode58(temp.signatures[cm.staticAccounts[0]]);
        if(sig===item.signature) {
          occurrences++;
          assert.deepEqual(candidate.transaction,tx.transaction,'block wire contradicts transaction');
          assert.equal(sameSolanaExecutionMeta(candidate.meta,tx.meta),true,
            'block meta contradicts transaction (all fields except empty rewards null/[])');
        }
      }
      assert.equal(occurrences,1,'signed transaction not unique in finalized block');
      // The actual OBS indexer validates *all* signatures in the containing
      // block and makes an independent getTransaction/getBlock comparison.
      if(tx.meta.err===null) {
        const mockRpc=async (_url, options)=>{
          const req=JSON.parse(options.body);
          assert.equal(req.jsonrpc,'2.0');
          let result;
          if(req.method==='getGenesisHash')result=index.genesisHash;
          else if(req.method==='getTransaction'){
            assert.equal(req.params[0],item.signature);
            assert.equal(req.params[1].encoding,'base64');
            assert.equal(req.params[1].commitment,'finalized');
            result=tx;
          } else if(req.method==='getBlock'){
            assert.equal(req.params[0],item.slot);
            assert.equal(req.params[1].encoding,'base64');
            assert.equal(req.params[1].commitment,'finalized');
            result=block;
          } else throw new Error('unexpected RPC method '+req.method);
          return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
        };
        const result=await fetchFinalizedTransaction({
          rpcUrl:'http://127.0.0.1:8899',signature:item.signature,
          genesisHash:index.genesisHash,fetchFn:mockRpc,
        });
        assert.equal(result.creditEligible,false);
        assert.equal(result.rpcTransaction.slot,item.slot);
        verified++;
        if(mode==='lifecycle'){
          const fixture=load('active-receipt.json');
          if(item.signature===fixture.signatures.deposit){
            const [receipt,config,vault,mint]=fixture.accounts;
            const expected={program:index.programId,mint:mint.address,
              config:config.address,vault:vault.address,
              scope:decodeReceipt(Buffer.from(receipt.dataBase64,'base64')).scope};
            const idl=JSON.parse(readFileSync('target/idl/deposit_prototype.json','utf8'));
            const candidates=await verifyDepositCandidates({
              rpcTransaction:result.rpcTransaction,signature:item.signature,expected,
              genesisHash:index.genesisHash,idl,finalizedClaim:true,
              blockhash:result.blockhash,source:'replayed-original-finalized-localnet-RPC',
            });
            assert.ok(candidates.length>0,'deposit was not cryptographically attributed');
            assert.ok(candidates.some(x=>x.receiptAddress===receipt.address),'wrong receipt');
            assert.ok(candidates.every(x=>x.creditEligible===false &&
              x.independentConsensusVerified===false),'economic/consensus gate violated');

            // Full real-witness handoff: signed localnet deposit -> OBS verified
            // receipt snapshot -> crash-consistent evidence ledger -> inert shadow.
            // Only the SOL local-validator generated these bytes; no fixture
            // constructs or signs a transaction in this test.
            const sourceSnapshot = label => {
              const raw=load(label+'.json');
              assert.equal(raw.genesisHash,index.genesisHash,'snapshot genesis mismatch');
              assert.equal(raw.programId,index.programId,'snapshot program mismatch');
              assert.equal(raw.accounts.length,4,'four-account receipt snapshot required');
              const [rec,cfg,vlt,mnt]=raw.accounts;
              const expectedKeys={...expected,receipt:rec.address,
                config:cfg.address,vault:vlt.address,mint:mnt.address};
              return {raw,expected:expectedKeys,
                snapshot:{slot:raw.slot,accounts:raw.accounts.map(account=>({
                  owner:account.owner,raw:Buffer.from(account.dataBase64,'base64')}))}};
            };
            const active=sourceSnapshot('active-receipt');
            const live=await verifySnapshot({
              snapshot:active.snapshot,expected:active.expected,
              genesisHash:index.genesisHash,source:'original-finalized-localnet-archive',
            });
            assert.equal(live.transactionVerified,false,'account snapshot is not signed history');
            const candidate=candidates.find(x=>x.receiptAddress===receipt.address);
            const evidence=attachReceiptObservation(candidate,live);
            assert.equal(evidence.kind,'solana-deposit-evidence-v1');
            assert.equal(evidence.transactionVerified,true);
            assert.equal(evidence.creditEligible,false);
            assert.equal(evidence.independentConsensusVerified,false);
            // Genuine signed-wire OBS evidence -> SOURCE-ONLY audit envelope.
            // This is not a signed Holochain write; Agent 4 must supply and
            // independently test own-DNA Lair record_observation/readback.
            const prepared=makeAuditOnlyEnvelope({
              evidence,rpcTransaction:result.rpcTransaction,
              expected:{genesisHash:index.genesisHash,program:index.programId,
                mint:expected.mint,holochainScope:expected.scope},
            });
            assert.equal(prepared.kind,'solana-observation-demo-v1');
            assert.equal(prepared.historyIndexed,false);
            assert.equal(prepared.destination.state,'not_bound_or_written');
            assert.equal(prepared.destination.actionHash,null);
            for(const part of [prepared,prepared.source,prepared.witness,prepared.destination]){
              assert.equal(part.creditEligible,false);
              assert.equal(part.independentConsensusVerified,false);
              assert.equal(part.spendableBaseUnits,'0');
              assert.equal(part.withdrawalAuthorized,false);
            }
            mkdirSync('ci-artifacts',{recursive:true});
            writeFileSync('ci-artifacts/demo-source-only-observation.json',
              JSON.stringify(prepared,null,2)+'\n',{flag:'w',mode:0o600});
            console.log('SOURCE_ONLY_DEMO_PREPARED_NO_HOLOCHAIN_WRITE',
              prepared.id,prepared.source.signature);
            const dir=mkdtempSync(join(tmpdir(),'real-localnet-shadow-'));
            const ledgerPath=join(dir,'finalized-ledger.json');
            const ledgerOptions={genesisHash:index.genesisHash,program:index.programId,
              trustedDeploymentSlot:item.slot};
            const binding=Object.freeze({
              genesisHash:index.genesisHash,program:index.programId,mint:expected.mint,
              holochainScope:live.holochainScope,dnaHash:'NOT_DEPLOYED_S0',
              agreementHash:'SHADOW_ONLY_NO_ECONOMICS',deploymentEpoch:'real-localnet-s0',
            });
            const shadowJournal=new Map();
            try {
              const first=new DepositLedger(ledgerPath,ledgerOptions);
              try {
                const committed=first.commit({checkpoint:item.slot,
                  block:{slot:item.slot,blockhash:item.blockhash},evidence:[evidence]});
                assert.equal(committed.processed,1);
                assert.equal(committed.checkpoint,item.slot);
              } finally { first.close(); }
              const restart=new DepositLedger(ledgerPath,ledgerOptions);
              try {
                assert.equal(restart.checkpoint,item.slot,'durable restart lost checkpoint');
                assert.equal(Object.keys(restart.processed).length,1,'restart lost real evidence');
                restart.commit({checkpoint:item.slot,
                  block:{slot:item.slot,blockhash:item.blockhash},evidence:[evidence]});
                assert.equal(Object.keys(restart.processed).length,1,'duplicate added liability');
                assert.throws(()=>restart.commit({checkpoint:item.slot,
                  evidence:[{...evidence,amountBaseUnits:'1'}]}),
                  /conflicting duplicate receipt identity/);
                assert.throws(()=>restart.commit({checkpoint:item.slot,
                  block:{slot:item.slot,blockhash:'contradictory-blockhash'}}),
                  /conflicting finalized blockhash/);
                assert.equal(restart.checkpoint,item.slot);
              } finally { restart.close(); }
              const shadowActive=reviewShadow(live,binding,shadowJournal);
              assert.equal(shadowActive.verdict,'quarantined');
              assert.equal(shadowActive.creditEligible,false);
              assert.equal(shadowActive.withdrawalAuthorized,false);
              const duplicateShadow=reviewShadow(live,binding,shadowJournal);
              assert.equal(duplicateShadow.verdict,'quarantined');
              assert.equal(shadowJournal.size,1,'shadow duplicate created extra receipt');
              const conflicting=reviewShadow({...live,receiptDigest:'f'.repeat(64)},
                binding,shadowJournal);
              assert.equal(conflicting.verdict,'rejected','same-slot contradiction accepted');
              const refunded=sourceSnapshot('refunded-receipt');
              const refundObservation=await verifySnapshot({
                snapshot:refunded.snapshot,expected:refunded.expected,
                genesisHash:index.genesisHash,source:'original-finalized-localnet-archive',
              });
              assert.equal(refundObservation.refunded,true);
              assert.equal(refundObservation.id,live.id,'refund changed receipt identity');
              const shadowRefund=reviewShadow(refundObservation,binding,shadowJournal);
              assert.equal(shadowRefund.verdict,'quarantined','refund shadow not quarantined');
              assert.ok(shadowRefund.findings.includes('REFUND_TRANSITION'));
              assert.equal(shadowRefund.spendableBaseUnits,'0');
              assert.equal(shadowRefund.withdrawalAuthorized,false);
              assert.equal(shadowJournal.size,1);
              assert.throws(()=>issueHolochainCredit(evidence),/CREDITING_DISABLED/);
              assert.throws(()=>authorizeSolanaWithdrawal(evidence),/WITHDRAWALS_DISABLED/);
            } finally { rmSync(dir,{recursive:true,force:true}); }
            depositCount+=candidates.length;
          }
        }
      } else {
        // Failed on-chain transactions cannot be candidates but their signatures
        // still must authenticate. The full block is validated for each success.
        assert.notEqual(tx.meta.err,null);
      }
    }
    assert.equal(authenticated,index.finalized.length);
    assert.ok(verified>0,'no successful finalized transaction passed OBS inclusion verification');
    if(mode==='lifecycle')assert.ok(depositCount>0,'no real deposited receipt attributed by OBS');
  });
}

// CI-owned pinned copies of OBS #36's two boundary tests; real signed-wire
// positive cases above still require exact transaction bytes and signatures.
// Real getBlock({rewards:false}) reports rewards:null while matching getTransaction
// reports rewards:[]; preserve byte-level wire equality separately.
const baseline = Object.freeze({
  err:null, fee:5000, preBalances:[10000,0], postBalances:[5000,5000],
  preTokenBalances:[],postTokenBalances:[],innerInstructions:[],
  logMessages:['Program log: verify'], computeUnitsConsumed:100,
  loadedAddresses:{writable:[],readonly:[]}, status:{Ok:null}, rewards:null,
});
test('RPC rewards null versus empty list is the only accepted normalization',()=>{
  assert.equal(sameSolanaExecutionMeta(baseline,{...baseline,rewards:[]}),true);
  assert.equal(sameSolanaExecutionMeta({...baseline,rewards:[]},baseline),true);
  assert.equal(sameSolanaExecutionMeta(baseline,{...baseline,rewards:null}),true);
  assert.equal(sameSolanaExecutionMeta(baseline,{...baseline,rewards:[{pubkey:'attacker'}]}),false);
  const {rewards,...missing}=baseline;
  assert.equal(sameSolanaExecutionMeta(baseline,missing),false);
});
test('RPC execution, logs, token deltas and loaded ALT addresses remain strict',()=>{
  for(const field of ['err','fee','preBalances','postBalances','preTokenBalances',
    'postTokenBalances','innerInstructions','logMessages','loadedAddresses',
    'computeUnitsConsumed','status']) {
    const other={...baseline,[field]:field === 'fee' ? 1 : ['tampered']};
    assert.equal(sameSolanaExecutionMeta(baseline,other),false,field);
  }
});
