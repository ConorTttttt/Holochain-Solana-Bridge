/**
 * OBS-side importer for A2 PR #47 original two-provider RPC history archive.
 * The producer and its candidate JSON are UNTRUSTED. This module re-opens
 * original request/response sidecars, cross-checks ALL candidate records,
 * and invokes OBS's Kit-backed verifier only when the raw source is complete.
 * No output upgrades the refund history, consensus or economic gates.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalJSON, DENIALS } from './demo-outbox.mjs';

const fail=(code)=>{throw Error('OBS_ARCHIVE_REFUSED:'+code)};
const need=(ok,code)=>{if(!ok)fail(code)};
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const slot=n=>Number.isSafeInteger(n)&&n>=0;
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const blockOpts={commitment:'finalized',encoding:'base64',transactionDetails:'full',
  rewards:false,maxSupportedTransactionVersion:1};
function readJson(base,name){
  need(typeof name==='string'&&/^[A-Za-z0-9_-]+\.rpc\.json$/.test(name),
    'SIDECAR_PATH');
  return JSON.parse(readFileSync(join(base,'rpc',name),'utf8'));
}
function originalResult(base,files,providerId,tag,method,params){
  const file='rpc/'+providerId+'-'+tag+'.rpc.json';
  need(files.has(file),'MISSING_ORIGINAL_SIDECAR_'+method);
  const record=readJson(base,providerId+'-'+tag+'.rpc.json');
  need(record.providerId===providerId&&record.method===method &&
    same(record.params,params) &&
    same(record.request,{jsonrpc:'2.0',id:record.request?.id,method,params}) &&
    Number.isSafeInteger(record.request.id)&&record.request.id>0 &&
    record.transportError===null&&record.response?.jsonrpc==='2.0'&&
    record.response.id===record.request.id&&record.response.error===undefined &&
    Object.hasOwn(record.response,'result')&&record.response.result!==null &&
    record.response.result!==undefined,'INVALID_ORIGINAL_SIDECAR_'+method);
  return record.response.result;
}
/**
 * expectedGenesisHash/fromSlot/toSlot must be pinned outside this untrusted
 * artifact. A successful result still explicitly withholds historyComplete.
 */
export async function verifyProducerHistoryInput({directory,expectedGenesisHash,
  expectedFromSlot,expectedToSlot}){
  need(typeof directory==='string'&&directory.length>0,'DIRECTORY_REQUIRED');
  need(typeof expectedGenesisHash==='string'&&expectedGenesisHash.length>0 &&
    slot(expectedFromSlot)&&expectedFromSlot>0 &&
    slot(expectedToSlot)&&expectedToSlot>=expectedFromSlot,'TRUSTED_HISTORY_BOUNDS');
  const base=resolve(directory);
  const handoff=JSON.parse(readFileSync(join(base,'produced-slot-handoff.json'),'utf8'));
  need(handoff?.kind==='solana-produced-slot-archive-handoff-v1' &&
    handoff.fullHistoryGate==='BLOCKED' &&
    handoff.absentSlotsClassifiedAsEmpty===false &&
    handoff.independentConsensusVerified===false,'PRODUCER_GATE_LAUNDERING');
  for(const [k,v] of Object.entries(DENIALS))need(handoff[k]===v,'PRODUCER_ECONOMIC_DENIAL');
  const archive=handoff.archive;
  need(archive?.kind==='observer-original-two-provider-history-v1' &&
    archive.genesisHash===expectedGenesisHash &&
    archive.fromSlot===expectedFromSlot &&
    archive.toSlot===expectedToSlot &&
    Array.isArray(archive.providers)&&archive.providers.length===2,'SOURCE_BOUNDS_CHANGED');
  need(Array.isArray(handoff.sourceFiles)&&
    handoff.sourceFiles.every(x=>typeof x==='string'&&
      /^rpc\/[A-Za-z0-9_-]+\.rpc\.json$/.test(x)) &&
    new Set(handoff.sourceFiles).size===handoff.sourceFiles.length,
    'ORIGINAL_FILE_INVENTORY');
  const files=new Set(handoff.sourceFiles);
  for(const provider of archive.providers){
    const id=provider.providerId;need(safeId(id),'PROVIDER_ID');
    need(originalResult(base,files,id,'genesis','getGenesisHash',[])===
      expectedGenesisHash,'RAW_GENESIS_CONFLICT');
    need(originalResult(base,files,id,'first-available','getFirstAvailableBlock',[])===
      provider.firstAvailableBlock,'RAW_FIRST_AVAILABLE_CONFLICT');
    need(originalResult(base,files,id,'finalized-tip','getSlot',
      [{commitment:'finalized'}])===provider.finalizedTip,'RAW_FINALIZED_TIP_CONFLICT');
    need(Array.isArray(provider.getBlocks)&&Array.isArray(provider.getBlock),
      'ORIGINAL_RANGE_LISTS_REQUIRED');
    let cursor=expectedFromSlot;
    const produced=[];
    for(const range of provider.getBlocks){
      need(range.method==='getBlocks'&&range.commitment==='finalized' &&
        range.fromSlot===cursor&&slot(range.toSlot)&&range.toSlot<=expectedToSlot,
        'RANGE_GAP_OR_OVERLAP');
      const original=originalResult(base,files,id,
        'getBlocks-'+range.fromSlot+'-'+range.toSlot,'getBlocks',
        [range.fromSlot,range.toSlot,{commitment:'finalized'}]);
      need(same(original,range.result)&&Array.isArray(original),
        'RAW_PRODUCED_SLOT_LIST_CONFLICT');
      produced.push(...original);cursor=range.toSlot+1;
    }
    need(cursor===expectedToSlot+1,'INCOMPLETE_GETBLOCKS_RANGES');
    need(provider.getBlock.length===produced.length,'MISSING_PRODUCED_BLOCKS');
    for(let i=0;i<produced.length;i++){
      const item=provider.getBlock[i],n=produced[i];
      need(slot(n)&&n>=expectedFromSlot&&n<=expectedToSlot &&
        (i===0||n>produced[i-1])&&item?.slot===n&&item.method==='getBlock' &&
        same(item.options,blockOpts),'PRODUCED_BLOCK_ORDER');
      const original=originalResult(base,files,id,'getBlock-'+n,'getBlock',
        [n,blockOpts]);
      need(same(original,item.result)&&Array.isArray(original.transactions),
        'RAW_FULL_BLOCK_CONFLICT');
    }
  }
  // Claimed verified completeness is NOT a source of authority; even a fully
  // covered getBlocks/getBlock interval does not prove empty skipped slots,
  // historical exact refund bank state, or independent Solana consensus.
  const gaps=Array.isArray(handoff.gaps)?handoff.gaps.map(x=>x?.classification):
    fail('GAP_INVENTORY_REQUIRED');
  need(gaps.every(x=>typeof x==='string'&&x.length>0),'MALFORMED_GAP_INVENTORY');
  const result={kind:'observer-pr47-history-import-v1',
    archiveOriginalResponsesCompared:true,historyComplete:false,
    historyIndexed:false,refundDurablyCommitted:false,
    absentSlotsClassifiedAsEmpty:false,independentConsensusVerified:false,
    ...DENIALS,sourceGaps:gaps,
    status:gaps.length?'BLOCKED_SOURCE_GAPS':'BLOCKED_HISTORICAL_REFUND_STATE'};
  if(!gaps.length){
    const {verifyArchivedHistory}=await import('./history.mjs');
    const verified=await verifyArchivedHistory(archive);
    need(verified.twoProviderFullBlocksVerified===true &&
      verified.absentSlotsClassifiedAsEmpty===false,'INCOMPLETE_KIT_VERIFIED_ARCHIVE');
    result.archiveDigest=verified.archiveDigest;
  }
  return Object.freeze(result);
}
