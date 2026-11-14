/**
 * Read-only original local-validator archive preflight. Not @solana/kit
 * queueVerified admission, independent Solana finality or a Holochain write.
 * Usage: node observer/scripts/verify-pr55-archive-preflight.mjs PATH_TO_UNZIPPED_ARTIFACT
 */
import {createHash,createPublicKey,verify as verifyEd25519} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';

const SHA=x=>createHash('sha256').update(x).digest('hex');
const deny=(ok,code)=>{if(!ok)throw Error('OBS_PR55_PREFLIGHT_REFUSED:'+code)};
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes){
 let n=0n; for(const b of bytes)n=n*256n+BigInt(b);
 let s='';while(n>0n){s=B58[Number(n%58n)]+s;n/=58n}
 for(const b of bytes){if(b!==0)break;s='1'+s}return s;
}
function shortvec(buf,where){let n=0,shift=0,off=where;
 for(let i=0;i<3;i++){deny(off<buf.length,'SHORTVEC_EOF');let v=buf[off++];n|=(v&127)<<shift;if(!(v&128))return[n,off];shift+=7}
 throw Error('OBS_PR55_PREFLIGHT_REFUSED:SHORTVEC_TOO_LONG');
}
function signedTransaction(tx,signature){
 deny(Array.isArray(tx)&&tx.length===2&&tx[1]==='base64','WIRE_REQUIRED');
 const raw=Buffer.from(tx[0],'base64');
 deny(raw.length>72&&raw.toString('base64')===tx[0],'NONCANONICAL_WIRE');
 const [sigCount,p]=shortvec(raw,0);
 deny(sigCount>0&&sigCount<=64&&p+64*sigCount<raw.length,'WIRE_SIGNER_COUNT');
 const msg=raw.subarray(p+64*sigCount);
 let o=0;if(msg[0]&128){deny((msg[0]&127)===0,'UNSUPPORTED_MESSAGE_VERSION');o++}
 deny(o+3<msg.length,'MESSAGE_HEADER');
 const signers=msg[o];o+=3;
 const [count,k]=shortvec(msg,o);o=k;
 deny(count>=signers&&signers===sigCount&&o+32*count+32<=msg.length,'MESSAGE_ACCOUNT_COUNT');
 const keys=[];for(let i=0;i<count;i++)keys.push(msg.subarray(o+i*32,o+(i+1)*32));
 const recentBlockhash=base58(msg.subarray(o+32*count,o+32*count+32));
 const derPrefix=Buffer.from('302a300506032b6570032100','hex');
 for(let i=0;i<sigCount;i++){
  const key=createPublicKey({key:Buffer.concat([derPrefix,keys[i]]),format:'der',type:'spki'});
  deny(verifyEd25519(null,msg,key,raw.subarray(p+64*i,p+64*(i+1))),'ED25519_SIGNATURE');
 }
 deny(base58(raw.subarray(p,p+64))===signature,'SIGNATURE_IDENTITY');
 return {raw,rawSha256:SHA(raw),recentBlockhash,signerCount:sigCount};
}
function normalizedMeta(m){deny(m&&Object.hasOwn(m,'rewards'),'META_REWARDS_MISSING');
 return {...m,rewards:Array.isArray(m.rewards)&&m.rewards.length===0?null:m.rewards};}
function canonical(x){if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
 if(typeof x==='number'){deny(Number.isFinite(x),'NONFINITE_META');return JSON.stringify(x)}
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 deny(x&&typeof x==='object','UNSUPPORTED_CANONICAL');
 const keys=Object.keys(x).sort();deny(keys.every(k=>!['__proto__','constructor','prototype'].includes(k)),'PROTOTYPE_KEY');
 return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';}
export function inspectOriginalArchive(root){
 root=resolve(root);
 const read=name=>{deny(/^[\w.-]+$/.test(name),'ARCHIVE_FILENAME');
  const file=join(root,name);deny(relative(root,file)===name&&statSync(file).isFile(),'ARCHIVE_FILE');
  return readFileSync(file);
 };
 const data=name=>JSON.parse(read(name).toString('utf8'));
 const manifest=read('evidence-manifest.sha256').toString('utf8');
 let count=0;const seen=new Set();
 for(const line of manifest.trim().split('\n')){
  const m=/^([0-9a-f]{64})  \.\/([\w.-]+)$/.exec(line);
  deny(m!==null&&!seen.has(m[2]),'MANIFEST_FORMAT_OR_DUPLICATE');
  seen.add(m[2]);deny(SHA(read(m[2]))===m[1],'MANIFEST_DIGEST:'+m[2]);count++;
 }
 const domain=data('demo-source-domain.json');
 const index=data('sprint1-demo-domain-transactions.json');
 const expectedSha=read('source-commit.txt').toString('utf8').trim();
 deny(/^[0-9a-f]{40}$/.test(expectedSha)&&domain.sourceCommitSha===expectedSha&&
   index.sourceCommitSha===expectedSha,'IMMUTABLE_SOURCE_SHA');
 deny(domain.mode==='demo-domain'&&index.mode==='demo-domain'&&index.complete===true,'DOMAIN_MODE');
 for(const value of [domain,index])for(const [k,v] of Object.entries({creditEligible:false,
   independentConsensusVerified:false,spendableBaseUnits:'0',withdrawalAuthorized:false}))
   deny(value[k]===v,'ECONOMIC_DENIAL_'+k);
 deny(domain.historyComplete===false,'HISTORY_CLAIM');
 deny(domain.genesisHash===index.genesisHash&&domain.programId===index.programId,'CHAIN_IDENTITY');
 deny(domain.initializedScopeHex===domain.scopeHex&&/^[0-9a-f]{64}$/.test(domain.scopeHex),'SCOPE_SHAPE');
 const scope=SHA(Buffer.concat([Buffer.from('HSC/demo-localnet-source-scope/v1'),Buffer.from([0]),
  Buffer.from(domain.genesisHash),Buffer.from([0]),Buffer.from(domain.programId),Buffer.from([0]),
  Buffer.from(domain.mint)]));
 deny(scope===domain.scopeHex,'SCOPE_DERIVATION');
 const deposit=domain.transactions.deposit;
 deny(index.finalized.some(f=>f.signature===deposit.signature&&f.slot===deposit.slot),'DEPOSIT_NOT_INDEXED');
 const tx=data(deposit.getTransactionBase64RawFile).result;
 const block=data(deposit.getBlockBase64RawFile).result;
 deny(tx&&block&&tx.slot===deposit.slot&&tx.meta?.err===null&&
   Array.isArray(block.transactions)&&block.transactions.length>0,'ORIGINAL_RPC_DEPOSIT');
 const verified=signedTransaction(tx.transaction,deposit.signature);
 const occurrences=block.transactions.filter(t=>Array.isArray(t.transaction)&&t.transaction[0]===tx.transaction[0]);
 deny(occurrences.length===1,'CONTAINING_BLOCK_OCCURRENCE');
 deny(canonical(normalizedMeta(occurrences[0].meta))===canonical(normalizedMeta(tx.meta)),'EXECUTION_META');
 deny(tx.transactionIndex===block.transactions.indexOf(occurrences[0]),'CONTAINING_BLOCK_INDEX');
 const fromIndex=index.finalized.find(f=>f.signature===deposit.signature);
 deny(fromIndex.blockhash===block.blockhash&&fromIndex.messageRecentBlockhash===verified.recentBlockhash,
  'SIGNED_BLOCKHASH_BINDING');
 const active=data('demo-domain-active-receipt.json');
 const rpc=data(active.getMultipleAccountsRawFile).result;
 deny(active.genesisHash===domain.genesisHash&&active.programId===domain.programId&&
   active.slot>=deposit.slot&&rpc.context.slot===active.slot&&active.accounts.length===4&&
   rpc.value.length===4,'FOUR_ACCOUNT_FINALIZED_OBSERVATION');
 const wanted=[domain.receipt,domain.config,domain.vault,domain.mint];
 for(let i=0;i<4;i++){
  deny(active.accounts[i].address===wanted[i]&&
    rpc.value[i].owner===active.accounts[i].owner&&
    rpc.value[i].data[0]===active.accounts[i].dataBase64&&
    rpc.value[i].data[1]==='base64','ACCOUNT_IDENTITY_OR_BYTES_'+i);
 }
 // We do not have an immutable DepositLedger or a same-SHA Kit checkout here.
 return {kind:'observer-pr55-original-archive-preflight-v1',sourceCommitSha:expectedSha,
  manifestEntriesVerified:count,genesisHash:domain.genesisHash,program:domain.programId,
  mint:domain.mint,holochainScope:scope,receiptAddress:domain.receipt,
  signature:deposit.signature,slot:deposit.slot,originalSignedWireSha256:verified.rawSha256,
  originalRecentBlockhash:verified.recentBlockhash,originalRpcExecutionMetaSha256:SHA(canonical(tx.meta)),
  originalContainingBlockSha256:SHA(canonical(block)),
  originalActiveFourAccountRpcSidecarSha256:SHA(read(active.getMultipleAccountsRawFile)),
  idlSha256:domain.idlSha256,historyComplete:false,kitQueueVerified:false,
  signedHolochainDeliveryAuthorized:false,creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 try{console.log(JSON.stringify(inspectOriginalArchive(process.argv[2]||'target/localnet-evidence'),null,2));}
 catch(e){console.error(e.message);process.exitCode=1}
}
