/**
 * CI-only replay of ORIGINAL finalized Solana local-validator JSON-RPC responses.
 * Requires genuine base64 signed transaction AND complete base64 containing block.
 * Unlike synthetic signed-message tests, the wire bytes originate in the real
 * local validator; unlike consensus proof, a single localhost RPC is not independent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTransactionDecoder, getCompiledTransactionMessageDecoder, getBase64Encoder } from '@solana/kit';
import { encode58, decodeReceipt } from '../../observer/src/decode.mjs';
import { fetchFinalizedTransaction } from '../../observer/src/indexer.mjs';
import { verifyWireSignatures, verifyDepositCandidates } from '../../observer/src/transaction.mjs';

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
          assert.deepEqual(candidate.meta,tx.meta,'block meta contradicts transaction');
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
