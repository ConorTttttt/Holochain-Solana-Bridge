/**
 * Shadow-only bridge for OBS PR #36's solana-deposit-evidence-v1 envelope.
 * Envelope checks are schema/consistency checks ONLY: do not cryptographically
 * verify Solana, validate Holochain zomes, or provide economic authorization.
 * No journal is mutated when the envelope fails validation.
 */
import { reviewShadow } from './shadow-review.mjs';

const isText = x => typeof x === 'string' && x.length > 0;
const isDigest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const isSlot = x => Number.isSafeInteger(x) && x > 0;
const isSafePathIndex = x => Number.isSafeInteger(Number(x));
const fields = [
  'id', 'program', 'receiptAddress', 'configAddress', 'vaultAddress',
  'mint', 'depositor', 'recipientCore', 'holochainScope',
  'depositNonce', 'amountBaseUnits', 'configBump', 'receiptBump',
];

function deny(evidence, findings) {
  return Object.freeze({
    mode: 'shadow-only', verdict: 'rejected', findings: Object.freeze(findings),
    evidenceId: isText(evidence?.id) ? evidence.id : null,
    creditEligible: false, spendableBaseUnits: '0',
    withdrawalAuthorized: false, proofStatus: 'untrusted-rpc-transaction-envelope',
    independentConsensusVerified: false, conductorExecuted: false,
  });
}

/** Accept only the exact OBS envelope or the original untrusted account snapshot. */
export function reviewShadowEvidence(evidence, binding, journal) {
  if (evidence?.kind !== 'solana-deposit-evidence-v1') {
    return reviewShadow(evidence, binding, journal);
  }

  const findings = [];
  const flag = name => { if (!findings.includes(name)) findings.push(name); };
  const snapshot = evidence.receiptSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    flag('TX_MISSING_RECEIPT_SNAPSHOT');
  } else {
    if (snapshot.kind !== 'solana-receipt-observation-v1') flag('TX_WRONG_SNAPSHOT_SCHEMA');
    for (const field of fields) {
      if (evidence[field] !== snapshot[field]) flag('TX_SNAPSHOT_MISMATCH_' + field);
    }
    if (evidence.observationSlot !== snapshot.finalizedSlot ||
        evidence.refundedAtObservation !== snapshot.refunded) {
      flag('TX_SNAPSHOT_STATE_MISMATCH');
    }
    if (!isSlot(evidence.finalizedSlot) || !isSlot(evidence.observationSlot) ||
        evidence.finalizedSlot > evidence.observationSlot) {
      flag('TX_INVALID_SLOT_RELATION');
    }
  }
  if (!isText(evidence.signature) || !isText(evidence.blockhash) ||
      !isText(evidence.sourceTokenAccount) || !isDigest(evidence.transactionHash)) {
    flag('TX_MISSING_PROVENANCE_FIELDS');
  }
  if (!['legacy', 0, 1].includes(evidence.transactionVersion)) {
    flag('TX_UNSUPPORTED_TRANSACTION_VERSION');
  }
  if (typeof evidence.instructionPath !== 'string' ||
      !/^outer:(0|[1-9][0-9]*)$/.test(evidence.instructionPath) ||
      !isText(evidence.signature) ||
      evidence.occurrenceId !==
        `${snapshot?.genesisHash}:${evidence.program}:${evidence.signature}:${evidence.instructionPath}`) {
    flag('TX_OCCURRENCE_IDENTITY_MISMATCH');
  }
  if (typeof evidence.cpiPath !== 'string' ||
      !/^inner:(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(evidence.cpiPath) ||
      (typeof evidence.instructionPath === 'string' &&
       evidence.cpiPath.split(':')[1] !== evidence.instructionPath.split(':')[1])) {
    flag('TX_INVALID_CPI_PATH');
  }
  const outer = /^outer:(0|[1-9][0-9]*)$/.exec(evidence.instructionPath || '');
  const inner = /^inner:(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.exec(evidence.cpiPath || '');
  if ((outer && !isSafePathIndex(outer[1])) ||
      (inner && (!isSafePathIndex(inner[1]) || !isSafePathIndex(inner[2])))) {
    flag('TX_UNSAFE_INSTRUCTION_INDEX');
  }
  if (journal instanceof Map) {
    const prior = journal.get(evidence.id);
    if (prior?.occurrenceId && prior.occurrenceId !== evidence.occurrenceId) {
      flag('TX_CONFLICTING_OCCURRENCE');
    }
    if (prior?.transactionHash && prior.transactionHash !== evidence.transactionHash) {
      flag('TX_CONFLICTING_TRANSACTION_HASH');
    }
    for (const [id, recorded] of journal) {
      if (id !== evidence.id && recorded?.occurrenceId === evidence.occurrenceId) {
        flag('TX_DUPLICATE_INSTRUCTION_OCCURRENCE');
      }
    }
  }
  if (evidence.transactionVerified !== true ||
      evidence.verifiedByRpcClaim !== true ||
      evidence.independentConsensusVerified !== false ||
      evidence.evidenceTrust !== 'rpc_finalized_transaction_and_later_account_snapshot' ||
      evidence.creditEligible !== false ||
      !Array.isArray(evidence.limitations) || evidence.limitations.length === 0 ||
      !evidence.limitations.every(isText)) {
    flag('TX_EVIDENCE_TRUST_ESCALATION');
  }
  if (findings.length) return deny(evidence, findings);

  // Review the nested receipt before writing an inert, local-only journal entry.
  // Even when its parent envelope claims locally verified signatures, RAVE has
  // NOT rerun that verification or observed independent Solana consensus.
  const staged = journal instanceof Map ? new Map(journal) : journal;
  const reviewed = reviewShadow(snapshot, binding, staged);
  if (reviewed.verdict === 'quarantined' && journal instanceof Map) {
    journal.set(evidence.id, {
      ...staged.get(evidence.id), occurrenceId: evidence.occurrenceId,
      transactionHash: evidence.transactionHash,
    });
  }
  return Object.freeze({
    ...reviewed,
    findings: Object.freeze([...reviewed.findings, 'RPC_TX_EVIDENCE_NOT_CONSENSUS_PROOF']),
    proofStatus: 'untrusted-rpc-transaction-envelope',
    independentConsensusVerified: false, conductorExecuted: false,
  });
}
