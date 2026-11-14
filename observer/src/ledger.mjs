/** Crash-consistent single-writer ledger. No issuance or signing operations. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, renameSync, closeSync, fsyncSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function need(ok, message) { if (!ok) throw new Error('Indexer ledger failed: ' + message); }
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function record(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
/**
 * A checksum stored alongside the evidence is corruption detection, NOT an
 * authenticated journal. An attacker who can rewrite both JSON and checksums
 * can forge a local ledger; operators must protect and independently back it up.
 */
function validateRecoveredEntries(state) {
  need(record(state.processed) && record(state.blocks), 'incompatible/corrupt durable ledger objects');
  const occurrences = new Set();
  for (const [id, row] of Object.entries(state.processed)) {
    need(record(row) && record(row.evidence) &&
      row.evidence.kind === 'solana-deposit-evidence-v1' &&
      row.evidence.creditEligible === false &&
      row.evidence.transactionVerified === true &&
      row.evidence.independentConsensusVerified === false &&
      row.evidence.spendableBaseUnits === '0' &&
      row.evidence.withdrawalAuthorized === false &&
      row.evidence.id === id &&
      typeof row.occurrenceId === 'string' && row.occurrenceId.length > 0 &&
      row.evidence.occurrenceId === row.occurrenceId &&
      row.evidence.transactionHash === row.transactionHash &&
      row.evidence.amountBaseUnits === row.amountBaseUnits &&
      row.fingerprint === hash(row.evidence) &&
      !occurrences.has(row.occurrenceId),
      'corrupt stored receipt evidence/occurrence/fingerprint');
    occurrences.add(row.occurrenceId);
  }
  for (const [id,row] of Object.entries(state.processed)) {
    if (row.refund === undefined) continue;
    const refund=row.refund, item=refund?.evidence;
    need(record(refund) && record(item) &&
      item.kind==='solana-refund-evidence-v1' &&
      item.creditEligible===false && item.transactionVerified===true &&
      item.independentConsensusVerified===false &&
      item.spendableBaseUnits==='0' && item.withdrawalAuthorized===false &&
      item.historyCoveredByTwoRpcClaims===true &&
      item.id===id && item.receiptAddress===row.evidence.receiptAddress &&
      item.depositOccurrenceId===row.occurrenceId &&
      item.depositTransactionHash===row.transactionHash &&
      item.amountBaseUnits===row.amountBaseUnits &&
      item.occurrenceId===refund.occurrenceId &&
      item.transactionHash===refund.transactionHash &&
      item.amountBaseUnits===refund.amountBaseUnits &&
      refund.fingerprint===hash(item) &&
      typeof refund.occurrenceId==='string' &&
      !occurrences.has(refund.occurrenceId) &&
      Number.isSafeInteger(item.finalizedSlot) &&
      item.finalizedSlot>row.evidence.finalizedSlot &&
      item.finalizedSlot<=state.checkpoint &&
      item.preObservation?.refunded===false &&
      item.postObservation?.refunded===true &&
      item.postObservation?.finalizedSlot===item.finalizedSlot,
      'corrupt stored refund transition/fingerprint/replay/authority');
    occurrences.add(refund.occurrenceId);
  }
  for (const [key, blockhash] of Object.entries(state.blocks)) {
    const n = Number(key);
    need(/^(0|[1-9][0-9]*)$/.test(key) && Number.isSafeInteger(n) &&
      n >= state.trustedDeploymentSlot && n <= state.checkpoint &&
      typeof blockhash === 'string' && blockhash.length > 0,
      'corrupt stored finalized block identity');
  }
}
function slot(n) { need(Number.isSafeInteger(n) && n >= 0, 'invalid slot'); return n; }

/** One process may hold the ledger lock. Stale locks must be investigated, not auto-stolen. */
export class DepositLedger {
  constructor(filename, {genesisHash, program, trustedDeploymentSlot}) {
    need(typeof filename === 'string' && filename.length > 0, 'missing ledger path');
    slot(trustedDeploymentSlot); need(trustedDeploymentSlot > 0, 'deployment slot must be positive');
    need(genesisHash && program, 'missing pinned chain/program identities');
    this.filename = resolve(filename);
    mkdirSync(dirname(this.filename), {recursive:true, mode:0o700});
    this.lockFile = this.filename + '.lock';
    this.lockFd = openSync(this.lockFile, 'wx', 0o600);
    try {
      const initial = {
        version:1, genesisHash, program, trustedDeploymentSlot,
        checkpoint:trustedDeploymentSlot-1, processed:{}, blocks:{},
      };
      this.state = existsSync(this.filename) ? JSON.parse(readFileSync(this.filename,'utf8')) : initial;
      need(this.state.version === 1 &&
        this.state.genesisHash === genesisHash && this.state.program === program &&
        this.state.trustedDeploymentSlot === trustedDeploymentSlot &&
        Number.isSafeInteger(this.state.checkpoint) &&
        this.state.checkpoint >= trustedDeploymentSlot - 1 &&
        record(this.state.processed) && record(this.state.blocks),
        'incompatible/corrupt durable ledger');
      validateRecoveredEntries(this.state);
      // Fresh ledger is only written at first finalized checkpoint, after successful RPC checks.
    } catch(e) {
      closeSync(this.lockFd); unlinkSync(this.lockFile); this.lockFd=null;
      throw e;
    }
  }
  get checkpoint() { return this.state.checkpoint; }
  get processed() { return {...this.state.processed}; }
  /** Explicit observed state: a refunded receipt may never be labelled locked. */
  receiptState(id) {
    const row=this.state.processed[id];
    return !row ? 'unknown' : row.refund ? 'refunded' : 'active_refundable_unverified';
  }
  /** Commit new evidence and cursor in ONE atomic replacement (write+fsync+rename+dir fsync). */
  commit({checkpoint, block, evidence = [], refunds = []}) {
    need(this.lockFd !== null, 'ledger closed');
    slot(checkpoint);
    need(checkpoint >= this.state.checkpoint, 'checkpoint regression');
    need(Array.isArray(evidence) && Array.isArray(refunds), 'invalid evidence/refund batch');
    const next=structuredClone(this.state);
    if (block) {
      slot(block.slot);
      need(block.slot <= checkpoint && typeof block.blockhash === 'string' && block.blockhash.length > 0,
        'invalid finalized block identity');
      const old = next.blocks[String(block.slot)];
      need(!old || old === block.blockhash, 'conflicting finalized blockhash');
      next.blocks[String(block.slot)] = block.blockhash;
    }
    for(const item of evidence) {
      need(item?.kind === 'solana-deposit-evidence-v1' &&
        item.creditEligible === false && item.transactionVerified === true &&
        item.independentConsensusVerified === false &&
        item.spendableBaseUnits === '0' &&
        item.withdrawalAuthorized === false &&
        typeof item.id === 'string' && typeof item.occurrenceId === 'string',
        'invalid or authoritative deposit evidence');
      const fingerprint=hash(item);
      const previous=next.processed[item.id];
      if (previous) {
        need(previous.occurrenceId === item.occurrenceId && previous.transactionHash === item.transactionHash &&
          previous.amountBaseUnits === item.amountBaseUnits && previous.fingerprint === fingerprint,
          'conflicting duplicate receipt identity or evidence bytes');
        // Exact replay is idempotent; later observations must not overwrite original evidence.
        continue;
      }
      need(!Object.values(next.processed).some(x=>x.occurrenceId===item.occurrenceId),
        'duplicated instruction occurrence');
      next.processed[item.id] = {
        occurrenceId:item.occurrenceId, transactionHash:item.transactionHash,
        amountBaseUnits:item.amountBaseUnits, fingerprint, evidence:item,
      };
    }
    // Each authenticated refund revokes ONE previously observed active receipt.
    // Duplicate refunds (even byte-identical replays) are rejected. A complete
    // produced-slot history claim is mandatory but is NOT independent consensus.
    const refundOccurrences=new Set();
    for (const item of refunds) {
      need(item?.kind==='solana-refund-evidence-v1' &&
        item.creditEligible===false && item.transactionVerified===true &&
        item.independentConsensusVerified===false &&
        item.spendableBaseUnits==='0' && item.withdrawalAuthorized===false &&
        item.historyCoveredByTwoRpcClaims===true &&
        typeof item.id==='string' && typeof item.occurrenceId==='string',
        'invalid, incomplete-history or authoritative refund evidence');
      const prior=next.processed[item.id];
      need(prior && !prior.refund,'duplicate refund or missing original deposit');
      need(prior.evidence.refundedAtObservation===false &&
        prior.evidence.receiptSnapshot?.refunded===false,
        'original deposit was already refunded/unverified');
      need(item.depositOccurrenceId===prior.occurrenceId &&
        item.depositTransactionHash===prior.transactionHash &&
        item.amountBaseUnits===prior.amountBaseUnits &&
        item.receiptAddress===prior.evidence.receiptAddress &&
        Number.isSafeInteger(item.finalizedSlot) &&
        item.finalizedSlot>prior.evidence.finalizedSlot &&
        item.finalizedSlot<=checkpoint &&
        item.preObservation?.refunded===false &&
        item.postObservation?.refunded===true &&
        item.postObservation?.finalizedSlot===item.finalizedSlot,
        'refund contradicts original receipt/slot/state');
      need(!refundOccurrences.has(item.occurrenceId) &&
        !Object.values(next.processed).some(row =>
          row.occurrenceId===item.occurrenceId ||
          row.refund?.occurrenceId===item.occurrenceId),
        'duplicated refund occurrence');
      refundOccurrences.add(item.occurrenceId);
      prior.refund={
        occurrenceId:item.occurrenceId,transactionHash:item.transactionHash,
        amountBaseUnits:item.amountBaseUnits,fingerprint:hash(item),evidence:item,
      };
    }
    next.checkpoint=checkpoint;
    const tmp=this.filename+'.tmp.'+process.pid;
    let fd;
    try {
      fd=openSync(tmp,'wx',0o600);
      writeFileSync(fd,JSON.stringify(next,null,2)+'\n');
      fsyncSync(fd);
      closeSync(fd);fd=null;
      renameSync(tmp,this.filename);
      const parent=openSync(dirname(this.filename),'r');
      try { fsyncSync(parent); } finally { closeSync(parent); }
      this.state=next;
    } catch(e) {
      if(fd!==undefined && fd!==null) closeSync(fd);
      if(existsSync(tmp)) unlinkSync(tmp);
      throw e;
    }
    return {checkpoint:next.checkpoint,processed:Object.keys(next.processed).length};
  }
  close() {
    if (this.lockFd !== null) { closeSync(this.lockFd); unlinkSync(this.lockFile);this.lockFd=null; }
  }
}
