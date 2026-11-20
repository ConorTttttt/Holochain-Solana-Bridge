/**
 * End-to-end, disposable read-only witness -> JSON durable journal -> reopen
 * -> replay-idempotence demonstration. DOES NOT advance a historical cursor.
 * NO Holochain credit, withdrawal or independent consensus authorization.
 */
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync as read} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {replayValidatorWitness} from './replay-validator-witness.mjs';
import {DepositLedger} from '../src/ledger.mjs';

const need=(x,msg)=>{if(!x)throw new Error('Quarantined deposit ledger replay failed: '+msg);};
export async function replayQuarantinedDepositLedger(options) {
  const data=await replayValidatorWitness(options);
  const {evidence}=data;
  need(evidence.length>0 && evidence.every(item=>
    item.kind==='solana-deposit-evidence-v1' &&
    item.transactionVerified===true &&
    item.creditEligible===false && item.independentConsensusVerified===false &&
    item.spendableBaseUnits==='0' && item.withdrawalAuthorized===false),
    'missing or economically authoritative genuine deposit');
  const {trusted}=options;
  const directory=mkdtempSync(join(tmpdir(),'quarantined-observer-replay-'));
  const filename=join(directory,'ledger.json');
  const ledgerOpts={genesisHash:trusted.genesisHash,program:trusted.programId,
    trustedDeploymentSlot:trusted.trustedDeploymentSlot};
  const checkpoint=trusted.trustedDeploymentSlot-1;
  let first;
  try {
    const a=new DepositLedger(filename,ledgerOpts);
    try {
      first=a.commit({checkpoint,evidence});
      need(first.processed===evidence.length && a.checkpoint===checkpoint,
        'historical cursor must never advance through missing archive');
    } finally {a.close();}
    const before=readFileSync(filename,'utf8');
    const b=new DepositLedger(filename,ledgerOpts);
    try {
      need(b.checkpoint===checkpoint &&
        Object.keys(b.processed).length===evidence.length,
        'durable journal reopen lost genuine deposit');
      const replay=b.commit({checkpoint,evidence});
      need(replay.processed===first.processed,
        'duplicate original deposit was accepted twice');
      const invalid={...evidence[0],amountBaseUnits:'1'};
      let refused=false;
      try {b.commit({checkpoint,evidence:[invalid]});}
      catch(error){refused=/conflicting duplicate/.test(error.message);}
      need(refused,'conflicting duplicate must be refused');
      need(readFileSync(filename,'utf8')===before &&
        b.checkpoint===checkpoint,'duplicate/refusal mutated durable journal');
    } finally {b.close();}
    return {
      witnessVerified:true,durableCommitAndReopen:true,
      duplicateAcceptanceRefused:true,conflictingReplayRefused:true,
      historyIndexed:false,checkpoint,processed:first.processed,
      shadowEvidence:evidence,
      creditEligible:false,independentConsensusVerified:false,
      spendableBaseUnits:'0',withdrawalAuthorized:false,
    };
  } finally {rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const [dir,mode,manifest,idlPath,elfPath,signature]=process.argv.slice(2);
    need([dir,mode,manifest,idlPath,elfPath,signature].every(Boolean),
      'usage <archive> <mode> <manifest> <IDL> <ELF> <deposit-signature>');
    const output=await replayQuarantinedDepositLedger({
      dir,mode,trusted:JSON.parse(read(manifest,'utf8')),
      idlPath,elfPath,signature,
    });
    console.error('TEST-ONLY durable reopen; historical cursor UNCHANGED; shadow/quarantine only');
    console.log(JSON.stringify(output,null,2));
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
