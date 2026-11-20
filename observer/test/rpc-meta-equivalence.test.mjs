import test from 'node:test';
import assert from 'node:assert/strict';
import { sameSolanaExecutionMeta } from '../src/indexer.mjs';

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
