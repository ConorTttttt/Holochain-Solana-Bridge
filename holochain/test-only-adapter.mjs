/**
 * TEST-ONLY substitute for Holochain coordinator calls. No conductor, DNA, zome,
 * network, economic ledger, commitment, mint, payout or spendable entry exists here.
 * This gives CI an executable OBS -> shadow classifier -> inert record boundary.
 * A single-process Map/array cannot enforce cross-process or cross-DNA uniqueness.
 */
import { reviewShadowEvidence } from './transaction-shadow.mjs';

export function createTestOnlyAdapter(binding) {
  const journal = new Map();
  const seen = new Set();
  const records = [];
  return Object.freeze({
    ingest(observation) {
      const duplicate = typeof observation?.id === 'string' && seen.has(observation.id);
      // Duplicate diagnostics must never update the live journal, even if the
      // reviewer would otherwise accept a newer slot or refund transition.
      const review = reviewShadowEvidence(observation, binding,
        duplicate ? new Map(journal) : journal);
      const verdict = duplicate ? 'rejected' : review.verdict;
      const findings = Object.freeze(duplicate
        ? [...new Set([...review.findings, 'DUPLICATE_EVIDENCE'])]
        : [...review.findings]);
      // All records, including rejected input, are local audit diagnostics.
      // No input is ever converted to an economic Holochain entry.
      const record = Object.freeze({
        kind: 'test-only-holochain-shadow-record-v1',
        mode: 'test-only-in-memory',
        evidenceId: review.evidenceId,
        verdict,
        findings,
        creditEligible: false,
        independentConsensusVerified: false,
        spendableBaseUnits: '0',
        withdrawalAuthorized: false,
        transactionVerified: false,
        deployedDnaVerified: false,
        conductorExecuted: false,
      });
      records.push(record);
      if (!duplicate && verdict === 'quarantined' && record.evidenceId !== null) {
        seen.add(record.evidenceId);
      }
      return record;
    },
    records() { return Object.freeze([...records]); },
  });
}
