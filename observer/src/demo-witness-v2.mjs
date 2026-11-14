/**
 * Proposed OBS -> disposable-demo-DNA v2 proof envelope.
 *
 * Built ONLY from observations that queueVerified re-fetched and verified through
 * production Solana Kit and an existing locked DepositLedger. The envelope does
 * NOT certify consensus, complete history, non-refundable collateral, or a
 * Holochain capability. A4 has NOT approved a v2 write ABI.
 */
import { createHash } from 'node:crypto';
import { canonicalJSON, DENIALS, domainDigest } from './demo-outbox.mjs';

export const REVIEWED_V2_KIND='solana-observation-demo-v2';
export const REVIEWED_V2_DOMAIN='HSC/observer-authenticated-audit-witness/v2';
const need=(ok,code)=>{if(!ok)throw Error('OBS_V2_REFUSED:'+code)};
const hex64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const sha=x=>createHash('sha256').update(x).digest('hex');
const eq=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
function rawWire(tx){
  need(Array.isArray(tx?.transaction)&&tx.transaction.length===2&&tx.transaction[1]==='base64',
    'SIGNED_WIRE_REQUIRED');
  const s=tx.transaction[0];need(typeof s==='string'&&s.length>0,'SIGNED_WIRE_REQUIRED');
  const raw=Buffer.from(s,'base64');
  need(raw.length>0&&raw.toString('base64')===s,'NONCANONICAL_SIGNED_WIRE');
  return raw;
}
/**
 * This is a complete audit PROPOSAL, not the accepted A4 v1 transport payload.
 * No caller-supplied proof digest, transactionVerified, or history flag enters
 * this function: the caller must supply the actual verified artifacts.
 */
export function buildReviewedWitnessV2({evidence,rpcTransaction,containingBlock,
  laterReceiptSnapshot,destination,expected,codeVersion}){
  need(evidence?.kind==='solana-deposit-evidence-v1' &&
    evidence.transactionVerified===true && evidence.verifiedByRpcClaim===true &&
    evidence.refundedAtObservation===false,'VERIFIED_ACTIVE_DEPOSIT_REQUIRED');
  for(const [k,v] of Object.entries(DENIALS)){
    need(evidence[k]===v&&evidence.receiptSnapshot?.[k]===v,'ECONOMIC_DENIAL');
  }
  need(rpcTransaction?.slot===evidence.finalizedSlot &&
    rpcTransaction?.version===evidence.transactionVersion &&
    rpcTransaction?.meta?.err===null,'RPC_EXECUTION_IDENTITY');
  need(sha(rawWire(rpcTransaction))===evidence.transactionHash &&
    hex64(evidence.transactionHash),'ORIGINAL_WIRE_HASH');
  need(containingBlock?.blockhash===evidence.blockhash &&
    Array.isArray(containingBlock.transactions),'CONTAINING_BLOCK_REQUIRED');
  need(laterReceiptSnapshot?.kind==='solana-receipt-observation-v1' &&
    laterReceiptSnapshot.refunded===false &&
    laterReceiptSnapshot.finalizedSlot>=evidence.finalizedSlot,'LATER_SNAPSHOT_NOT_ACTIVE');
  for(const k of ['id','receiptAddress','depositor','mint','program','holochainScope',
    'depositNonce','recipientCore','amountBaseUnits','configAddress','vaultAddress'])
    need(laterReceiptSnapshot[k]===evidence[k],'LATER_SNAPSHOT_'+k);
  for(const k of ['genesisHash','program','mint','holochainScope'])
    need(evidence[k]===expected[k] || k==='genesisHash'&&
      evidence.receiptSnapshot?.genesisHash===expected[k],'SOURCE_SCOPE_'+k);
  need(typeof codeVersion==='string'&&/^[0-9A-Za-z._/-]{1,96}$/.test(codeVersion),
    'PINNED_CODE_VERSION');
  need(destination?.role==='audit'&&destination?.zome==='solana_audit' &&
    typeof destination.dnaHash==='string'&&typeof destination.agentKey==='string' &&
    typeof destination.appId==='string'&&!/unyt/i.test(destination.appId),
    'CONTROLLED_DEMO_DESTINATION');
  const unsigned={
    kind:REVIEWED_V2_KIND,schemaVersion:'2',...DENIALS,
    source:{
      ...DENIALS,kind:'solana-deposit-evidence-v1',sourceEventType:'deposit',
      // Preserve *every* validated deposit/candidate field instead of projecting
      // down to v1's amount, signature and digest alone.
      verifiedEvidence:structuredClone(evidence),
      id:evidence.id,occurrenceId:evidence.occurrenceId,
      genesisHash:expected.genesisHash,program:expected.program,mint:expected.mint,
      holochainScope:expected.holochainScope,receiptAddress:evidence.receiptAddress,
      depositor:evidence.depositor,recipientCore:evidence.recipientCore,
      depositNonce:evidence.depositNonce,signature:evidence.signature,
      blockhash:evidence.blockhash,finalizedSlot:evidence.finalizedSlot,
      instructionPath:evidence.instructionPath,
      amountBaseUnits:evidence.amountBaseUnits,codeVersion,
    },
    proof:{
      ...DENIALS,evidenceOrigin:'observer_reviewed_outbox',
      evidenceKind:'solana-deposit-evidence-v1',
      verifiedByRpcClaim:true,transactionVerified:true,historyComplete:false,
      // RPC data are claims, including the finalized block. Original wire and
      // the original later account snapshot remain separately inspectable.
      originalSignedWireBase64:rpcTransaction.transaction[0],
      originalSignedWireSha256:evidence.transactionHash,
      rpcTransaction:structuredClone(rpcTransaction),
      containingBlock:structuredClone(containingBlock),
      originalReceiptSnapshot:structuredClone(evidence.receiptSnapshot),
      latestReconciledReceiptSnapshot:structuredClone(laterReceiptSnapshot),
      independentFinalityProof:false,historyIndexed:false,
      refundDurablyCommitted:false,
    },
    destination:structuredClone(destination),
  };
  const witnessDigest=domainDigest(REVIEWED_V2_DOMAIN,unsigned);
  return {...unsigned,witnessDigest};
}
export function verifyReviewedWitnessV2(w){
  need(w?.kind===REVIEWED_V2_KIND&&w.schemaVersion==='2'&&hex64(w.witnessDigest),
    'VERSION_OR_DIGEST');
  const {witnessDigest,...unsigned}=w;
  need(domainDigest(REVIEWED_V2_DOMAIN,unsigned)===witnessDigest,'WITNESS_DIGEST_CHANGED');
  for(const x of [w,w.source,w.proof]){
    for(const [k,v] of Object.entries(DENIALS))need(x?.[k]===v,'ECONOMIC_DENIAL');
  }
  need(w.proof?.evidenceOrigin==='observer_reviewed_outbox' &&
    w.proof?.historyComplete===false&&w.proof?.independentFinalityProof===false &&
    w.proof?.historyIndexed===false &&w.proof?.refundDurablyCommitted===false &&
    eq(w.proof.originalReceiptSnapshot,w.source.verifiedEvidence.receiptSnapshot),
    'REVIEWED_PROOF_CONTRACT');
  need(sha(rawWire(w.proof.rpcTransaction))===w.proof.originalSignedWireSha256 &&
    w.proof.originalSignedWireBase64===w.proof.rpcTransaction.transaction[0] &&
    w.proof.originalSignedWireSha256===w.source.verifiedEvidence.transactionHash &&
    w.proof.containingBlock.blockhash===w.source.blockhash,'RPC_PROOF_MUTATION');
  return true;
}
