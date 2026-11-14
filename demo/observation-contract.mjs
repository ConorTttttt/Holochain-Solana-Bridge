/**
 * A1/CI-owned, source-only demo envelope builder. NOT a verification API:
 * callers MUST first obtain `evidence` from the real Observer's signed-wire,
 * containing-block and four-account verification in the SAME trusted process.
 * A JSON caller can forge these fields; never accept arbitrary user JSON as
 * verified evidence. No Holochain writes, capability grants or finance calls.
 */
import { createHash } from 'node:crypto';

const DENIALS=Object.freeze({
  creditEligible:false, independentConsensusVerified:false,
  spendableBaseUnits:'0', withdrawalAuthorized:false,
});
const sha256=x=>createHash('sha256').update(x).digest('hex');
function need(ok,message){if(!ok)throw new Error('AUDIT_DEMO_REFUSED: '+message);}
function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
function denyInput(x,label){
  need(object(x),label+' must be object');
  for(const [key,value] of Object.entries(DENIALS))
    if(Object.hasOwn(x,key))need(x[key]===value,label+'.'+key+' violated');
}
function requiredString(x,label){
  need(typeof x==='string'&&x.length>0,label+' missing');
  return x;
}
function decimalPositive(x,label){
  need(typeof x==='string'&&/^[1-9][0-9]*$/.test(x),label+' must be exact positive decimal string');
  return x;
}
function denied(x){return Object.freeze({...x,...DENIALS});}

/**
 * Stage source evidence for a separately authorized *own-audit-DNA* adapter.
 * This is a record of an RPC finalized CLAIM with a signed transaction,
 * not an independent Solana finality proof, gap-free history or a credit.
 */
export function makeAuditOnlyEnvelope({evidence,rpcTransaction,expected}){
  denyInput(evidence,'evidence');
  denyInput(evidence.receiptSnapshot,'receiptSnapshot');
  need(object(expected),'trusted source pins required');
  need(evidence.kind==='solana-deposit-evidence-v1' &&
    evidence.verifiedByRpcClaim===true && evidence.transactionVerified===true,
    'actual OBS signed-transaction candidate required');
  need(evidence.independentConsensusVerified===false &&
    evidence.creditEligible===false, 'economic/finality denial missing');
  const snap=evidence.receiptSnapshot;
  need(snap.kind==='solana-receipt-observation-v1' &&
    snap.transactionVerified===false && snap.creditEligible===false,
    'later receipt snapshot is not signed history');
  for(const field of ['genesisHash','program','mint','holochainScope']){
    requiredString(expected[field],'pinned '+field);
    need(evidence[field]===expected[field],field+' mismatch');
  }
  for(const field of ['id','program','mint','receiptAddress','holochainScope',
    'depositor','recipientCore','depositNonce','amountBaseUnits']){
    need(evidence[field]===snap[field], 'receipt snapshot '+field+' mismatch');
  }
  need(snap.genesisHash===expected.genesisHash,'receipt snapshot genesis mismatch');
  need(evidence.refundedAtObservation===snap.refunded &&
    typeof snap.refunded==='boolean', 'refund state mismatch');
  need(Number.isSafeInteger(evidence.finalizedSlot) && evidence.finalizedSlot>0 &&
    Number.isSafeInteger(evidence.observationSlot) &&
    evidence.observationSlot>=evidence.finalizedSlot,
    'bad transaction/receipt slots');
  need(object(rpcTransaction) && rpcTransaction.slot===evidence.finalizedSlot &&
    rpcTransaction.version===evidence.transactionVersion && rpcTransaction.meta?.err===null,
    'successful source transaction identity missing');
  need(Array.isArray(rpcTransaction.transaction) &&
    rpcTransaction.transaction.length===2 &&
    rpcTransaction.transaction[1]==='base64' &&
    typeof rpcTransaction.transaction[0]==='string',
    'original signed wire missing');
  const wire=Buffer.from(rpcTransaction.transaction[0],'base64');
  need(wire.length>0 && wire.toString('base64')===rpcTransaction.transaction[0],
    'noncanonical original signed wire');
  const wireHash=sha256(wire);
  need(/^[0-9a-f]{64}$/.test(evidence.transactionHash) &&
    wireHash===evidence.transactionHash, 'original signed wire digest mismatch');
  requiredString(evidence.signature,'signed transaction signature');
  requiredString(evidence.blockhash,'containing blockhash');
  requiredString(evidence.receiptAddress,'receipt address');
  requiredString(evidence.instructionPath,'outer instruction path');
  requiredString(evidence.recipientCore,'Holochain recipient core');
  decimalPositive(evidence.amountBaseUnits,'amountBaseUnits');
  need(typeof evidence.depositNonce==='string' &&
    /^(0|[1-9][0-9]*)$/.test(evidence.depositNonce),'bad nonce string');
  need(typeof snap.receiptDigest==='string' && /^[0-9a-f]{64}$/.test(snap.receiptDigest),
    'missing original receipt digest');
  const id=sha256(['HSC/demo-audit-record/v1',expected.genesisHash,
    expected.program,evidence.receiptAddress,evidence.signature,
    evidence.instructionPath].join('\0'));
  const source=denied({
    genesisHash:expected.genesisHash,program:expected.program,mint:expected.mint,
    holochainScope:expected.holochainScope,
    receiptAddress:evidence.receiptAddress,signature:evidence.signature,
    finalizedSlot:evidence.finalizedSlot,observationSlot:evidence.observationSlot,
    transactionHash:evidence.transactionHash,blockhash:evidence.blockhash,
    instructionPath:evidence.instructionPath,depositNonce:evidence.depositNonce,
    recipientCore:evidence.recipientCore,depositor:evidence.depositor,
    amountBaseUnits:evidence.amountBaseUnits,refundedAtObservation:snap.refunded,
  });
  const witness=denied({
    signedWireSha256:wireHash, originalRpcMetadataSha256:sha256(JSON.stringify(rpcTransaction.meta)),
    receiptSnapshotSha256:snap.receiptDigest,
    evidenceTrust:'signed_wire_in_provider_finalized_block_rpc_claim',
    independentlyAuthenticatedHistory:false,
  });
  // No target hash/action hash is fabricated. Agent 4 must bind a real
  // controlled DNA and prove signed record_observation + readback.
  const destination=denied({
    kind:'own-controlled-holochain-audit-dna-only',
    state:'not_bound_or_written',dnaHash:null,cellId:null,actionHash:null,
  });
  return Object.freeze(denied({
    kind:'solana-observation-demo-v1',id,
    status:snap.refunded?'refunded_at_observation':'signed_transaction_verified_rpc_claim',
    historyIndexed:false,deliveryAuthorized:false,
    source,witness,destination,
    proofLimitations:Object.freeze([
      'RPC finalized is a provider claim, not independently checked Solana consensus',
      'Only selected signed transactions and blocks have been archived',
      'Current Solana deposits are refundable and authorize no credit',
      'No authorized real Holochain demo-DNA write has occurred',
    ]),
  }));
}
