/**
 * Verify one genuine archival deposit -> refund witness pair with real Kit.
 * Refuses durable refund admission WITHOUT the missing complete produced-slot
 * history. Never writes credits or a production ledger.
 *
 * node observer/scripts/replay-refund-witness.mjs <localnet-evidence> \
 *   <pinned-lifecycle-manifest.json> <IDL> <ELF> \
 *   <original-deposit-signature> <original-refund-signature>
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {preflightValidatorWitness} from './replay-validator-witness.mjs';
import {signatureOf,sameSolanaExecutionMeta} from '../src/indexer.mjs';
import {verifyDepositCandidates,attachReceiptObservation} from '../src/transaction.mjs';
import {verifyRefundTransition} from '../src/refund.mjs';
import {verifySnapshot} from '../src/verify.mjs';

const need=(ok,msg)=>{if(!ok) throw new Error('Original refund replay failed: '+msg);};
export async function replayOriginalRefund({
  dir,trusted,idlPath,elfPath,depositSignature,refundSignature,
}) {
  const archive=preflightValidatorWitness({
    dir,mode:'lifecycle',trusted,idlPath,elfPath,
  });
  const bySignature=new Map();
  for(const item of archive.transactions) {
    const signatures=await Promise.all(item.blockBase64.transactions.map(signatureOf));
    need(new Set(signatures).size===signatures.length,
      'duplicate signed transaction in containing block');
    const indexes=signatures.map((sig,i)=>sig===item.witness.signature?i:-1)
      .filter(i=>i>=0);
    need(indexes.length===1,'transaction absent/duplicated in full block');
    const contained=item.blockBase64.transactions[indexes[0]];
    need(JSON.stringify(contained.transaction)===JSON.stringify(item.signed.transaction) &&
      contained.version===item.signed.version &&
      sameSolanaExecutionMeta(contained.meta,item.signed.meta),
      'signed wire or execution metadata contradicts original containing block');
    bySignature.set(item.witness.signature,item);
  }
  const depositWitness=bySignature.get(depositSignature);
  const refundWitness=bySignature.get(refundSignature);
  need(depositWitness && refundWitness &&
    depositWitness.signed.meta.err===null &&
    refundWitness.signed.meta.err===null &&
    depositWitness.witness.slot<refundWitness.witness.slot,
    'missing genuine included deposit/refund pair in chronological order');
  const idl=JSON.parse(archive.idlText);
  const candidates=await verifyDepositCandidates({
    rpcTransaction:depositWitness.signed,signature:depositSignature,
    expected:trusted.expected,genesisHash:trusted.genesisHash,idl,
    finalizedClaim:true,blockhash:depositWitness.witness.blockhash,
    source:'original_localnet_base64_getTransaction_and_getBlock',
  });
  need(candidates.length===1,'genuine example must have exactly one canonical deposit');
  const candidate=candidates[0];
  const snapshots=new Map(archive.snapshots.map(x=>[x.snapshot.label,x]));
  const decodeSnapshot=async label=>{
    const {snapshot,raw}=snapshots.get(label)||{};
    need(snapshot?.accounts?.length===4 &&
      snapshot.accounts[0].address===candidate.receiptAddress &&
      snapshot.accounts[1].address===trusted.expected.config &&
      snapshot.accounts[2].address===trusted.expected.vault &&
      snapshot.accounts[3].address===trusted.expected.mint,
      'historical refund snapshot is missing/cross-receipt');
    return verifySnapshot({
      snapshot:{slot:snapshot.slot,accounts:raw.value.map(a=>({
        owner:a.owner,raw:Buffer.from(a.data[0],'base64'),
      }))},
      expected:{...trusted.expected,receipt:candidate.receiptAddress},
      genesisHash:trusted.genesisHash,
      source:'original_localnet_account_snapshot',
    });
  };
  const preObservation=await decodeSnapshot('active-receipt');
  const postObservation=await decodeSnapshot('refunded-receipt');
  const originalDeposit=attachReceiptObservation(candidate,preObservation);
  const refund=await verifyRefundTransition({
    rpcTransaction:refundWitness.signed,signature:refundSignature,
    expected:trusted.expected,genesisHash:trusted.genesisHash,idl,
    blockhash:refundWitness.witness.blockhash,
    originalDeposit,preObservation,postObservation,finalizedClaim:true,
    // The original 14106778660 ZIP is NOT a complete two-provider
    // getBlocks/getBlock history. Never fabricate the missing coverage record.
    indexerHistory:null,source:'original_localnet_signed_refund_witness',
  });
  need(refund.historyCoveredByTwoRpcClaims===false &&
    refund.creditEligible===false &&
    refund.independentConsensusVerified===false &&
    refund.spendableBaseUnits==='0' && refund.withdrawalAuthorized===false,
    'incorrect history or economic authorization escalation');
  return {deposit:originalDeposit,refund,
    accepted:archive.accepted,rejected:archive.rejected,
    historyIndexed:false,refundDurablyCommitted:false,
    creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const [dir,manifest,idlPath,elfPath,depositSignature,refundSignature]=process.argv.slice(2);
    need([dir,manifest,idlPath,elfPath,depositSignature,refundSignature].every(Boolean),
      'usage <archive-dir> <pinned-manifest> <IDL> <ELF> <deposit-sig> <refund-sig>');
    const result=await replayOriginalRefund({
      dir,trusted:JSON.parse(readFileSync(manifest,'utf8')),idlPath,elfPath,
      depositSignature,refundSignature,
    });
    console.error('REFUND WITNESS VERIFIED, HISTORY INCOMPLETE: no durable transition or credit');
    console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
