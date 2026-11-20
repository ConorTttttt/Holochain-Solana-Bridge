/**
 * Offline, non-economic historical RPC archive verifier.
 * Requires two separately configured providers' ORIGINAL getBlocks ranges,
 * original base64 getBlock for EVERY enumerated produced slot, finalized
 * tip/pruning bounds, and historical ALT accounts when address tables occur.
 *
 * This verifies consistency of two provider CLAIMS. It is not a Solana
 * consensus or signed checkpoint proof; omitted slots are NEVER called empty.
 */
import {createHash} from 'node:crypto';
import {getBase64Encoder,getTransactionDecoder,getCompiledTransactionMessageDecoder} from '@solana/kit';
import {addressBytes,encode58} from './decode.mjs';
import {signatureOf} from './indexer.mjs';

const need=(v,m)=>{if(!v) throw new Error('Historical archive failed: '+m);};
const verifiedInThisProcess=new WeakSet();
/** An arbitrary JSON object cannot claim a complete replayed history. */
export function isVerifiedHistoryCoverage(record) {
  return !!record && typeof record==='object' && verifiedInThisProcess.has(record);
}
const slot=(n,label)=>{need(Number.isSafeInteger(n)&&n>=0,'invalid '+label);return n;};
const canonical=x=>Array.isArray(x)?x.map(canonical):
  x&&typeof x==='object'?Object.fromEntries(Object.entries(x).sort(([a],[b])=>
    a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const sha256=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const options={commitment:'finalized',encoding:'base64',transactionDetails:'full',
  rewards:false,maxSupportedTransactionVersion:1};
function decodeAccountBase64(value) {
  need(typeof value==='string','missing historical ALT account bytes');
  const bytes=Buffer.from(value,'base64');
  need(bytes.length>=56 && bytes.toString('base64')===value,
    'invalid historical ALT account base64');
  need(bytes.readUInt32LE(0)===1 && (bytes.length-56)%32===0,
    'invalid historical address lookup table layout');
  // LookupTableAccount layout: 56 metadata bytes, then packed 32-byte keys.
  const addresses=[];
  for(let i=56;i<bytes.length;i+=32) addresses.push(encode58(bytes.subarray(i,i+32)));
  return {bytes,addresses};
}
function historicalAlts(provider, entry, slotNumber) {
  if(entry.version==='legacy') return;
  need(entry.version===0 || entry.version===1,'unsupported versioned transaction');
  const wire=entry.transaction;
  need(Array.isArray(wire)&&wire[1]==='base64','missing versioned signed wire');
  const decoded=getTransactionDecoder().decode(getBase64Encoder().encode(wire[0]));
  const message=getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  need(message.version===entry.version,'version contradicts signed message');
  const tables=message.addressTableLookups||[];
  const loaded=entry.meta?.loadedAddresses;
  if (!tables.length) {
    need(!loaded?.writable?.length&&!loaded?.readonly?.length,
      'unexpected loaded addresses on non-lookup transaction');
    return;
  }
  need(Array.isArray(provider.historicalAltAccounts),
    'historical ALT account archive missing for versioned transaction');
  const writable=[],readonly=[];
  for(const table of tables) {
    // Kit's signed compiled lookup table identity, not an RPC-supplied alias.
    const identity=table.lookupTableAddress;
    need(typeof identity==='string','unsupported signed lookup table format');
    addressBytes(identity);
    const matched=provider.historicalAltAccounts.filter(x=>
      x.slot===slotNumber && x.lookupTableAddress===identity);
    need(matched.length===1,'missing/ambiguous ALT at exact historical slot');
    const saved=matched[0];
    need(saved.contextSlot===slotNumber &&
      saved.owner==='AddressLookupTab1e1111111111111111111111111' &&
      saved.commitment==='finalized' &&
      typeof saved.rawBase64==='string',
      'historical ALT account provenance unavailable');
    const account=decodeAccountBase64(saved.rawBase64);
    need(account.bytes.length===saved.space,'ALT bytes/space mismatch');
    for(const index of table.writableIndexes||[]) {
      need(Number.isInteger(index) && account.addresses[index],
        'signed writable ALT index out of historical bounds');
      writable.push(account.addresses[index]);
    }
    for(const index of table.readonlyIndexes||[]) {
      need(Number.isInteger(index) && account.addresses[index],
        'signed readonly ALT index out of historical bounds');
      readonly.push(account.addresses[index]);
    }
  }
  need(same(writable,loaded?.writable) && same(readonly,loaded?.readonly),
    'RPC loaded addresses contradict historical ALT account bytes');
}
function listing(provider,fromSlot,toSlot) {
  need(Array.isArray(provider.getBlocks),'original getBlocks range responses required');
  let next=fromSlot,produced=[];
  for(const range of provider.getBlocks) {
    need(range?.method==='getBlocks' &&
      range.commitment==='finalized' &&
      range.fromSlot===next &&
      Number.isSafeInteger(range.toSlot) && range.toSlot>=next &&
      range.toSlot<=toSlot &&
      Array.isArray(range.result),
      'missing/overlapping/out-of-order produced-slot getBlocks range');
    for (const n of range.result) {
      slot(n,'produced slot');
      need(n>=range.fromSlot && n<=range.toSlot &&
        (produced.length===0 || n>produced.at(-1)),
        'duplicated/out-of-range/nonmonotonic produced slot');
      produced.push(n);
    }
    next=range.toSlot+1;
  }
  need(next===toSlot+1,'getBlocks archive does not enumerate ENTIRE requested interval');
  return produced;
}
export async function verifyArchivedHistory(archive) {
  need(archive?.kind==='observer-original-two-provider-history-v1',
    'unrecognized/non-original historical archive contract');
  const fromSlot=slot(archive.fromSlot,'fromSlot'),toSlot=slot(archive.toSlot,'toSlot');
  need(fromSlot>0 && toSlot>=fromSlot,'invalid historical deployment range');
  addressBytes(archive.genesisHash);
  need(Array.isArray(archive.providers)&&archive.providers.length===2,
    'exactly two separately configured historical providers required');
  const [a,b]=archive.providers;
  need(typeof a.providerId==='string' && typeof b.providerId==='string' &&
    a.providerId!==b.providerId &&
    typeof a.rpcUrl==='string' && typeof b.rpcUrl==='string' &&
    a.rpcUrl!==b.rpcUrl &&
    ['http:','https:'].includes(new URL(a.rpcUrl).protocol) &&
    ['http:','https:'].includes(new URL(b.rpcUrl).protocol),
    'provider identity/endpoint duplication');
  for (const provider of [a,b]) {
    need(provider.genesisHash===archive.genesisHash,'provider genesis mismatch');
    need(slot(provider.firstAvailableBlock,'firstAvailableBlock')<=fromSlot,
      'archive pruned before trusted deployment slot');
    need(slot(provider.finalizedTip,'finalized tip')>=toSlot,
      'provider finalized tip before historical range');
    need(provider.commitment==='finalized','nonfinalized archival RPC bounds');
  }
  const left=listing(a,fromSlot,toSlot),right=listing(b,fromSlot,toSlot);
  need(same(left,right),'providers disagree on original produced-slot enumeration');
  const produced=left,blockhashes={};
  for(const provider of [a,b]) {
    need(Array.isArray(provider.getBlock)&&provider.getBlock.length===produced.length,
      'missing full getBlock for a produced slot');
    const givenSlots=provider.getBlock.map(x=>x.slot);
    need(same(givenSlots,produced),'produced-slot getBlock coverage incomplete');
  }
  let previous=null;
  for(let i=0;i<produced.length;i++) {
    const n=produced[i],l=a.getBlock[i],r=b.getBlock[i];
    for(const record of [l,r]) {
      need(record.method==='getBlock' && same(record.options,options),
        'non-original base64 full-block RPC options');
      const block=record.result;
      need(block&&Array.isArray(block.transactions) &&
        typeof block.blockhash==='string'&&typeof block.previousBlockhash==='string' &&
        slot(block.parentSlot,'block parent')<n,
        'pruned or incomplete produced block');
      addressBytes(block.blockhash);addressBytes(block.previousBlockhash);
    }
    need(same(l.result,r.result),'contradictory provider blocks/forks at '+n);
    const block=l.result;
    if(previous) need(block.parentSlot===previous.slot &&
      block.previousBlockhash===previous.blockhash,'contradictory parent chain');
    const signatures=new Set();
    for(const tx of block.transactions) {
      need(['legacy',0,1].includes(tx.version) &&
        tx.meta && Object.hasOwn(tx.meta,'err'),'unsupported/incomplete transaction metadata');
      const signature=await signatureOf(tx);
      need(!signatures.has(signature),'duplicate transaction signature in full block');
      signatures.add(signature);
      // ALT proof is checked independently against EACH provider's historical
      // table account bytes. Current RPC ALT state is NOT historic state.
      historicalAlts(a,tx,n);historicalAlts(b,tx,n);
    }
    blockhashes[String(n)]=block.blockhash;
    previous={slot:n,blockhash:block.blockhash};
  }
  const coverage=Object.freeze({
    kind:'observer-history-coverage-v1',genesisHash:archive.genesisHash,
    fromSlot,toSlot,producedSlots:Object.freeze([...produced]),
    blockhashes:Object.freeze(blockhashes),twoProviderFullBlocksVerified:true,
    // Omitted slots are not certified empty; no independently attested finality.
    absentSlotsClassifiedAsEmpty:false,independentConsensusVerified:false,
    creditEligible:false,spendableBaseUnits:'0',withdrawalAuthorized:false,
    evidenceTrust:'two_archive_provider_claims_NOT_consensus',
    archiveDigest:sha256(archive),
  });
  verifiedInThisProcess.add(coverage);
  return coverage;
}
