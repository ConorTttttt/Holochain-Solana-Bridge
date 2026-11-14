/**
 * Review-only A3/A4 typed record canonicalization. Never an evidence admission
 * API, Solana verifier, signed transport gate, or Holochain authorization.
 *
 * Full evidence (original signed wire, block, metadata, old and later state)
 * MUST be carried in proof.originalObserverWitnessCanonicalJson, with original
 * four-account raw RPC UTF-8 separately retained. A4 approval is outstanding.
 */
import {createHash} from 'node:crypto';
import {canonicalJSON as canonicalObserverJSON} from './demo-outbox.mjs';
import {verifyReviewedWitnessV2} from './demo-witness-v2.mjs';
import {addressBytes,decode58,encode58} from './decode.mjs';

export const A4_BINDING_DOMAIN='HSC/solana-audit-demo-v2/source-to-dna';
const DENIALS=Object.freeze({creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false});
const fail=code=>{throw Error('OBS_V2_ABI_REVIEW_REFUSED:'+code)};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hex32=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hex40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const b58=(x,n)=>{try{const decoded=decode58(x);return decoded.length===n&&encode58(decoded)===x}catch{return false}};
const u64=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&
  BigInt(x)<=(1n<<64n)-1n;
const sha=x=>createHash('sha256').update(x).digest('hex');

/**
 * Canonical ASCII-key sorted JSON, arrays in original order, UTF-8 strings.
 * Forbid JS roundoff of u64 and prototype pollution. RPC display-only floats
 * belong inside the *raw UTF-8 string*, never in this typed outer record.
 */
export function canonicalTypedV2(value,depth=0){
  if(depth>100)fail('DEPTH');
  if(value===null||typeof value==='string'||typeof value==='boolean')
    return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('NONCANONICAL_INTEGER');
    return JSON.stringify(value);
  }
  if(Array.isArray(value))
    return '['+value.map(x=>canonicalTypedV2(x,depth+1)).join(',')+']';
  if(!plain(value))fail('NOT_PLAIN_JSON');
  const keys=Object.keys(value).sort();
  if(keys.some(k=>['__proto__','constructor','prototype'].includes(k))||
    Reflect.ownKeys(value).length!==keys.length)fail('AMBIGUOUS_JSON_KEYS');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+
    canonicalTypedV2(value[k],depth+1)).join(',')+'}';
}
function denials(x,label){
  if(!plain(x)||Object.entries(DENIALS).some(([k,v])=>x[k]!==v))
    fail(label+'_ECONOMIC_DENIAL');
}
function keys(x,required,label){
  if(!plain(x)||Object.keys(x).length!==required.length||
    Object.keys(x).some(k=>!required.includes(k)))fail(label+'_SHAPE');
}
const extraDenials=keys=>[...keys,...Object.keys(DENIALS)];
const ROOT=['kind','schemaVersion','source','witness','proof','destination',
  'status','historyIndexed','deliveryAuthorized',...Object.keys(DENIALS)];
const SOURCE=['sourceId','occurrenceId','sourceEventType','genesisHash','program',
  'mint','holochainScope','receiptAddress','configAddress','vaultAddress',
  'depositor','recipientCore','depositNonce','amountBaseUnits','signature',
  'recentBlockhash','finalizedSlot','observationSlot','outerInstructionIndex',
  'sourceCodeCommit','idlSha256','elfSha256','deploymentEpochId'];
const WITNESS=['originalSignedWireSha256','rpcExecutionMetadataSha256',
  'containingBlockSha256','receiptSnapshotSha256','ledgerEvidenceSha256',
  'containingBlockhash','signedMessageRecentBlockhash','sourceWitnessDigest',
  'digestAlgorithm','canonicalEncoding','historyComplete'];
const PROOF=['evidenceKind','sourceTrust','observerAdmission',
  'transactionVerifiedRpcClaim','independentFinalityProof','historyComplete',
  'sourceAuthNotConferredByPayload','originalObserverWitnessCanonicalJson',
  'originalObserverWitnessCanonicalSha256','originalFourAccountRpcUtf8',
  'originalFourAccountRpcSha256'];
const DEST=['installedAppId','dnaHash','cellAgentPubkey','cellId','role',
  'integrityZome','coordinatorZome','function','integrityWasmSha256',
  'coordinatorWasmSha256','dnaBundleSha256','happBundleSha256','abiSha256'];
function assertReviewShape(record){
  // This rejects formally incomplete review payloads. It does NOT authenticate
  // its content or permit the unaudited A4 v2 zome to be called.
  const {bindingDigest,...unsigned}=record;
  keys(unsigned,ROOT,'ROOT');
  for(const label of ['source','witness','proof','destination'])denials(record[label],label);
  denials(unsigned,'ROOT');
  keys(record.source,extraDenials(SOURCE),'SOURCE');
  keys(record.witness,extraDenials(WITNESS),'WITNESS');
  keys(record.proof,extraDenials(PROOF),'PROOF');
  keys(record.destination,extraDenials(DEST),'DEST');
  if(record.kind!=='solana-observation-demo-v2'||record.schemaVersion!=='2'||
    record.status!=='source_verified_rpc_claim'||record.historyIndexed!==false||
    record.deliveryAuthorized!==false||record.source.sourceEventType!=='deposit'||
    record.witness.historyComplete!==false||record.proof.historyComplete!==false||
    record.proof.independentFinalityProof!==false||
    record.proof.sourceAuthNotConferredByPayload!==true||
    record.proof.observerAdmission!=='in-process-kit-ledger-revalidated'||
    record.witness.digestAlgorithm!=='sha256'||record.witness.canonicalEncoding!=='sorted-key-utf8-json-v1'||
    record.destination.role!=='audit'||record.destination.function!=='record_observation_v2'||
    record.destination.integrityZome!=='solana_audit_integrity'||
    record.destination.coordinatorZome!=='solana_audit'||/unyt/i.test(record.destination.installedAppId))
    fail('AUDIT_ONLY_CONSTANTS');
  if(!Array.isArray(record.destination.cellId)||
    record.destination.cellId.length!==2||
    record.destination.cellId[0]!==record.destination.dnaHash||
    record.destination.cellId[1]!==record.destination.cellAgentPubkey)fail('FULL_CELL_ID');
  if(!u64(record.source.depositNonce)||!u64(record.source.amountBaseUnits)||
    record.source.amountBaseUnits==='0'||!Number.isSafeInteger(record.source.finalizedSlot)||
    record.source.finalizedSlot<1||!Number.isSafeInteger(record.source.observationSlot)||
    record.source.observationSlot<record.source.finalizedSlot||
    !Number.isInteger(record.source.outerInstructionIndex)||
    record.source.outerInstructionIndex<0||record.source.outerInstructionIndex>0xffffffff)
    fail('SOURCE_INTEGER_TYPES');
  if(record.source.sourceId!==[record.source.genesisHash,record.source.program,
      record.source.receiptAddress].join(':')||
    record.source.occurrenceId!==[record.source.genesisHash,record.source.program,
      record.source.signature,'outer',record.source.outerInstructionIndex].join(':'))
    fail('SOURCE_OCCURRENCE');
  // Strict source and destination syntax is necessary but not sufficient:
  // a connected runtime must independently authenticate deployment and CellId.
  for(const k of ['genesisHash','program','mint','receiptAddress','configAddress',
    'vaultAddress','depositor','recentBlockhash']){
    if(!b58(record.source[k],32))fail('NONCANONICAL_BASE58_'+k);
  }
  if(!b58(record.source.signature,64)||
    !b58(record.witness.containingBlockhash,32)||
    !b58(record.witness.signedMessageRecentBlockhash,32))
    fail('SIGNED_IDENTITIES');
  if(!hex32(record.source.holochainScope)||!hex32(record.source.recipientCore)||
    record.source.holochainScope==='0'.repeat(64)||
    record.source.recipientCore==='0'.repeat(64))
    fail('SOURCE_SCOPE_RECIPIENT');
  if(!hex40(record.source.sourceCodeCommit)||
    !hex64(record.source.idlSha256)||!hex64(record.source.elfSha256)||
    typeof record.source.deploymentEpochId!=='string'||
    record.source.deploymentEpochId.length<16||
    /unknown|placeholder|not.?deployed/i.test(record.source.deploymentEpochId))
    fail('SOURCE_VERSION_DEPLOYMENT_EPOCH');
  if(record.source.recentBlockhash!==record.witness.signedMessageRecentBlockhash||
    record.proof.evidenceKind!=='solana-deposit-evidence-v2'||
    record.proof.sourceTrust!=='single-operator-rpc-claim'||
    record.proof.transactionVerifiedRpcClaim!==true)
    fail('SOURCE_PROOF_CONSTANTS');
  for(const k of ['integrityWasmSha256','coordinatorWasmSha256','dnaBundleSha256',
    'happBundleSha256','abiSha256'])if(!hex64(record.destination[k]))
    fail('DESTINATION_BUILD_DIGEST_'+k);
  if(typeof record.destination.installedAppId!=='string'||
    record.destination.installedAppId.length<1||
    typeof record.destination.dnaHash!=='string'||
    record.destination.dnaHash.length<1||
    typeof record.destination.cellAgentPubkey!=='string'||
    record.destination.cellAgentPubkey.length<1)
    fail('DESTINATION_IDENTITY');
  for(const k of ['originalSignedWireSha256','rpcExecutionMetadataSha256',
    'containingBlockSha256','receiptSnapshotSha256','ledgerEvidenceSha256',
    'sourceWitnessDigest'])if(!hex64(record.witness[k]))fail('WITNESS_DIGEST_TYPE_'+k);
  for(const k of ['originalObserverWitnessCanonicalSha256','originalFourAccountRpcSha256'])
    if(!hex64(record.proof[k]))fail('PROOF_DIGEST_TYPE_'+k);
  if(typeof record.proof.originalObserverWitnessCanonicalJson!=='string'||
    typeof record.proof.originalFourAccountRpcUtf8!=='string'||
    sha(Buffer.from(record.proof.originalObserverWitnessCanonicalJson,'utf8'))!==
      record.proof.originalObserverWitnessCanonicalSha256||
    sha(Buffer.from(record.proof.originalFourAccountRpcUtf8,'utf8'))!==
      record.proof.originalFourAccountRpcSha256)
    fail('RAW_PROOF_PREIMAGE_MISSING_OR_CHANGED');
  // The whole A3 witness is mandatory; hash-only projections are rejected.
  // Structural A3 verification remains NON-AUTHENTICATING (unkeyed digest).
  let raw,originalRpc;
  try{
    raw=JSON.parse(record.proof.originalObserverWitnessCanonicalJson);
    if(canonicalObserverJSON(raw)!==record.proof.originalObserverWitnessCanonicalJson)
      fail('NONCANONICAL_OBSERVER_WITNESS_PREIMAGE');
    verifyReviewedWitnessV2(raw);
  }catch(e){fail('UNREVIEWED_OR_INCOMPLETE_ORIGINAL_WITNESS')}
  if(record.witness.sourceWitnessDigest!==raw.witnessDigest||
    record.witness.originalSignedWireSha256!==raw.proof.originalSignedWireSha256||
    record.source.sourceId!==raw.source.id||
    record.source.occurrenceId!==raw.source.occurrenceId||
    record.source.genesisHash!==raw.source.genesisHash||
    record.source.program!==raw.source.program||
    record.source.mint!==raw.source.mint||
    record.source.holochainScope!==raw.source.holochainScope||
    record.source.depositNonce!==raw.source.depositNonce||
    record.source.amountBaseUnits!==raw.source.amountBaseUnits||
    record.source.recipientCore!==raw.source.recipientCore||
    record.source.finalizedSlot!==raw.source.finalizedSlot||
    record.source.sourceCodeCommit!==raw.source.codeVersion)
    fail('SOURCE_WITNESS_PROJECTION_LOSS_OR_CONFLICT');
  const hashes={
    rpcExecutionMetadataSha256:sha(Buffer.from(canonicalObserverJSON(raw.proof.rpcTransaction.meta),'utf8')),
    containingBlockSha256:sha(Buffer.from(canonicalObserverJSON(raw.proof.containingBlock),'utf8')),
    receiptSnapshotSha256:sha(Buffer.from(canonicalObserverJSON({
      original:raw.proof.originalReceiptSnapshot,
      later:raw.proof.latestReconciledReceiptSnapshot,
    }),'utf8')),
    ledgerEvidenceSha256:sha(Buffer.from(canonicalObserverJSON(raw.source.verifiedEvidence),'utf8')),
  };
  if(Object.entries(hashes).some(([k,v])=>record.witness[k]!==v))
    fail('COMPONENT_PREIMAGE_DIGEST_MISMATCH');
  // Bind original four-account byte strings to the committed source snapshot
  // digest, rather than treating a separately submitted sidecar as source truth.
  try{
    originalRpc=JSON.parse(record.proof.originalFourAccountRpcUtf8);
    const values=originalRpc?.result?.value;
    if(!Array.isArray(values)||values.length!==4||
      originalRpc.result.context?.slot!==raw.proof.originalReceiptSnapshot.finalizedSlot)
      fail('RAW_FOUR_ACCOUNT_RPC_CONTEXT');
    for(const [i,k] of ['receiptDigest','configDigest','vaultDigest','mintDigest'].entries()){
      const account=values[i];
      if(!Array.isArray(account?.data)||account.data[1]!=='base64')fail('RAW_ACCOUNT_ENCODING');
      const bytes=Buffer.from(account.data[0],'base64');
      if(bytes.toString('base64')!==account.data[0]||
        sha(bytes)!==raw.proof.originalReceiptSnapshot[k])fail('RAW_ACCOUNT_BYTES_CONTRADICT_SOURCE');
    }
  }catch(e){fail('RAW_ORIGINAL_ACCOUNT_SNAPSHOT_INCOMPLETE_OR_CONTRADICTORY')}
  return unsigned;
}
/**
 * Never call from a signing adapter as an authorization check. This *only*
 * validates typed integrity of a candidate after separately trusted ingress.
 */
export function verifyBindingDigestReviewOnly(record){
  if(!plain(record)||!hex64(record.bindingDigest))fail('BINDING_DIGEST_TYPE');
  const unsigned=assertReviewShape(record);
  const digest=sha(Buffer.concat([Buffer.from(A4_BINDING_DOMAIN,'utf8'),
    Buffer.from([0]),Buffer.from(canonicalTypedV2(unsigned),'utf8')]));
  if(digest!==record.bindingDigest)fail('BINDING_DIGEST_CHANGED');
  return true;
}
/** Digest primitive for independent vectors, not an admission or schema check. */
export function reviewBindingDigestPrimitive(unsigned){
  return sha(Buffer.concat([Buffer.from(A4_BINDING_DOMAIN,'utf8'),
    Buffer.from([0]),Buffer.from(canonicalTypedV2(unsigned),'utf8')]));
}
