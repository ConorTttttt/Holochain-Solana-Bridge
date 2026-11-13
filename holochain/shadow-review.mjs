/**
 * Read-only classification of untrusted Solana RPC observations.
 * NEVER issues credit, produces a proof, or authorizes withdrawal.
 * The Map is a disposable offline-fixture journal, NOT a durable replay ledger.
 */
const U64_MAX = (1n << 64n) - 1n;
const REQUIRED = [
  'id', 'kind', 'genesisHash', 'program', 'receiptAddress', 'configAddress',
  'vaultAddress', 'mint', 'depositor', 'recipientCore', 'holochainScope',
  'depositNonce', 'amountBaseUnits', 'finalizedSlot', 'receiptDigest',
  'refunded', 'state', 'creditEligible',
];
const isText = value => typeof value === 'string' && value.length > 0;

/** All outputs are non-economic even for otherwise consistent observations. */
export function reviewShadow(observation, binding, journal) {
  const findings = [];
  const flag = code => { if (!findings.includes(code)) findings.push(code); };
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    flag('MALFORMED_OBSERVATION');
  } else {
    for (const key of REQUIRED) {
      if (!Object.hasOwn(observation, key)) flag('MISSING_' + key);
    }
    if (observation.kind !== 'solana-receipt-observation-v1') flag('UNRECOGNIZED_SCHEMA');
    for (const field of ['id', 'genesisHash', 'program', 'receiptAddress', 'configAddress',
      'vaultAddress', 'mint', 'depositor', 'recipientCore', 'holochainScope', 'receiptDigest']) {
      if (!isText(observation[field])) flag('INVALID_' + field);
    }
    if (observation.id !== `${observation.genesisHash}:${observation.program}:${observation.receiptAddress}`) {
      flag('DEPOSIT_IDENTITY_MISMATCH');
    }
    if (!/^[0-9a-f]{64}$/i.test(observation.receiptDigest ?? '')) flag('INVALID_RECEIPT_DIGEST');
    if (!/^\d+$/.test(observation.amountBaseUnits ?? '')) flag('INVALID_AMOUNT');
    else {
      const amount = BigInt(observation.amountBaseUnits);
      if (amount === 0n || amount > U64_MAX) flag('INVALID_AMOUNT');
    }
    if (!Number.isSafeInteger(observation.finalizedSlot) || observation.finalizedSlot <= 0) flag('INVALID_SLOT');
    if (observation.creditEligible !== false) flag('CREDIT_ELIGIBILITY_ESCALATION');
    if (typeof observation.refunded !== 'boolean') flag('INVALID_REFUND_FLAG');
    if (observation.state !== (observation.refunded ? 'refunded' : 'active_refundable')) {
      flag('INCONSISTENT_REFUND_STATE');
    }
    if (observation.refunded) flag('REFUNDED_COLLATERAL');
    else flag('REFUNDABLE_COLLATERAL');
  }
  if (!binding || !['genesisHash', 'program', 'mint', 'holochainScope', 'dnaHash',
    'agreementHash', 'deploymentEpoch'].every(k => isText(binding[k]))) {
    flag('MISSING_EXPLICIT_BINDING');
  } else if (observation && typeof observation === 'object') {
    for (const key of ['genesisHash', 'program', 'mint', 'holochainScope']) {
      if (observation[key] !== binding[key]) flag('BINDING_MISMATCH_' + key);
    }
  }
  if (!(journal instanceof Map)) flag('NO_SHARED_AUDIT_JOURNAL');
  if (observation && binding && journal instanceof Map && isText(observation.id)) {
    const prior = journal.get(observation.id);
    const target = `${binding.dnaHash}:${binding.agreementHash}:${binding.deploymentEpoch}`;
    if (prior) {
      if (prior.target !== target) flag('CROSS_AGREEMENT_OR_EPOCH_REPLAY');
      if (observation.finalizedSlot < prior.slot) flag('STALE_SNAPSHOT');
      if (prior.refunded && !observation.refunded) flag('REFUND_STATE_ROLLBACK');
      if (prior.digest !== observation.receiptDigest) {
        if (!prior.refunded && observation.refunded && observation.finalizedSlot >= prior.slot) {
          flag('REFUND_TRANSITION');
        } else flag('CONFLICTING_RECEIPT_HISTORY');
      }
    }
    // Record only non-conflicting observations. In production, a durable, shared,
    // atomic event log would be needed even for idempotent audit records.
    if (findings.every(f => ['REFUNDABLE_COLLATERAL', 'REFUNDED_COLLATERAL',
      'REFUND_TRANSITION'].includes(f))) {
      journal.set(observation.id, {
        target, slot: observation.finalizedSlot,
        digest: observation.receiptDigest, refunded: observation.refunded,
      });
    }
  }
  const violations = findings.filter(x => !['REFUNDABLE_COLLATERAL', 'REFUNDED_COLLATERAL', 'REFUND_TRANSITION'].includes(x));
  return Object.freeze({
    mode: 'shadow-only',
    verdict: violations.length ? 'rejected' : 'quarantined',
    findings: Object.freeze(findings),
    evidenceId: isText(observation?.id) ? observation.id : null,
    creditEligible: false,
    spendableBaseUnits: '0',
    withdrawalAuthorized: false,
    proofStatus: 'untrusted-rpc-observation',
  });
}
