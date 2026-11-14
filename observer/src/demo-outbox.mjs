/**
 * OBS-owned, audit-only, crash-consistent demo outbox. NO token credits, settlement,
 * Solana consensus proofs or hostile-host rollback protection. This is NOT an
 * arbitrary JSON-to-authenticated-evidence API: queueVerified requires the live
 * DepositLedger and an in-process verified deposit from the OBS verifier.
 */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DepositLedger } from './ledger.mjs';

export const DENIALS=Object.freeze({creditEligible:false, independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false});
export const ROLLBACK_HOLD='HOSTILE_FILE_ROLLBACK_UNPROTECTED';
const DOMAIN='HSC/observer-demo-outbox/v1';
function need(ok,code){if(!ok)throw new Error('OBS_DEMO_REFUSED:'+code);}
function obj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,fields,label){
  need(obj(x)&&Object.keys(x).length===fields.length&&Object.keys(x).every(k=>fields.includes(k)),label+'_SHAPE');
}
function encode(x){
  if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
  if(typeof x==='number'){need(Number.isSafeInteger(x),'NON_CANONICAL_NUMBER');return JSON.stringify(x);}
  if(Array.isArray(x))return '['+x.map(encode).join(',')+']';
  need(obj(x),'NON_CANONICAL_OBJECT');
  const keys=Object.keys(x).sort();
  need(keys.every(k=>!['__proto__','constructor','prototype'].includes(k)),'PROTOTYPE_KEY');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+encode(x[k])).join(',')+'}';
}
export const canonicalJSON=encode;
const sha256=(x)=>createHash('sha256').update(x).digest('hex');
export const domainDigest=(domain,data)=>sha256(Buffer.concat([Buffer.from(domain,'utf8'),Buffer.from([0]),Buffer.from(encode(data),'utf8')]));
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const positive=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&BigInt(x)<(1n<<64n);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58Length(value,bytes){
  if(typeof value!=='string'||!value||[...value].some(ch=>!B58.includes(ch)))return false;
  let n=0n;for(const ch of value)n=n*58n+BigInt(B58.indexOf(ch));
  const decoded=(n===0n?0:Math.ceil(n.toString(16).length/2))+(value.match(/^1+/)?.[0].length||0);
  return decoded===bytes;
}
function deny(x,label){for(const [k,v] of Object.entries(DENIALS))need(x?.[k]===v,label+'_ECONOMIC_DENIAL');}
function scalar(x,label){need(typeof x==='string'&&x.length>0&&x.length<256,label+'_MISSING');return x;}
function wireBytes(tx){
  need(obj(tx)&&Array.isArray(tx.transaction)&&tx.transaction.length===2&&
    tx.transaction[1]==='base64'&&typeof tx.transaction[0]==='string'&&
    tx.transaction[0].length>0,'ORIGINAL_WIRE_MISSING');
  const b=Buffer.from(tx.transaction[0],'base64');
  need(b.length>0&&b.toString('base64')===tx.transaction[0],'NONCANONICAL_WIRE');return b;
}
const BASE=['creditEligible','independentConsensusVerified','spendableBaseUnits','withdrawalAuthorized'];
const SOURCE=['id','occurrenceId','genesisHash','program','mint','holochainScope',
  'receiptAddress','depositor','signature','finalizedSlot','instructionIndex',
  'amountBaseUnits','sourceEventType','witnessDigest','codeVersion','schemaVersion',...BASE];
const PROOF=['evidenceKind','evidenceOrigin','verifiedByRpcClaim','transactionVerified','historyComplete',...BASE];
const ROOT=['kind','schemaVersion','source','proof',...BASE];
function checkObservation(v,expected){
  exact(v,ROOT,'ROOT'); exact(v.source,SOURCE,'SOURCE'); exact(v.proof,PROOF,'PROOF');
  deny(v,'ROOT'); deny(v.source,'SOURCE'); deny(v.proof,'PROOF');
  const s=v.source,p=v.proof;
  need(v.kind==='solana-observation-demo-v1'&&v.schemaVersion==='1'&&s.schemaVersion==='1','VERSION');
  need(s.sourceEventType==='deposit'&&p.evidenceKind==='solana-deposit-evidence-v1'&&
    ['observer_reviewed_outbox','test_only_fixture'].includes(p.evidenceOrigin)&&p.verifiedByRpcClaim===true&&
    p.transactionVerified===true&&p.historyComplete===false,'UNVERIFIED_OR_REFUND');
  for(const k of ['genesisHash','program','mint','holochainScope'])need(s[k]===expected[k],'SCOPE_'+k);
  need(s.id===`${s.genesisHash}:${s.program}:${s.receiptAddress}`&&
    s.occurrenceId===`${s.genesisHash}:${s.program}:${s.signature}:outer:${s.instructionIndex}`,'SOURCE_ID');
  need(Number.isSafeInteger(s.finalizedSlot)&&s.finalizedSlot>0&&
    Number.isInteger(s.instructionIndex)&&s.instructionIndex>=0&&s.instructionIndex<=0xffffffff,'INSTRUCTION');
  need(positive(s.amountBaseUnits)&&hex64(s.witnessDigest)&&hex64(s.holochainScope),
    'AMOUNT_OR_WITNESS');
  for(const field of ['genesisHash','program','mint','receiptAddress','depositor'])
    need(b58Length(s[field],32),'INVALID_PUBKEY_'+field);
  need(b58Length(s.signature,64),'INVALID_SIGNATURE_SHAPE');
  need(typeof s.codeVersion==='string'&&s.codeVersion.length>0&&s.codeVersion.length<=96,'CODE_VERSION');
}
function scopeOf(destination){
  exact(destination,['dnaHash','agentKey','appId','role','zome'],'DESTINATION');
  for(const k of ['dnaHash','agentKey','appId'])scalar(destination[k],'DEST_'+k);
  need(destination.role==='audit'&&destination.zome==='solana_audit'&&
    !/unyt/i.test(destination.appId),'DESTINATION_NOT_CONTROLLED_DEMO');
  return structuredClone(destination);
}
function sourceProof(evidence,ledgerRecord,rpcTransaction,destination,codeVersion,expected,origin){
  need(evidence?.kind==='solana-deposit-evidence-v1'&&evidence.transactionVerified===true&&
    evidence.verifiedByRpcClaim===true&&evidence.refundedAtObservation===false,'NOT_VERIFIED_ACTIVE_DEPOSIT');
  deny(evidence,'EVIDENCE'); deny(evidence.receiptSnapshot,'SNAPSHOT');
  need(evidence.receiptSnapshot?.kind==='solana-receipt-observation-v1'&&
    evidence.receiptSnapshot.transactionVerified===false&&evidence.receiptSnapshot.refunded===false,
    'SNAPSHOT_NOT_LATER_UNTRUSTED');
  need(evidence.receiptSnapshot.finalizedSlot===evidence.observationSlot&&
    evidence.observationSlot>=evidence.finalizedSlot,'SNAPSHOT_ORDER');
  const fields=['id','program','mint','receiptAddress','holochainScope','depositor',
    'recipientCore','depositNonce','amountBaseUnits'];
  for(const k of fields)need(evidence[k]===evidence.receiptSnapshot[k],'SNAPSHOT_FIELD_'+k);
  need(evidence.receiptSnapshot.genesisHash===expected.genesisHash,'SNAPSHOT_GENESIS');
  for(const k of ['program','mint','holochainScope'])need(evidence[k]===expected[k],'SOURCE_SCOPE_'+k);
  need(evidence.id===`${expected.genesisHash}:${expected.program}:${evidence.receiptAddress}`,'EVIDENCE_ID');
  const match=/^outer:(0|[1-9][0-9]*)$/.exec(evidence.instructionPath||'');
  need(match&&Number.isSafeInteger(Number(match[1]))&&Number(match[1])<=0xffffffff,'INSTRUCTION_PATH');
  const instructionIndex=Number(match[1]);
  need(evidence.occurrenceId===`${expected.genesisHash}:${expected.program}:${evidence.signature}:outer:${instructionIndex}`,
    'OCCURRENCE_ID');
  need(positive(evidence.amountBaseUnits)&&/^(0|[1-9][0-9]*)$/.test(evidence.depositNonce),'AMOUNT_NONCE');
  need(obj(ledgerRecord)&&ledgerRecord.refund===undefined&&ledgerRecord.occurrenceId===evidence.occurrenceId&&
    ledgerRecord.transactionHash===evidence.transactionHash&&
    ledgerRecord.amountBaseUnits===evidence.amountBaseUnits&&
    domainDigest('HSC/observer-ledger-evidence-json/v1',ledgerRecord.evidence)===
      domainDigest('HSC/observer-ledger-evidence-json/v1',evidence), 'DURABLE_SOURCE_CONFLICT');
  // Match OBS's original ledger fingerprint (JSON.stringify insertion order).
  need(ledgerRecord.fingerprint===sha256(JSON.stringify(evidence)),'LEDGER_FINGERPRINT_CONFLICT');
  need(rpcTransaction?.slot===evidence.finalizedSlot&&rpcTransaction.version===evidence.transactionVersion&&
    rpcTransaction.meta?.err===null,'RPC_TRANSACTION_IDENTITY');
  const signedWireSha256=sha256(wireBytes(rpcTransaction));
  need(signedWireSha256===evidence.transactionHash&&hex64(signedWireSha256),'SIGNED_WIRE_HASH');
  const components={
    sourceId:evidence.id,occurrenceId:evidence.occurrenceId,
    signedWireSha256,
    rpcExecutionMetadataSha256:domainDigest(DOMAIN+'/rpc-meta',rpcTransaction.meta),
    receiptSnapshotSha256:domainDigest(DOMAIN+'/snapshot',evidence.receiptSnapshot),
    ledgerEvidenceSha256:domainDigest(DOMAIN+'/ledger-evidence',evidence),
    destination,
  };
  const witnessDigest=domainDigest(DOMAIN+'/witness',components);
  const observation={kind:'solana-observation-demo-v1',schemaVersion:'1',...DENIALS,
    source:{...DENIALS,id:evidence.id,occurrenceId:evidence.occurrenceId,
      genesisHash:expected.genesisHash,program:expected.program,mint:expected.mint,
      holochainScope:expected.holochainScope,receiptAddress:evidence.receiptAddress,
      depositor:evidence.depositor,signature:evidence.signature,
      finalizedSlot:evidence.finalizedSlot,instructionIndex,
      amountBaseUnits:evidence.amountBaseUnits,sourceEventType:'deposit',witnessDigest,
      codeVersion,schemaVersion:'1'},
    proof:{...DENIALS,evidenceKind:'solana-deposit-evidence-v1',
      evidenceOrigin:origin,verifiedByRpcClaim:true,
      transactionVerified:true,historyComplete:false}};
  checkObservation(observation,expected);
  return {observation,components};
}
function syncedReplace(filename,state){
  const tmp=filename+'.tmp.'+process.pid;
  let fd;
  try {
    fd=openSync(tmp,'wx',0o600);writeFileSync(fd,JSON.stringify(state,null,2)+'\n');
    fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(tmp,filename);
    const dir=openSync(dirname(filename),'r');try{fsyncSync(dir)}finally{closeSync(dir)}
  }finally{if(fd!==undefined)closeSync(fd);if(existsSync(tmp))unlinkSync(tmp)}
}
function checkRow(row,expected,destination){
  need(obj(row)&&['pending','uncertain','acked','hold'].includes(row.state),'OUTBOX_ROW_STATE');
  checkObservation(row.observation,expected);
  need(canonicalJSON(row.destination)===canonicalJSON(destination),'DESTINATION_CHANGED');
  need(obj(row.components)&&row.components.sourceId===row.observation.source.id&&
    row.components.occurrenceId===row.observation.source.occurrenceId&&
    domainDigest(DOMAIN+'/witness',row.components)===row.observation.source.witnessDigest,'WITNESS_CHANGED');
  need(row.fingerprint===domainDigest(DOMAIN+'/work',{
    observation:row.observation,components:row.components,destination:row.destination
  }),'WORK_FINGERPRINT');
  need(row.state!=='acked'||typeof row.actionHash==='string'&&row.actionHash.length>0,'ACK_WITHOUT_ACTION');
  if(row.state!=='acked')need(row.actionHash===null,'UNACKED_HAS_ACTION');
}
function verifyRemote(remote,row){
  exact(remote,['actionHash','observation',...BASE],'REMOTE_RECORD');deny(remote,'REMOTE_RECORD');
  need(typeof remote.actionHash==='string'&&remote.actionHash.length>0&&
    remote.actionHash.length<256,'ACTION_HASH');
  need(canonicalJSON(remote.observation)===canonicalJSON(row.observation),'CONFLICTING_REMOTE_OBSERVATION');
  return remote.actionHash;
}
export class DemoOutbox {
  constructor(filename,{expected,destination}){
    need(obj(expected),'TRUSTED_SOURCE_PINS');
    for(const k of ['genesisHash','program','mint','holochainScope'])scalar(expected[k],'EXPECTED_'+k);
    this.expected=structuredClone(expected);
    this.destination=scopeOf(destination);
    this.filename=resolve(filename);
    this.inFlight=new Set();
    mkdirSync(dirname(this.filename),{recursive:true,mode:0o700});
    this.lockFile=this.filename+'.lock';this.lockFd=openSync(this.lockFile,'wx',0o600);
    try{
      const initial={version:1,expected:this.expected,destination:this.destination,rows:{}};
      this.state=existsSync(this.filename)?JSON.parse(readFileSync(this.filename,'utf8')):initial;
      need(this.state.version===1&&obj(this.state.rows)&&
        canonicalJSON(this.state.expected)===canonicalJSON(this.expected)&&
        canonicalJSON(this.state.destination)===canonicalJSON(this.destination),'JOURNAL_SCOPE');
      const seen=new Set();
      for(const [id,row] of Object.entries(this.state.rows)){
        checkRow(row,this.expected,this.destination);
        need(id===row.observation.source.id&&!seen.has(row.observation.source.occurrenceId),'REPLAYED_OCCURRENCE');
        seen.add(row.observation.source.occurrenceId);
      }
    }catch(e){this.close();throw e}
  }
  get securityHold(){return ROLLBACK_HOLD;} // NO off-host monotonic checkpoint installed.
  get status(){return {rollbackSecurityHold:this.securityHold,historyComplete:false,
    creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false,
    rows:Object.fromEntries(Object.entries(this.state.rows).map(([k,v])=>[k,{state:v.state,actionHash:v.actionHash}]))};}
  persist(){need(this.lockFd!==null,'CLOSED');syncedReplace(this.filename,this.state)}
  close(){if(this.lockFd!==null){closeSync(this.lockFd);unlinkSync(this.lockFile);this.lockFd=null}}
  /**
   * Real Kit-backed ONLY: obtain original signed-wire plus containing block via
   * the source-owned production indexer, re-verify Ed25519, IDL, SPL transfer,
   * receipt PDA and two-provider later receipt snapshots IN THIS PROCESS.
   * Untrusted caller JSON labels/booleans cannot create a reviewed origin.
   */
  async queueVerified({ledger,rpcUrls,signature,receiptAddress,expected,idl,codeVersion,fetchFn=fetch}){
    need(Array.isArray(rpcUrls)&&rpcUrls.length===2&&
      rpcUrls.every(x=>typeof x==='string'&&/^https?:\/\//.test(x))&&rpcUrls[0]!==rpcUrls[1],
      'TWO_RPC_URLS_REQUIRED');
    need(expected?.program===this.expected.program&&expected?.mint===this.expected.mint&&
      expected?.scope===this.expected.holochainScope&&
      typeof expected.config==='string'&&typeof expected.vault==='string',
      'PINNED_DEPLOYMENT_MISMATCH');
    const [{fetchFinalizedTransaction},{verifyDepositCandidates,attachReceiptObservation},
      {observeRpc,reconcileObservations}]=await Promise.all([
      import('./indexer.mjs'),import('./transaction.mjs'),import('./verify.mjs'),
    ]);
    const fetched=await fetchFinalizedTransaction({
      rpcUrl:rpcUrls[0],signature,genesisHash:this.expected.genesisHash,fetchFn,
    });
    const candidates=await verifyDepositCandidates({
      rpcTransaction:fetched.rpcTransaction,signature,expected,
      genesisHash:this.expected.genesisHash,idl,
      finalizedClaim:fetched.finalizedClaim,blockhash:fetched.blockhash,
      source:'observer_reviewed_demo_original_rpc',
    });
    const matched=candidates.filter(x=>x.receiptAddress===receiptAddress);
    need(matched.length===1,'DEPOSIT_NOT_AUTHENTICATED_OR_AMBIGUOUS');
    const snapshots=await Promise.all(rpcUrls.map(rpcUrl=>observeRpc({
      rpcUrl,expected:{...expected,receipt:receiptAddress},
      genesisHash:this.expected.genesisHash,fetchFn,
    })));
    const fresh=attachReceiptObservation(matched[0],reconcileObservations(...snapshots));
    // Persisted source is immutable; a later current-state snapshot must NOT
    // replace its original receipt fingerprint or falsely become historical.
    const original=ledger?.state?.processed[fresh.id]?.evidence;
    need(original?.kind==='solana-deposit-evidence-v1','MISSING_DURABLE_SOURCE');
    for(const field of ['id','occurrenceId','signature','transactionHash','finalizedSlot',
      'blockhash','program','mint','holochainScope','receiptAddress','depositor',
      'recipientCore','depositNonce','amountBaseUnits','configAddress','vaultAddress'])
      need(original[field]===fresh[field],'AUTHENTICATED_SOURCE_MISMATCH_'+field);
    need(fresh.refundedAtObservation===false,'DEPOSIT_ALREADY_REFUNDED');
    return this.#queueInternal({ledger,evidence:original,rpcTransaction:fetched.rpcTransaction,
      codeVersion,origin:'observer_reviewed_outbox'});
  }
  /** Explicit test-fixture ingestion only: NEVER upgrades to reviewed OBS origin. */
  queueSyntheticFixture({ledger,evidence,rpcTransaction,codeVersion}){
    need(process.env.DEMO_ALLOW_TEST_ONLY_FIXTURE==='1','SYNTHETIC_DISABLED');
    return this.#queueInternal({ledger,evidence,rpcTransaction,codeVersion,origin:'test_only_fixture'});
  }
  #queueInternal({ledger,evidence,rpcTransaction,codeVersion,origin}){
    need(ledger instanceof DepositLedger&&ledger.lockFd!==null,'LIVE_SOURCE_LEDGER_REQUIRED');
    need(ledger.state.genesisHash===this.expected.genesisHash&&
      ledger.state.program===this.expected.program,'SOURCE_LEDGER_SCOPE');
    const row=ledger.state.processed[evidence?.id];
    need(row!==undefined,'NOT_DURABLY_VERIFIED');
    const {observation,components}=sourceProof(evidence,row,rpcTransaction,
      this.destination,codeVersion,this.expected,origin);
    const fingerprint=domainDigest(DOMAIN+'/work',{observation,components,destination:this.destination});
    const prior=this.state.rows[evidence.id];
    if(prior){need(prior.fingerprint===fingerprint,'SOURCE_FINGERPRINT_CONFLICT');return prior.state;}
    need(!Object.values(this.state.rows).some(x=>x.observation.source.occurrenceId===evidence.occurrenceId),
      'OCCURRENCE_REPLAY');
    this.state.rows[evidence.id]={state:'pending',observation,components,destination:this.destination,
      fingerprint,actionHash:null};
    this.persist();return 'pending';
  }
  async #identity(client){
    need(client&&typeof client.preflight==='function'&&typeof client.read==='function',
      'NO_HOLOCHAIN_TRANSPORT');
    const actual=await client.preflight();
    need(obj(actual)&&canonicalJSON(actual)===canonicalJSON(this.destination),'WRONG_DNA_OR_AGENT');
  }
  async #read(client,row){
    await this.#identity(client);
    return client.read(row.observation.source.id,structuredClone(this.destination));
  }
  #ack(row,remote){
    const actionHash=verifyRemote(remote,row);
    need(!Object.values(this.state.rows).some(other=>
      other!==row&&other.state==='acked'&&other.actionHash===actionHash),
      'REUSED_SIGNED_ACTION_HASH');
    const priorState=row.state,priorActionHash=row.actionHash;
    row.state='acked';row.actionHash=actionHash;
    try{this.persist();return 'acked';}
    catch(e){row.state=priorState;row.actionHash=priorActionHash;throw e;}
  }
  /** On uncertain recovery, READ exact DNA/agent/source ID. Never blind retry. */
  async reconcile(id,client){
    need(!this.inFlight.has(id),'CONCURRENT_RECONCILIATION');
    this.inFlight.add(id);
    try {return await this.#reconcile(id,client);}
    finally {this.inFlight.delete(id);}
  }
  async #reconcile(id,client){
    const row=this.state.rows[id];need(row,'UNKNOWN_SOURCE');
    if(row.state==='acked')return 'acked';
    try{
      const remote=await this.#read(client,row);
      if(remote)return this.#ack(row,remote);
      if(row.state==='pending')return 'pending';
      row.state='hold';this.persist();return 'hold';
    }catch{row.state='hold';this.persist();return 'hold';}
  }
  /** Write only AFTER `uncertain` was flushed and a target-scoped read. */
  async deliver(id,client,{crashAt}={}){
    need(!this.inFlight.has(id),'CONCURRENT_DELIVERY');
    this.inFlight.add(id);
    try {return await this.#deliver(id,client,{crashAt});}
    finally {this.inFlight.delete(id);}
  }
  async #deliver(id,client,{crashAt}={}){
    const row=this.state.rows[id];need(row,'UNKNOWN_SOURCE');
    if(row.state==='acked')return 'acked';
    need(row.observation.proof.evidenceOrigin!=='test_only_fixture'||
      process.env.DEMO_ALLOW_TEST_ONLY_FIXTURE==='1','SYNTHETIC_DELIVERY_DISABLED');
    if(row.state!=='pending')return this.#reconcile(id,client);
    try{
      const already=await this.#read(client,row);
      if(already)return this.#ack(row,already);
      need(typeof client.write==='function','NO_SIGNED_WRITE');
      row.state='uncertain';this.persist();
      if(crashAt==='after_uncertain')throw Error('SIMULATED_PROCESS_CRASH');
      const response=await client.write(structuredClone(row.observation),structuredClone(this.destination));
      if(crashAt==='after_signed_write')throw Error('SIMULATED_PROCESS_CRASH');
      const readback=await this.#read(client,row);
      need(readback,'MISSING_SIGNED_READBACK');
      const actionHash=verifyRemote(readback,row);
      if(response?.actionHash!==undefined)need(response.actionHash===actionHash,'RETURNED_ACTION_CONFLICT');
      return this.#ack(row,readback);
    }catch{
      // Never transition uncertain back to pending, even if transport is down.
      if(row.state!=='acked'&&row.state!=='hold'&&row.state!=='pending')this.persist();
      return row.state;
    }
  }
}
