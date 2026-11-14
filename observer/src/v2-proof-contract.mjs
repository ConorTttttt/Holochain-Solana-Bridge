/** V2 canonical digest utility. PURE HASH ONLY: never authenticates proof or enables writes. */
import {createHash} from 'node:crypto';
export const V2_WITNESS_DOMAIN='HSC/observer-demo-outbox/v2/witness';
export const V2_DENIALS=Object.freeze({creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false});
const need=(yes,why)=>{if(!yes)throw Error('OBS_V2_REFUSED:'+why)};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export function canonicalV2(x){
  if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
  if(typeof x==='number'){need(Number.isSafeInteger(x)&&!Object.is(x,-0),'UNSAFE_NUMBER');return JSON.stringify(x)}
  if(Array.isArray(x))return '['+x.map(canonicalV2).join(',')+']';
  need(plain(x),'INVALID_OBJECT');
  const keys=Object.keys(x).sort();
  need(keys.every(k=>!['__proto__','constructor','prototype'].includes(k)),'UNSAFE_KEY');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonicalV2(x[k])).join(',')+'}';
}
const exact=(x,fields,name)=>need(plain(x)&&Object.keys(x).length===fields.length&&
  Object.keys(x).every(k=>fields.includes(k)),name+'_SHAPE');
const base=Object.keys(V2_DENIALS);
const sourceFields=['sourceEventType','sourceId','occurrenceId','genesisHash','program','mint',
  'holochainScope','receiptAddress','depositor','recipientCore','depositNonce','amountBaseUnits',
  'configAddress','vaultAddress','sourceTokenAccount','signature','transactionVersion',
  'finalizedSlot','blockhash','recentBlockhash','instructionPath','cpiPath',...base];
const proofFields=['evidenceKind','evidenceOrigin','finalityTrust','signedWireBase64','signedWireSha256',
  'transactionMetadataRawJsonUtf8','containingBlockRawJsonUtf8',
  'laterFourAccountSnapshotRawJsonUtf8','durableLedgerEvidence','idlSha256','elfSha256',
  'solanaSourceCommitSha','historyComplete','historyIndexed','refundDurablyCommitted',
  'rollbackSecurityHold',...base];
const destinationFields=['dnaHash','agentKey','cellId','appId','role','zome','functionName',
  'genesisHash','program','mint','holochainScope','signerPolicyEpoch'];
const decimal=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<(1n<<64n);
const hex32=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const named=x=>typeof x==='string'&&x.length>0;
/** Calculating a candidate digest cannot upgrade caller JSON to Observer authenticated provenance. */
export function calculateV2CandidateDigest(payload){
  exact(payload,['kind','schemaVersion','source','proof','destination','verifierVersion',...base],'ROOT');
  const s=payload.source,p=payload.proof,d=payload.destination;
  exact(s,sourceFields,'SOURCE');exact(p,proofFields,'PROOF');exact(d,destinationFields,'DEST');
  for(const layer of [payload,s,p])
    for(const [k,v] of Object.entries(V2_DENIALS))need(layer[k]===v,'ECONOMIC_DENIAL');
  need(payload.kind==='solana-observation-demo-v2'&&payload.schemaVersion===2,'VERSION');
  need(s.sourceEventType==='deposit'&&p.evidenceKind==='solana-deposit-evidence-v2'&&
    p.evidenceOrigin==='observer_reviewed_outbox'&&p.finalityTrust==='finalized_rpc_claim_only',
    'ORIGIN');
  need(p.historyComplete===false&&p.historyIndexed===false&&p.refundDurablyCommitted===false&&
    p.rollbackSecurityHold==='HOSTILE_FILE_ROLLBACK_UNPROTECTED','HISTORY');
  need(decimal(s.depositNonce)&&decimal(s.amountBaseUnits)&&BigInt(s.amountBaseUnits)>0n&&
    hex32(s.recipientCore)&&hex32(s.holochainScope)&&hex32(p.signedWireSha256)&&
    hex32(p.idlSha256)&&hex32(p.elfSha256),'SOURCE_DIGEST_FIELDS');
  need(Number.isSafeInteger(s.finalizedSlot)&&s.finalizedSlot>0&&
    /^outer:(0|[1-9][0-9]*)$/.test(s.instructionPath)&&
    s.sourceId===s.genesisHash+':'+s.program+':'+s.receiptAddress&&
    s.occurrenceId===s.genesisHash+':'+s.program+':'+s.signature+':'+s.instructionPath,
    'SOURCE_ID');
  need(d.role==='audit'&&d.zome==='solana_audit'&&named(d.functionName)&&
    !/unyt/i.test(d.appId)&&Array.isArray(d.cellId)&&d.cellId.length===2&&
    d.cellId[0]===d.dnaHash&&d.cellId[1]===d.agentKey,'CONTROLLED_DNA');
  for(const key of ['genesisHash','program','mint','holochainScope'])
    need(d[key]===s[key],'DEST_SCOPE_'+key);
  for(const key of ['signedWireBase64','transactionMetadataRawJsonUtf8',
    'containingBlockRawJsonUtf8','laterFourAccountSnapshotRawJsonUtf8'])
    need(named(p[key]),'MISSING_AUDIT_BYTES_'+key);
  need(plain(p.durableLedgerEvidence)&&named(p.solanaSourceCommitSha)&&
    named(payload.verifierVersion)&&named(d.signerPolicyEpoch),'UNBOUND_VERSION_LEDGER');
  const canonical=canonicalV2(payload);
  const witnessDigest=createHash('sha256').update(V2_WITNESS_DOMAIN,'utf8')
    .update(Buffer.from([0])).update(canonical,'utf8').digest('hex');
  return Object.freeze({witnessDigest,canonicalByteLength:Buffer.byteLength(canonical),
    authenticated:false,approvedForDelivery:false,creditEligible:false});
}
