/** Real Kit-backed production indexer integration regressions (NOT mock positives).
 * Fixture creates a genuinely signed synthetic *legacy* transaction but NEVER a deposit.
 * Must run under pinned @solana/kit@8.6.0 in Observer CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as edSign} from 'node:crypto';
import {encode58} from '../src/decode.mjs';
import {fetchFinalizedTransaction,sameSolanaExecutionMeta} from '../src/indexer.mjs';

const pub=n=>encode58(Buffer.alloc(32,n));
const genesisHash=pub(10),blockhash=pub(25),previousBlockhash=pub(26);
function rawSuccess(){
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const signer=Buffer.from(publicKey.export({format:'der',type:'spki'})).subarray(-32);
  // Legacy, one readonly signer and no instructions. Entire signed message is
  // authentic Ed25519; the transaction is intentionally NOT an SPL deposit.
  const message=Buffer.concat([Buffer.from([1,0,0,1]),signer,Buffer.alloc(32,15),Buffer.from([0])]);
  const sig=edSign(null,message,privateKey);
  const wire=Buffer.concat([Buffer.from([1]),sig,message]).toString('base64');
  return {version:'legacy',slot:17,transaction:[wire,'base64'],meta:{
    err:null,rewards:[],fee:5000,preBalances:[100000],postBalances:[95000],
  },signature:encode58(sig)};
}
function fixture(changes={}){
  const tx=rawSuccess();
  const blockEntry={version:tx.version,transaction:structuredClone(tx.transaction),
    meta:{...structuredClone(tx.meta),rewards:null}};
  const block={blockhash,previousBlockhash,parentSlot:16,transactions:[blockEntry]};
  changes.mutate?.(tx,block);
  const methods=[];
  const fetchFn=async (_url,init)=>{
    const {method,params}=JSON.parse(init.body);methods.push({method,params});
    const result=method==='getGenesisHash'?genesisHash:
      method==='getTransaction'?tx:method==='getBlock'?block:undefined;
    return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
  };
  return {tx,block,methods,fetchFn};
}
test('source metadata helper accepts ONLY null/empty rewards equivalence',()=>{
  assert.equal(sameSolanaExecutionMeta({err:null,rewards:null,fee:5000},
    {err:null,rewards:[],fee:5000}),true);
  for(const [a,b] of [
    [{err:null,rewards:null,fee:5000},{err:null,rewards:[{pubkey:'x'}],fee:5000}],
    [{err:null,rewards:[],fee:5000},{err:null,fee:5000}],
    [{err:null,rewards:[],fee:5000},{err:null,rewards:[],fee:5001}],
    [{err:null,rewards:[],fee:5000},{err:{InstructionError:[0,0]},rewards:[],fee:5000}],
    [{err:null,rewards:[],preBalances:[1]},{err:null,rewards:[],preBalances:[2]}],
  ])assert.equal(sameSolanaExecutionMeta(a,b),false);
});
test('production fetchFinalizedTransaction accepts signed wire and narrow null/[] normalization',async()=>{
  const {tx,fetchFn,methods}=fixture();
  const result=await fetchFinalizedTransaction({
    rpcUrl:'https://rpc.example',signature:tx.signature,genesisHash,fetchFn,
  });
  assert.equal(result.rpcTransaction.transaction[0],tx.transaction[0]);
  assert.equal(result.creditEligible,false);
  assert.equal(result.independentConsensusVerified,false);
  assert.equal(result.spendableBaseUnits,'0');
  assert.equal(result.withdrawalAuthorized,false);
  assert.equal(methods.find(x=>x.method==='getTransaction').params[1].encoding,'base64');
  assert.equal(methods.find(x=>x.method==='getBlock').params[1].transactionDetails,'full');
});
for(const [label,mutate,pattern] of [
  ['nonempty rewards',(tx,block)=>{block.transactions[0].meta.rewards=[{pubkey:'unexpected'}]},/contradicts/],
  ['missing rewards',(tx,block)=>{delete block.transactions[0].meta.rewards},/contradicts/],
  ['fee mutation',(tx,block)=>{block.transactions[0].meta.fee+=1},/contradicts/],
  ['failed execution mutation',(tx,block)=>{block.transactions[0].meta.err={InstructionError:[0,'InvalidArgument']}},/contradicts/],
  ['token delta mutation',(tx,block)=>{block.transactions[0].meta.preBalances[0]+=1},/contradicts/],
  ['version mutation',(tx,block)=>{block.transactions[0].version=0},/contradicts|version/],
  ['signed wire mutation',(tx,block)=>{block.transactions[0].transaction[0]=Buffer.from('forged').toString('base64')},/signature|wire|transaction|decode/i],
]){
  test('production fetch rejects '+label,async()=>{
    const {tx,fetchFn}=fixture({mutate});
    await assert.rejects(fetchFinalizedTransaction({
      rpcUrl:'https://rpc.example',signature:tx.signature,genesisHash,fetchFn,
    }),pattern);
  });
}
