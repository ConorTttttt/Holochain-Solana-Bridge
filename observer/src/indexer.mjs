/**
 * Historical finalized-block scanner. Two RPC services must report identical history.
 * Their agreement is NOT independent consensus verification. Deposit state remains refundable.
 */
import { createHash } from 'node:crypto';
import { getBase64Encoder, getTransactionDecoder, getCompiledTransactionMessageDecoder } from '@solana/kit';
import { encode58, addressBytes, strictHex32 } from './decode.mjs';
import { observeRpc, reconcileObservations } from './verify.mjs';
import { attachReceiptObservation, decodeFinalizedWire, verifyDepositCandidates, verifyWireSignatures } from './transaction.mjs';
import { DepositLedger } from './ledger.mjs';
import { validateGeneratedIdl } from '../scripts/verify-idl.mjs';

const MAX_VERSION=1, MAX_RANGE=128;
function need(ok, message) { if (!ok) throw new Error('Finalized indexer failed: ' + message); }
function safeSlot(x) { need(Number.isSafeInteger(x) && x >= 0, 'invalid slot');return x; }
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === 'object') return Object.fromEntries(
    Object.entries(x).filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b))
      .map(([k,v])=>[k,canonical(v)]));
  return x;
}
const sameJSON = (a,b) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b));

/** Raw JSON-RPC with explicit error and missing-result checks; credentials never logged. */
export async function rpcRequest(url, method, params, fetchFn=fetch) {
  need(typeof url === 'string' && ['http:','https:'].includes(new URL(url).protocol), 'invalid RPC URL');
  const response = await fetchFn(url,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
    signal:AbortSignal.timeout(20000),
  });
  need(response.ok, 'RPC HTTP failure in '+method);
  const body=await response.json();
  need(body?.jsonrpc==='2.0' && body.id===1,'invalid JSON-RPC envelope in '+method);
  if(body.error) throw new Error('Finalized indexer failed: RPC '+method+' error '+body.error.code+': '+body.error.message);
  need(Object.hasOwn(body,'result'),'missing RPC '+method+' result');
  return body.result;
}
const blockOptions = Object.freeze({
  commitment:'finalized',encoding:'base64',transactionDetails:'full',
  rewards:false,maxSupportedTransactionVersion:MAX_VERSION,
});
const txOptions = Object.freeze({
  commitment:'finalized',encoding:'base64',maxSupportedTransactionVersion:MAX_VERSION,
});
export async function signatureOf(item) {
  need(item?.transaction?.[1]==='base64' && typeof item.transaction[0]==='string', 'raw transaction missing');
  const encoded=item.transaction[0];
  const raw=Buffer.from(encoded,'base64');
  need(raw.length>0 && raw.toString('base64')===encoded,'malformed transaction base64');
  const decoded=getTransactionDecoder().decode(getBase64Encoder().encode(encoded));
  // Kit 8.6 returns an address-keyed SignaturesMap object, not a Map.
  const compiled=getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  need(['legacy',0,1].includes(item.version) && compiled.version===item.version,
    'RPC transaction version contradicts signed wire');
  const firstSigner=compiled.staticAccounts[0];
  const signatures=decoded.signatures;
  need(firstSigner && signatures && typeof signatures==='object' &&
    Object.keys(signatures).length===compiled.header.numSignerAccounts &&
    compiled.staticAccounts.slice(0,compiled.header.numSignerAccounts)
      .every(address=>Object.hasOwn(signatures,address)), 'missing transaction signatures');
  const first=signatures[firstSigner];
  need(first instanceof Uint8Array && first.length===64, 'missing first transaction signature');
  // A failed transaction still belongs to the claimed finalized block. Reject forged
  // signatures on *every* entry before admitting the block or moving the cursor.
  await verifyWireSignatures({compiledMessage:compiled,signedTransaction:decoded});
  return encode58(first);
}
function validateBlock(block,slot) {
  need(block && typeof block==='object', 'missing/pruned finalized block at slot '+slot);
  addressBytes(block.blockhash);
  addressBytes(block.previousBlockhash);
  safeSlot(block.parentSlot);
  need(block.parentSlot<slot, 'invalid block parent slot');
  need(Array.isArray(block.transactions),'missing complete block transactions');
  return block;
}
function validateDeployment(expected,genesisHash, trustedDeploymentSlot, idlText) {
  safeSlot(trustedDeploymentSlot);
  need(trustedDeploymentSlot>0,'trusted deployment slot required');
  addressBytes(genesisHash);
  for (const n of ['program','mint','config','vault']) addressBytes(expected[n]);
  strictHex32(expected.scope);
  need(typeof expected.idlSha256==='string' && /^[0-9a-f]{64}$/.test(expected.idlSha256),
    'trusted generated IDL SHA-256 required');
  need(typeof idlText==='string' && createHash('sha256').update(idlText).digest('hex')===expected.idlSha256,
    'IDL bytes do not match pinned compiled-artifact hash');
  const idl=JSON.parse(idlText);
  validateGeneratedIdl(idl,{expectedProgramId:expected.program});
  return idl;
}
/**
 * Fetch exact wire transaction and its containing block using finalized RPC.
 * Inclusion is verified *within that provider response*, not via a Merkle/consensus proof.
 */
export async function fetchFinalizedTransaction({rpcUrl,signature,genesisHash,fetchFn=fetch}) {
  need(await rpcRequest(rpcUrl,'getGenesisHash',[],fetchFn)===genesisHash,'genesis mismatch');
  const tx=await rpcRequest(rpcUrl,'getTransaction',[signature,txOptions],fetchFn);
  need(tx!==null,'transaction absent/pruned/unfinalized');
  safeSlot(tx.slot);need(tx.slot>0,'invalid transaction slot');
  decodeFinalizedWire(tx,signature);
  const block=validateBlock(await rpcRequest(rpcUrl,'getBlock',[tx.slot,blockOptions],fetchFn),tx.slot);
  // A malformed unrelated transaction makes the containing block incomplete.
  // Do not silently discard it while searching for the desired signature.
  const blockSignatures=await Promise.all(block.transactions.map(signatureOf));
  const identical=block.transactions.filter((_,index)=>blockSignatures[index]===signature);
  need(identical.length===1,'transaction absent/duplicated within claimed finalized block');
  const found={...identical[0],slot:tx.slot};
  need(sameJSON({version:found.version,transaction:found.transaction,meta:found.meta},
    {version:tx.version,transaction:tx.transaction,meta:tx.meta}),
    'getTransaction contradicts containing finalized getBlock');
  return {rpcTransaction:tx,blockhash:block.blockhash,source:new URL(rpcUrl).host,
    finalizedClaim:true, creditEligible:false};
}
/**
 * Scan inclusive finalized slots and commit entire slot's deposits + checkpoint
 * atomically, avoiding duplicate processing after restart.
 * Requires 2 RPC providers; identical responses are still not trustless consensus.
 */
export async function indexFinalizedRange({
  rpcUrls, expected, genesisHash, trustedDeploymentSlot, idlText,
  ledgerPath, toSlot, fetchFn=fetch,
}) {
  need(Array.isArray(rpcUrls) && rpcUrls.length===2 && rpcUrls[0]!==rpcUrls[1],
    'two distinct RPC URLs required for disagreement detection');
  safeSlot(toSlot);
  const idl=validateDeployment(expected,genesisHash,trustedDeploymentSlot,idlText);
  const ledger=new DepositLedger(ledgerPath,{genesisHash,program:expected.program,trustedDeploymentSlot});
  try {
    const start=ledger.checkpoint+1;
    if(toSlot<start) return {checkpoint:ledger.checkpoint,processed:Object.keys(ledger.processed).length,
      alreadyIndexed:true,creditEligible:false};
    for(const url of rpcUrls) {
      need(await rpcRequest(url,'getGenesisHash',[],fetchFn)===genesisHash,'provider genesis mismatch');
      const available=safeSlot(await rpcRequest(url,'getFirstAvailableBlock',[],fetchFn));
      need(available<=start,'historical data pruned before checkpoint: '+new URL(url).host);
      const tip=safeSlot(await rpcRequest(url,'getSlot',[{commitment:'finalized'}],fetchFn));
      need(tip>=toSlot,'provider not finalized through requested range');
    }
    const persistedSlots=Object.keys(ledger.state.blocks).map(Number).sort((a,b)=>a-b);
    let lastSeen=persistedSlots.length ? {
      slot:persistedSlots.at(-1),blockhash:ledger.state.blocks[String(persistedSlots.at(-1))],
    } : null;
    for(let base=start;base<=toSlot;base+=MAX_RANGE) {
      const last=Math.min(toSlot,base+MAX_RANGE-1);
      const lists=await Promise.all(rpcUrls.map(url=>
        rpcRequest(url,'getBlocks',[base,last,{commitment:'finalized'}],fetchFn)));
      need(lists.every(x=>Array.isArray(x)) && sameJSON(lists[0],lists[1]),
        'RPC providers disagree about produced-slot enumeration');
      const slots=lists[0];
      need(slots.every((x,i)=>Number.isSafeInteger(x) && x>=base && x<=last &&
        (!i || slots[i-1]<x)), 'invalid/incomplete ordered slot listing');
      for(const slot of slots) {
        const blocks=await Promise.all(rpcUrls.map(url=>
          rpcRequest(url,'getBlock',[slot,blockOptions],fetchFn)));
        for(const b of blocks) validateBlock(b,slot);
        need(sameJSON(blocks[0],blocks[1]), 'RPC providers disagree about block '+slot);
        const block=blocks[0], evidences=[];
        if(lastSeen) {
          need(block.parentSlot===lastSeen.slot && block.previousBlockhash===lastSeen.blockhash,
            'parent-chain discontinuity: missing/contradictory produced block');
        }
        for(const entry of block.transactions) {
          need(['legacy',0,1].includes(entry.version), 'unsupported transaction version in block '+slot);
          need(entry.meta && Object.hasOwn(entry.meta,'err'),'missing transaction result in block '+slot);
          const signature=await signatureOf(entry);
          if(entry.meta.err!==null) continue; // Failed transactions cannot create a receipt.
          const rpcTransaction={...entry,slot};
          const deposits=await verifyDepositCandidates({
            rpcTransaction,signature,expected,genesisHash,idl,
            finalizedClaim:true,blockhash:block.blockhash,source:'two_rpc_block_read',
          });
          for(const candidate of deposits) {
            const observations=await Promise.all(rpcUrls.map(url=>observeRpc({
              rpcUrl:url,expected:{...expected,receipt:candidate.receiptAddress},
              genesisHash,fetchFn,
            })));
            const reconciled=reconcileObservations(...observations);
            evidences.push(attachReceiptObservation(candidate,reconciled));
          }
        }
        ledger.commit({checkpoint:slot,block:{slot,blockhash:block.blockhash},evidence:evidences});
        lastSeen={slot,blockhash:block.blockhash};
      }
      // getBlocks reports produced slots; gaps are skipped slots only under this
      // RPC-consistency assumption. Never advance if any enumerated block is missing.
      ledger.commit({checkpoint:last});
    }
    return {checkpoint:ledger.checkpoint,processed:Object.keys(ledger.processed).length,
      alreadyIndexed:false,creditEligible:false,evidenceTrust:'two_matching_rpc_provider_claims'};
  } finally { ledger.close(); }
}
