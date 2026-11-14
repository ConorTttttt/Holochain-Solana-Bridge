/**
 * Read-only authentication of a successful, included SOL refund.
 * Account snapshots MUST bracket the refund. They are not historical RPC state
 * proofs by themselves; callers must supply complete produced-slot coverage
 * before a durable refund transition may be committed.
 */
import { createHash } from 'node:crypto';
import { isSignerRole, isWritableRole } from '@solana/kit';
import { addressBytes } from './decode.mjs';
import { deriveBridgeAddresses } from './pda.mjs';
import { CLASSIC_TOKEN_PROGRAM } from './verify.mjs';
import { decodeFinalizedWire, verifyWireSignatures } from './transaction.mjs';
import { validateGeneratedIdl } from '../scripts/verify-idl.mjs';
import { isVerifiedHistoryCoverage } from './history.mjs';

const SYSTEM = '11111111111111111111111111111111';
const U64_MAX = (1n << 64n) - 1n;
const disc = name => createHash('sha256').update('global:' + name).digest().subarray(0,8);
const fail = message => { throw new Error('Refund verification failed: ' + message); };
const need = (condition,message) => { if (!condition) fail(message); };
const uint = (value,label) => {
  need(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value),
    'noncanonical exact integer ' + label);
  const result=BigInt(value);
  need(result<=U64_MAX,'u64 overflow '+label);
  return result;
};
function balance(meta,when,index,mint,authority) {
  const values=meta[when+'TokenBalances'];
  need(Array.isArray(values),'missing '+when+' token balances');
  const items=values.filter(x=>x.accountIndex===index);
  need(items.length===1,'missing/ambiguous '+when+' token balance for '+index);
  const entry=items[0];
  need(entry.mint===mint && entry.owner===authority &&
    entry.programId===CLASSIC_TOKEN_PROGRAM,'token mint/owner/program mismatch');
  need(Number.isInteger(entry.uiTokenAmount?.decimals) &&
    entry.uiTokenAmount.decimals>=0 && entry.uiTokenAmount.decimals<=255,
    'invalid token decimals');
  return {amount:uint(entry.uiTokenAmount.amount,when),decimals:entry.uiTokenAmount.decimals};
}
function assertObservation(observation,deposit,expected,genesisHash) {
  need(observation?.kind==='solana-receipt-observation-v1' &&
    observation.creditEligible===false &&
    observation.independentConsensusVerified===false &&
    observation.transactionVerified===false &&
    observation.spendableBaseUnits==='0' &&
    observation.withdrawalAuthorized===false,'invalid untrusted receipt observation');
  for (const [field,value] of Object.entries({
    id:deposit.id,genesisHash,program:expected.program,
    receiptAddress:deposit.receiptAddress,configAddress:expected.config,
    vaultAddress:expected.vault,mint:expected.mint,depositor:deposit.depositor,
    depositNonce:deposit.depositNonce,amountBaseUnits:deposit.amountBaseUnits,
    holochainScope:deposit.holochainScope,recipientCore:deposit.recipientCore,
  })) need(observation[field]===value,'receipt observation contradicts '+field);
}

/**
 * Authenticate a genuine signed refund transaction and the precise historical
 * before/after economic state; emit ONLY a non-economic refund observation.
 * This does not itself certify missing history or allow ledger commitment.
 *
 * indexerHistory must be independently built from complete two-provider
 * getBlocks/getBlock captures; an externally supplied claim is not consensus.
 */
export async function verifyRefundTransition({
  rpcTransaction,signature,expected,genesisHash,idl,blockhash,
  originalDeposit,preObservation,postObservation,finalizedClaim=false,
  indexerHistory=null,source='archived_rpc_refund',
}) {
  need(finalizedClaim===true,'finalized containing-block check required');
  for (const field of ['program','mint','config','vault']) addressBytes(expected?.[field]);
  addressBytes(genesisHash);addressBytes(blockhash);
  need(originalDeposit?.kind==='solana-deposit-evidence-v1' &&
    originalDeposit.transactionVerified===true &&
    originalDeposit.creditEligible===false &&
    originalDeposit.independentConsensusVerified===false &&
    originalDeposit.spendableBaseUnits==='0' &&
    originalDeposit.withdrawalAuthorized===false &&
    originalDeposit.refundedAtObservation===false &&
    originalDeposit.receiptSnapshot?.refunded===false &&
    typeof originalDeposit.id==='string','missing original active deposit evidence');
  need(originalDeposit.program===expected.program &&
    originalDeposit.mint===expected.mint &&
    originalDeposit.configAddress===expected.config &&
    originalDeposit.vaultAddress===expected.vault &&
    originalDeposit.id===genesisHash+':'+expected.program+':'+originalDeposit.receiptAddress,
    'original deposit binding mismatch');
  assertObservation(preObservation,originalDeposit,expected,genesisHash);
  assertObservation(postObservation,originalDeposit,expected,genesisHash);
  const metadata=rpcTransaction?.meta;
  need(metadata?.err===null,'refund transaction failed or absent');
  const decoded=decodeFinalizedWire(rpcTransaction,signature);
  await verifyWireSignatures(decoded);
  const {compiledMessage,instructions,transactionHash}=decoded;
  const refundInstructions=instructions.filter(ix=>
    ix.programAddress===expected.program &&
    Buffer.from(ix.data||[]).subarray(0,8).equals(disc('refund')));
  need(refundInstructions.length===1,'must contain exactly one canonical refund');
  const refund=refundInstructions[0];
  need(refund.trace?.kind==='outer' &&
    Buffer.from(refund.data||[]).length===8,'refund must be a top-level no-args instruction');
  need(instructions.filter(ix=>ix.programAddress===expected.program &&
    Buffer.from(ix.data||[]).subarray(0,8).equals(disc('deposit'))).length===0,
    'mixed refund/deposit transaction is ambiguous');
  validateGeneratedIdl(idl,{expectedProgramId:expected.program});
  const instruction=idl.instructions?.find(ix=>ix.name==='refund');
  const names=instruction?.accounts?.map(a=>a.name.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()));
  need(instruction?.args?.length===0 &&
    JSON.stringify(instruction.discriminator)===JSON.stringify([...disc('refund')]) &&
    JSON.stringify(names)===JSON.stringify([
      'depositor','config','mint','vault','receipt','destination','tokenProgram',
    ]),'compiled refund IDL contract mismatch');
  const accounts=refund.accounts||[];
  need(accounts.length===7,'refund account count mismatch');
  const [owner,config,mint,vault,receipt,destination,tokenProgram]=accounts.map(a=>a.address);
  need(owner===originalDeposit.depositor &&
    config===expected.config && mint===expected.mint && vault===expected.vault &&
    receipt===originalDeposit.receiptAddress && tokenProgram===CLASSIC_TOKEN_PROGRAM &&
    destination!==vault,'wrong refund owner/receipt/custody binding');
  need(isSignerRole(accounts[0].role) &&
    [0,1,3,4,5].every(i=>isWritableRole(accounts[i].role)),
    'refund signer/writable account constraints not met');
  addressBytes(destination);
  const pdas=await deriveBridgeAddresses({
    program:expected.program,mint:expected.mint,depositor:owner,
    nonce:uint(originalDeposit.depositNonce,'nonce'),
  });
  need(pdas.receipt===receipt && pdas.config===config && pdas.vault===vault &&
    pdas.receiptBump===originalDeposit.receiptBump &&
    pdas.configBump===originalDeposit.configBump,
    'noncanonical receipt/config/vault PDA');
  const descendants=instructions.filter(ix=>ix.trace?.kind==='inner' &&
    ix.trace.outerIndex===refund.trace.index &&
    ix.programAddress===CLASSIC_TOKEN_PROGRAM);
  const transfers=descendants.filter(ix=>Buffer.from(ix.data||[])[0]===12);
  need(descendants.length===1 && transfers.length===1,
    'expected exactly one refund SPL TransferChecked CPI');
  const transfer=transfers[0],bytes=Buffer.from(transfer.data||[]);
  const amount=uint(originalDeposit.amountBaseUnits,'deposit amount');
  need(amount>0n && bytes.length===10 &&
    bytes.readBigUInt64LE(1)===amount,'refund CPI exact u64 amount mismatch');
  need(transfer.accounts?.length===4 &&
    [vault,mint,destination,config].every((x,i)=>transfer.accounts[i].address===x),
    'refund SPL CPI accounts mismatch');
  need(!instructions.some(ix=>ix!==transfer && ix.programAddress===CLASSIC_TOKEN_PROGRAM &&
    ix.accounts?.some(a=>a.address===vault || a.address===destination)),
    'another SPL CPI touches refunded custody');
  const keys=[...compiledMessage.staticAccounts,...(metadata.loadedAddresses?.writable||[]),
    ...(metadata.loadedAddresses?.readonly||[])];
  need(Array.isArray(metadata.preBalances) &&
    Array.isArray(metadata.postBalances) &&
    metadata.preBalances.length===keys.length &&
    metadata.postBalances.length===keys.length,'missing complete account balance metadata');
  const vaultIndex=keys.indexOf(vault),destIndex=keys.indexOf(destination);
  need(vaultIndex>=0 && destIndex>=0 && vaultIndex!==destIndex,
    'missing refund vault/destination account');
  const beforeVault=balance(metadata,'pre',vaultIndex,mint,config);
  const afterVault=balance(metadata,'post',vaultIndex,mint,config);
  const beforeDest=balance(metadata,'pre',destIndex,mint,owner);
  const afterDest=balance(metadata,'post',destIndex,mint,owner);
  need(beforeVault.decimals===afterVault.decimals &&
    beforeDest.decimals===afterDest.decimals &&
    beforeVault.decimals===beforeDest.decimals &&
    bytes[9]===beforeVault.decimals,'refund mint decimal inconsistency');
  need(beforeVault.amount-afterVault.amount===amount &&
    afterDest.amount-beforeDest.amount===amount,
    'refund token account deltas disagree with receipt amount');
  need(preObservation.refunded===false && postObservation.refunded===true &&
    preObservation.state==='active_refundable' && postObservation.state==='refunded',
    'receipt did not transition active to refunded');
  need(Number.isSafeInteger(preObservation.finalizedSlot) &&
    preObservation.finalizedSlot>=originalDeposit.finalizedSlot &&
    preObservation.finalizedSlot<rpcTransaction.slot &&
    postObservation.finalizedSlot===rpcTransaction.slot,
    'refund historical observation slots do not bracket exact transaction');
  need(preObservation.receiptDigest!==postObservation.receiptDigest &&
    preObservation.configDigest!==postObservation.configDigest &&
    preObservation.vaultDigest!==postObservation.vaultDigest &&
    preObservation.mintDigest===postObservation.mintDigest,
    'refund account identity/digest transition mismatch');
  need(uint(preObservation.activeLiabilitiesBaseUnits,'pre liability')-
    uint(postObservation.activeLiabilitiesBaseUnits,'post liability')===amount &&
    uint(preObservation.activeVaultBaseUnits,'pre vault')-
    uint(postObservation.activeVaultBaseUnits,'post vault')===amount &&
    uint(preObservation.activeVaultBaseUnits,'pre vault')===beforeVault.amount &&
    uint(postObservation.activeVaultBaseUnits,'post vault')===afterVault.amount,
    'refund liability/vault accounting mismatch');
  // A standalone archive cannot certify produced-slot continuity. A caller may
  // attach an indexer-built coverage record, but this remains a provider claim.
  const covered=isVerifiedHistoryCoverage(indexerHistory) &&
    indexerHistory.kind==='observer-history-coverage-v1' &&
    indexerHistory.genesisHash===genesisHash &&
    indexerHistory.fromSlot<=preObservation.finalizedSlot &&
    indexerHistory.toSlot>=rpcTransaction.slot &&
    indexerHistory.blockhashes?.[String(rpcTransaction.slot)]===blockhash &&
    indexerHistory.twoProviderFullBlocksVerified===true;
  return Object.freeze({
    kind:'solana-refund-evidence-v1',id:originalDeposit.id,
    depositOccurrenceId:originalDeposit.occurrenceId,
    depositTransactionHash:originalDeposit.transactionHash,
    receiptAddress:receipt,configAddress:config,vaultAddress:vault,mint,
    depositor:owner,destinationTokenAccount:destination,
    depositNonce:originalDeposit.depositNonce,amountBaseUnits:amount.toString(),
    signature,transactionHash,finalizedSlot:rpcTransaction.slot,blockhash,
    occurrenceId:genesisHash+':'+expected.program+':'+signature+':outer:'+refund.trace.index,
    instructionPath:'outer:'+refund.trace.index,
    cpiPath:'inner:'+refund.trace.index+':'+transfer.trace.innerIndex,
    preObservation,postObservation,source,
    historyCoveredByTwoRpcClaims:covered,transactionVerified:true,
    independentConsensusVerified:false,creditEligible:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false,
    evidenceTrust:'archived_signed_refund_and_bracketing_rpc_state_NOT_consensus',
  });
}
