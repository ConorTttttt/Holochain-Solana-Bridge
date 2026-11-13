/** Synthetic wire-level fixtures only; NEVER substitute for real finalized RPC fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { encode58 } from '../src/decode.mjs';
import { deriveBridgeAddresses } from '../src/pda.mjs';
import { attachReceiptObservation, decodeFinalizedWire, verifyDepositCandidates } from '../src/transaction.mjs';
import { CLASSIC_TOKEN_PROGRAM } from '../src/verify.mjs';

const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const system='11111111111111111111111111111111';
const pub=n=>encode58(Buffer.alloc(32,n));
const keysForTests=generateKeyPairSync('ed25519');
const depositor=encode58(keysForTests.publicKey.export({format:'der',type:'spki'}).subarray(-32));
const mint=pub(5),source=pub(4),genesisHash=pub(10),blockhash=pub(11);
const scope='07'.repeat(32),recipientCore='09'.repeat(32);
const b58=x=>encode58(x);
const d=name=>createHash('sha256').update('global:'+name).digest().subarray(0,8);
const accountDiscriminator=name=>[...createHash('sha256').update('account:'+name).digest().subarray(0,8)];

const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const keyBytes=key=>{
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n=0n;for(const c of key)n=n*58n+BigInt(alphabet.indexOf(c));
  const buf=Buffer.alloc(32);for(let i=31;i>=0;i--){buf[i]=Number(n%256n);n/=256n;}
  return buf;
};
const seed=v=>({kind:'const',value:[...Buffer.from(v)]});
const pda=(name,seeds)=>({name,pda:{seeds}});
const field=(name,type)=>({name,type});
function syntheticIdl() {
  return {address:program,
    accounts:['BridgeConfig','DepositReceipt'].map(name=>({name,discriminator:accountDiscriminator(name)})),
    types:[
      {name:'BridgeConfig',type:{kind:'struct',fields:[
        field('admin','pubkey'),field('mint','pubkey'),field('scope',{array:['u8',32]}),
        field('paused','bool'),field('total_active','u64'),field('bump','u8')] }},
      {name:'DepositReceipt',type:{kind:'struct',fields:[
        field('depositor','pubkey'),field('mint','pubkey'),field('vault','pubkey'),
        field('config','pubkey'),field('recipient_core',{array:['u8',32]}),
        field('scope',{array:['u8',32]}),field('nonce','u64'),field('amount','u64'),
        field('refunded','bool'),field('bump','u8')] }},
    ],
    instructions:[
      {name:'initialize',accounts:[
        pda('config',[seed('config')]),
        pda('vault',[seed('vault'),{kind:'account',path:'mint'}]),
      ]},
      {name:'deposit',discriminator:[...d('deposit')],accounts:[
        {name:'depositor'},pda('config',[seed('config')]),{name:'mint'},{name:'source'},
        pda('vault',[seed('vault'),{kind:'account',path:'mint'}]),
        pda('receipt',[seed('deposit'),{kind:'account',path:'depositor'},{kind:'arg',path:'nonce'}]),
        {name:'token_program'},{name:'system_program'},
      ],args:[
        field('nonce','u64'),field('recipient_core',{array:['u8',32]}),field('amount','u64'),
      ]},
    ]};
}
function compiledInstruction(programIndex,indices,data) {
  return Buffer.concat([Buffer.from([programIndex,indices.length,...indices,data.length]),data]);
}
function message(version,keys,instructions,readonly=0) {
  const header=Buffer.from([1,0,readonly]);
  const accounts=Buffer.concat([Buffer.from([keys.length]),...keys.map(keyBytes)]);
  const rest=Buffer.concat([header,accounts,keyBytes(blockhash),Buffer.from([instructions.length]),...instructions]);
  if(version==='legacy')return rest;
  if(version===0)return Buffer.concat([Buffer.from([0x80]),rest,Buffer.from([0])]);
  throw Error('separate v1 builder');
}
function rpcFromMessage(version,messageBytes,meta) {
  const signatureBytes=edSign(null,messageBytes,keysForTests.privateKey);
  const wire=version===1 ?
    Buffer.concat([messageBytes,signatureBytes]) :
    Buffer.concat([Buffer.from([1]),signatureBytes,messageBytes]);
  return {version,slot:500,transaction:[wire.toString('base64'),'base64'],meta,
    expectedSignature:b58(signatureBytes)};
}
const emptyMeta=n=>({
  err:null,preBalances:Array(n).fill(1),postBalances:Array(n).fill(1),
  preTokenBalances:[],postTokenBalances:[],innerInstructions:[],
});
async function twoDeposits() {
  const p=await deriveBridgeAddresses({program,mint,depositor,nonce:42n});
  const q=await deriveBridgeAddresses({program,mint,depositor,nonce:43n});
  const keys=[depositor,p.config,source,p.vault,p.receipt,q.receipt,mint,CLASSIC_TOKEN_PROGRAM,system];
  const deposit=(nonce,amount)=>Buffer.concat([d('deposit'),u64(nonce),
    Buffer.from(recipientCore,'hex'),u64(amount)]);
  const ixs=[
    compiledInstruction(8-0,[0,1,6,2,3,4,7,8],deposit(42,100)),
    compiledInstruction(8-0,[0,1,6,2,3,5,7,8],deposit(43,200)),
  ];
  // Correct program index is 9 when program is added after System to static keys.
  const withProgram=[...keys,program];
  const indices=[[0,1,6,2,3,4,7,8],[0,1,6,2,3,5,7,8]];
  const actualIxs=indices.map((acct,i)=>compiledInstruction(9,acct,deposit(42+i,100*(i+1))));
  // Put the program ID in the readonly section, after the mint/token/system addresses.
  const signed=rpcFromMessage('legacy',message('legacy',withProgram,actualIxs,4),emptyMeta(withProgram.length));
  const meta=signed.meta;
  meta.preBalances[4]=0;meta.postBalances[4]=2039280;
  meta.preBalances[5]=0;meta.postBalances[5]=2039280;
  function token(index,owner,amount) {
    return {accountIndex:index,mint,owner,programId:CLASSIC_TOKEN_PROGRAM,
      uiTokenAmount:{amount:String(amount),decimals:6,uiAmount:null,uiAmountString:String(amount)}};
  }
  meta.preTokenBalances=[token(2,depositor,1000),token(3,p.config,0)];
  meta.postTokenBalances=[token(2,depositor,700),token(3,p.config,300)];
  const transfer=amount=>Buffer.concat([Buffer.from([12]),u64(amount),Buffer.from([6])]);
  meta.innerInstructions=[
    {index:0,instructions:[{programIdIndex:7,accounts:[2,6,3,0],data:b58(transfer(100)),stackHeight:2}]},
    {index:1,instructions:[{programIdIndex:7,accounts:[2,6,3,0],data:b58(transfer(200)),stackHeight:2}]},
  ];
  return {rpcTransaction:signed,expected:{program,mint,scope,config:p.config,vault:p.vault},receipts:[p.receipt,q.receipt]};
}
test('Kit decodes signed legacy and v0 wire message formats',()=>{
  const keys=[depositor];
  for(const version of ['legacy',0]){
    const tx=rpcFromMessage(version,message(version,keys,[],0),emptyMeta(1));
    const decoded=decodeFinalizedWire(tx,tx.expectedSignature);
    assert.equal(decoded.compiledMessage.version,version);
    assert.equal(decoded.instructions.length,0);
  }
});
test('Kit decodes transaction-v1 message-first envelope with inline keys',()=>{
  // 0x81 version; header, config mask, blockhash, instruction count, addresses,
  // signatures trail the v1 message. No ALTs, no ComputeBudget instruction.
  const v1=Buffer.concat([
    Buffer.from([0x81,1,0,0]),Buffer.alloc(4),
    keyBytes(blockhash),Buffer.from([0,1]),keyBytes(depositor),
  ]);
  const tx=rpcFromMessage(1,v1,emptyMeta(1));
  const decoded=decodeFinalizedWire(tx,signature);
  assert.equal(decoded.compiledMessage.version,1);
  assert.equal(decoded.compiledMessage.staticAccounts.length,1);
  assert.equal(decoded.instructions.length,0);
});
test('rejects unsupported version and mismatched signature/metadata',()=>{
  const tx=rpcFromMessage('legacy',message('legacy',[depositor],[],0),emptyMeta(1));
  assert.throws(()=>decodeFinalizedWire({...tx,version:2},signature),/unsupported/);
  assert.throws(()=>decodeFinalizedWire(tx,'different'),/signature/);
  assert.throws(()=>decodeFinalizedWire({...tx,meta:{...tx.meta,err:{InstructionError:[0,'bad']}}},signature),/failed/);
});
test('2 separate deposit instructions produce 2 immutable receipt identities and exact totals',async()=>{
  const {rpcTransaction,expected,receipts}=await twoDeposits();
  const found=await verifyDepositCandidates({
    rpcTransaction,signature:rpcTransaction.expectedSignature,expected,genesisHash,idl:syntheticIdl(),
    finalizedClaim:true,blockhash,
  });
  assert.equal(found.length,2);
  assert.deepEqual(found.map(x=>x.receiptAddress),receipts);
  assert.deepEqual(found.map(x=>x.amountBaseUnits),['100','200']);
  assert.notEqual(found[0].occurrenceId,found[1].occurrenceId);
  assert.equal(found[0].creditEligible,false);
  assert.equal(found[0].transactionVerified,true);
  assert.equal(found[0].independentConsensusVerified,false);
  const cand=found[0];
  const observation={
    kind:'solana-receipt-observation-v1',creditEligible:false,transactionVerified:false,
    ...Object.fromEntries(['id','program','receiptAddress','configAddress','vaultAddress',
      'mint','depositor','recipientCore','holochainScope','depositNonce','amountBaseUnits',
      'configBump','receiptBump'].map(k=>[k,cand[k]])),
    finalizedSlot:501,refunded:false,
  };
  assert.equal(attachReceiptObservation(cand,observation).creditEligible,false);
  assert.throws(()=>attachReceiptObservation(cand,{...observation,recipientCore:'00'.repeat(32)}),
    /snapshot mismatch/);
});
test('rejects fabricated vault delta, source delta, missing CPI, and substituted transaction source',async()=>{
  const {rpcTransaction,expected}=await twoDeposits();
  const args={signature:rpcTransaction.expectedSignature,expected,genesisHash,idl:syntheticIdl(),finalizedClaim:true,blockhash};
  await assert.rejects(verifyDepositCandidates({...args,
    rpcTransaction:{...rpcTransaction,meta:{...rpcTransaction.meta,
      postTokenBalances:rpcTransaction.meta.postTokenBalances.map(x=>
        x.accountIndex===3 ? {...x,uiTokenAmount:{...x.uiTokenAmount,amount:'299'}} : x)}}
  }),/delta mismatch/);
  await assert.rejects(verifyDepositCandidates({...args,
    rpcTransaction:{...rpcTransaction,meta:{...rpcTransaction.meta,innerInstructions:[]}}
  }),/TransferChecked/);
  await assert.rejects(verifyDepositCandidates({...args,expected:{...expected,vault:pub(40)},
    rpcTransaction}),/noncanonical pinned config\/vault/);
});

test('rejects a matching RPC signature string if Ed25519 signature bytes are forged',async()=>{
  const {rpcTransaction,expected}=await twoDeposits();
  const corrupted=Buffer.from(rpcTransaction.transaction[0],'base64');
  corrupted[20]^=1; // Change signed bytes, not the signed message.
  const forgedSignature=encode58(corrupted.subarray(1,65));
  await assert.rejects(verifyDepositCandidates({
    rpcTransaction:{...rpcTransaction,transaction:[corrupted.toString('base64'),'base64']},
    signature:forgedSignature,expected,genesisHash,idl:syntheticIdl(),
    finalizedClaim:true,blockhash,
  }),/invalid Ed25519 transaction signature/);
});

test('v0 lookup-table address metadata must be fully resolved; refuses missing ALT data',()=>{
  const base=message(0,[depositor],[],0);
  // Replace trailing v0 zero-ALT count with one lookup table:
  // table pubkey, one writable index 3, one readonly index 4.
  const withALT=Buffer.concat([
    base.subarray(0,-1),Buffer.from([1]),keyBytes(pub(40)),
    Buffer.from([1,3,1,4]),
  ]);
  const tx=rpcFromMessage(0,withALT,{
    ...emptyMeta(3),
    loadedAddresses:{writable:[pub(41)],readonly:[pub(42)]},
  });
  const decoded=decodeFinalizedWire(tx,tx.expectedSignature);
  assert.equal(decoded.compiledMessage.version,0);
  assert.equal(decoded.compiledMessage.addressTableLookups.length,1);
  assert.throws(()=>decodeFinalizedWire({
    ...tx,meta:{...tx.meta,loadedAddresses:undefined},
  },tx.expectedSignature),/lookup resolution unavailable/);
});
