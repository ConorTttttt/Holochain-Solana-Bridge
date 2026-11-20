/** The SOL lane generates every byte on a disposable real validator, not in this test.
 * These JSON-RPC consistency checks do not authenticate signatures or consensus.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
const pathRoot='target/localnet-evidence';
function load(name){
  assert.match(name,/^[A-Za-z0-9-]+(?:\.rpc)?\.json$/,'unsafe fixture name');
  const file=join(pathRoot,name);
  assert.ok(existsSync(file),'missing real validator public-RPC fixture: '+name);
  return JSON.parse(readFileSync(file,'utf8'));
}
for(const mode of ['lifecycle','init-capture','u64-max']){
  test('real localnet finalized transaction and block RPC consistency: '+mode,()=>{
    const evidence=load('sprint1-'+mode+'-transactions.json');
    assert.equal(evidence.kind,'localnet-rpc-finalized-transaction-and-block-evidence-NOT-consensus-proof');
    assert.equal(evidence.mode,mode);
    assert.ok(evidence.genesisHash && evidence.programId);
    const signed=new Set(evidence.transactions.filter(x=>x.signature).map(x=>x.signature));
    assert.ok(signed.size>0,'at least one real signed transaction required');
    assert.equal(evidence.finalized.length,signed.size,'all signed transactions must be included');
    for(const witness of evidence.finalized){
      assert.ok(signed.has(witness.signature));
      const txRpc=load(witness.getTransactionRawFile);
      const blockRpc=load(witness.getBlockRawFile);
      assert.equal(txRpc.error,undefined);
      assert.equal(blockRpc.error,undefined);
      const tx=txRpc.result,block=blockRpc.result;
      assert.ok(tx && block,'real RPC result missing');
      assert.equal(tx.slot,witness.slot);
      assert.ok(tx.transaction?.signatures?.includes(witness.signature));
      assert.equal(block.blockhash,witness.blockhash);
      assert.equal(block.parentSlot,witness.parentSlot);
      assert.equal(block.previousBlockhash,witness.previousBlockhash);
      assert.deepEqual(tx.meta.err,witness.meta.err);
      const matches=block.transactions.filter(item=>item.transaction?.signatures?.includes(witness.signature));
      assert.equal(matches.length,1,'transaction must appear exactly once in containing block');
      assert.deepEqual(matches[0].meta.err,tx.meta.err);
    }
  });
}
for(const label of ['active-receipt','refunded-receipt']){
  test('real localnet original four-account RPC bytes match shadow fixture: '+label,()=>{
    const normalized=load(label+'.json');
    assert.equal(normalized.kind,'localnet-finalized-rpc-account-snapshot-not-consensus-proof');
    const rpc=load(normalized.getMultipleAccountsRawFile);
    assert.equal(rpc.error,undefined);
    assert.equal(rpc.result.context.slot,normalized.slot);
    assert.equal(rpc.result.value.length,normalized.accounts.length);
    for(let i=0;i<normalized.accounts.length;i++){
      const raw=rpc.result.value[i],account=normalized.accounts[i];
      assert.equal(raw.owner,account.owner);
      assert.equal(raw.lamports,account.lamports);
      assert.equal(raw.executable,account.executable);
      assert.deepEqual(raw.data,[account.dataBase64,'base64']);
    }
  });
}
