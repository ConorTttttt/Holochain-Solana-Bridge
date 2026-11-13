import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { indexFinalizedRange, rpcRequest } from '../src/indexer.mjs';
import { encode58 } from '../src/decode.mjs';

const pub=n=>encode58(Buffer.alloc(32,n));
const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const genesisHash=pub(10),mint=pub(11),config=pub(12),vault=pub(13),scope='07'.repeat(32);
const disc=x=>[...createHash('sha256').update('account:'+x).digest().subarray(0,8)];
const seeds=(tag,...others)=>[{kind:'const',value:[...Buffer.from(tag)]},...others];
const acct=x=>({kind:'account',path:x}), arg=x=>({kind:'arg',path:x});
const fakeIdl={
  address:program,
  accounts:['BridgeConfig','DepositReceipt'].map(name=>({name,discriminator:disc(name)})),
  types:[
    {name:'BridgeConfig',type:{kind:'struct',fields:[
      {name:'admin',type:'pubkey'},{name:'mint',type:'pubkey'},
      {name:'scope',type:{array:['u8',32]}},{name:'paused',type:'bool'},
      {name:'total_active',type:'u64'},{name:'bump',type:'u8'}]}},
    {name:'DepositReceipt',type:{kind:'struct',fields:[
      {name:'depositor',type:'pubkey'},{name:'mint',type:'pubkey'},
      {name:'vault',type:'pubkey'},{name:'config',type:'pubkey'},
      {name:'recipient_core',type:{array:['u8',32]}},{name:'scope',type:{array:['u8',32]}},
      {name:'nonce',type:'u64'},{name:'amount',type:'u64'},
      {name:'refunded',type:'bool'},{name:'bump',type:'u8'}]}},
  ],
  instructions:[
    {name:'initialize',accounts:[
      {name:'config',pda:{seeds:seeds('config')}},
      {name:'vault',pda:{seeds:seeds('vault',acct('mint'))}},
    ]},
    {name:'deposit',accounts:[
      {name:'config',pda:{seeds:seeds('config')}},
      {name:'vault',pda:{seeds:seeds('vault',acct('mint'))}},
      {name:'receipt',pda:{seeds:seeds('deposit',acct('depositor'),arg('nonce'))}},
    ]},
  ],
};
const idlText=JSON.stringify(fakeIdl);
const expected={program,mint,config,vault,scope,
  idlSha256:createHash('sha256').update(idlText).digest('hex')};
const urls=['https://rpc-a.example','https://rpc-b.example'];
function fixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'obs-rpc-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  return join(directory,'ledger.json');
}
const baseBlock={blockhash:pub(25),previousBlockhash:pub(26),parentSlot:19,transactions:[]};
function rpcMock(options={}) {
  const calls=[];
  return {
    calls,
    fetchFn:async(url,init)=>{
      const req=JSON.parse(init.body);
      calls.push({provider:new URL(url).hostname,method:req.method,params:req.params});
      const isB=url===urls[1];
      let result;
      switch(req.method) {
        case 'getGenesisHash':result=(options.wrongGenesis && isB) ? pub(33):genesisHash; break;
        case 'getFirstAvailableBlock':result=options.pruned && isB ? 21:1;break;
        case 'getSlot':result=100;break;
        case 'getBlocks':result=options.listConflict && isB ? [20,21]:[20];break;
        case 'getBlock':result=options.prunedBlock && isB ? null :
          {...baseBlock,blockhash:options.blockConflict && isB ? pub(44):baseBlock.blockhash,
            transactions:options.unsupported ? [{version:2,meta:{err:null},transaction:[]}]:[]};break;
        default:throw Error('Unexpected '+req.method);
      }
      return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
    },
  };
}
function input(t,options={}) {
  const rpc=rpcMock(options);
  return {...rpc, options:{
    rpcUrls:urls,expected,genesisHash, trustedDeploymentSlot:20,
    idlText, ledgerPath:fixture(t), toSlot:21,fetchFn:rpc.fetchFn,
  }};
}
test('scans produced finalized blocks and commits skipped slots, restart performs no replay',async t=>{
  const {options,calls}=input(t);
  const first=await indexFinalizedRange(options);
  assert.equal(first.checkpoint,21);
  assert.equal(first.processed,0);
  assert.equal(first.creditEligible,false);
  assert.equal(calls.filter(x=>x.method==='getBlock').length,2);
  const restart=await indexFinalizedRange(options);
  assert.equal(restart.alreadyIndexed,true);
  assert.equal(restart.checkpoint,21);
  assert.equal(calls.filter(x=>x.method==='getBlock').length,2);
  assert.equal(calls.find(x=>x.method==='getBlock').params[1].maxSupportedTransactionVersion,1);
  assert.equal(calls.find(x=>x.method==='getBlock').params[1].commitment,'finalized');
});
for(const [name,variation,pattern] of [
  ['provider blockhash disagreement',{blockConflict:true},/disagree about block/],
  ['provider list disagreement',{listConflict:true},/produced-slot enumeration/],
  ['pruned archive',{pruned:true},/historical data pruned/],
  ['missing historical block',{prunedBlock:true},/missing\/pruned finalized block/],
  ['unsupported transaction version',{unsupported:true},/unsupported transaction version/],
  ['different provider genesis',{wrongGenesis:true},/provider genesis mismatch/],
]){
  test('fail closed on '+name,async t=>{
    const {options}=input(t,variation);
    await assert.rejects(indexFinalizedRange(options),pattern);
  });
}
test('RPC transport rejects missing result and explicit error',async()=>{
  const stub=async(_url,request)=>({
    ok:true,json:async()=>({
      jsonrpc:'2.0',id:1,
      ...(JSON.parse(request.body).params[0]==='bad' ? {error:{code:-32000,message:'history pruned'}} : {}),
    }),
  });
  await assert.rejects(rpcRequest(urls[0],'getBlock',[20],stub),/missing RPC getBlock result/);
  await assert.rejects(rpcRequest(urls[0],'getBlock',['bad'],stub),/RPC getBlock error -32000/);
});
