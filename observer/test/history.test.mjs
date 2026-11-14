import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyArchivedHistory} from '../src/history.mjs';

const genesisHash='FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8';
const hash='11111111111111111111111111111111';
function claims() {
  const provider=(id)=>({
    providerId:id,rpcUrl:'https://'+id+'.example',
    genesisHash,firstAvailableBlock:1,finalizedTip:30,
    commitment:'finalized',
    getBlocks:[{method:'getBlocks',commitment:'finalized',fromSlot:20,
      toSlot:21,result:[20]}],
    getBlock:[{method:'getBlock',slot:20,options:{
      commitment:'finalized',encoding:'base64',transactionDetails:'full',
      rewards:false,maxSupportedTransactionVersion:1,
    },result:{blockhash:hash,previousBlockhash:hash,parentSlot:19,transactions:[]}}],
  });
  return {kind:'observer-original-two-provider-history-v1',
    genesisHash,fromSlot:20,toSlot:21,providers:[provider('a'),provider('b')]};
}
test('two provider ORIGINAL getBlocks + all produced full blocks pass only as RPC claim',async()=>{
  const coverage=await verifyArchivedHistory(claims());
  assert.equal(coverage.kind,'observer-history-coverage-v1');
  assert.deepEqual(coverage.producedSlots,[20]);
  assert.equal(coverage.absentSlotsClassifiedAsEmpty,false,
    'unlisted 21 is not an observed empty block');
  for(const [name,expected] of [['creditEligible',false],
    ['independentConsensusVerified',false],['spendableBaseUnits','0'],
    ['withdrawalAuthorized',false]]) assert.equal(coverage[name],expected);
});
for(const [name,alter] of [
  ['missing getBlocks interval',x=>{x.providers[0].getBlocks[0].toSlot=20;}],
  ['provider slots disagree',x=>{x.providers[1].getBlocks[0].result=[];}],
  ['pruned data',x=>{x.providers[0].firstAvailableBlock=21;}],
  ['unfinalized tip',x=>{x.providers[0].finalizedTip=20;}],
  ['missing produced block',x=>{x.providers[1].getBlock=[];}],
  ['contradictory fork',x=>{x.providers[1].getBlock[0].result.blockhash=genesisHash;}],
  ['same provider',x=>{x.providers[1].rpcUrl=x.providers[0].rpcUrl;}],
  ['wrong genesis',x=>{x.providers[1].genesisHash=hash;}],
  ['json instead of original base64',x=>{x.providers[1].getBlock[0].options.encoding='json';}],
]) {
  test('cannot claim historical coverage with '+name,async()=>{
    const broken=claims();alter(broken);
    await assert.rejects(verifyArchivedHistory(broken),/Historical archive failed/);
  });
}
test('the original selected witness archive is not a full historical history contract',async()=>{
  await assert.rejects(verifyArchivedHistory({
    kind:'observer-original-two-provider-history-v1',genesisHash,fromSlot:5,toSlot:215,
    providers:[],
  }),/exactly two/);
});
