import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestOnlyAdapter } from '../../holochain/test-only-adapter.mjs';
import { reviewShadowEvidence } from '../../holochain/transaction-shadow.mjs';

const binding = Object.freeze({
  genesisHash: 'genesis', program: 'program', mint: 'mint', holochainScope: 'scope',
  dnaHash: 'dna-1', agreementHash: 'agreement-1', deploymentEpoch: '1',
});
const snapshot = Object.freeze({
  kind: 'solana-receipt-observation-v1',
  id: 'genesis:program:receipt-1', genesisHash: 'genesis', program: 'program',
  receiptAddress: 'receipt-1', configAddress: 'config', vaultAddress: 'vault',
  mint: 'mint', depositor: 'depositor', recipientCore: 'recipient', holochainScope: 'scope',
  depositNonce: '42', amountBaseUnits: '9007199254740993', finalizedSlot: 100,
  receiptDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64),
  vaultDigest: 'c'.repeat(64), mintDigest: 'd'.repeat(64),
  mintSupplyBaseUnits: '9999999999999999',
  activeVaultBaseUnits: '9007199254740993',
  activeLiabilitiesBaseUnits: '9007199254740993',
  configBump: 254, receiptBump: 248,
  commitmentRequested: 'finalized', transactionVerified: false,
  evidenceTrust: 'untrusted_rpc_snapshot', refunded: false,
  state: 'active_refundable', creditEligible: false,
  independentConsensusVerified: false, spendableBaseUnits: '0', withdrawalAuthorized: false,
});
const evidence = Object.freeze({
  ...Object.fromEntries([
    'id', 'program', 'receiptAddress', 'configAddress', 'vaultAddress',
    'mint', 'depositor', 'recipientCore', 'holochainScope',
    'depositNonce', 'amountBaseUnits', 'configBump', 'receiptBump',
  ].map(k => [k, snapshot[k]])),
  kind: 'solana-deposit-evidence-v1',
  occurrenceId: 'genesis:program:sig:outer:1', signature: 'sig',
  instructionPath: 'outer:1', cpiPath: 'inner:1:0',
  sourceTokenAccount: 'source', transactionVersion: 0,
  blockhash: 'block', transactionHash: 'e'.repeat(64), finalizedSlot: 99,
  verifiedByRpcClaim: true, transactionVerified: true,
  independentConsensusVerified: false,
  evidenceTrust: 'rpc_finalized_transaction_and_later_account_snapshot',
  creditEligible: false, spendableBaseUnits: '0', withdrawalAuthorized: false,
  receiptSnapshot: snapshot, observationSlot: 100,
  refundedAtObservation: false,
  limitations: ['RPC provider claims are not independent consensus'],
});

const inert = x => {
  assert.equal(x.creditEligible, false);
  assert.equal(x.spendableBaseUnits, '0');
  assert.equal(x.withdrawalAuthorized, false);
};

test('OBS v1 transaction envelope is quarantined; verifiedByRpcClaim is never RAVE verification', () => {
  const record = createTestOnlyAdapter(binding).ingest(evidence);
  assert.equal(record.verdict, 'quarantined');
  assert.ok(record.findings.includes('RPC_TX_EVIDENCE_NOT_CONSENSUS_PROOF'));
  assert.equal(record.transactionVerified, false);
  assert.equal(record.conductorExecuted, false);
  assert.equal(record.deployedDnaVerified, false);
  inert(record);
});

test('same signed deposit may be reported by separate independent journals (no global protection)', () => {
  const a = createTestOnlyAdapter(binding);
  const b = createTestOnlyAdapter({ ...binding, dnaHash: 'different-dna' });
  assert.equal(a.ingest(evidence).verdict, 'quarantined');
  assert.equal(a.ingest(evidence).verdict, 'rejected');
  assert.ok(a.records()[1].findings.includes('DUPLICATE_EVIDENCE'));
  assert.equal(b.ingest(evidence).verdict, 'quarantined');
  for (const record of [...a.records(), ...b.records()]) inert(record);
});

test('top-level candidate/snapshot identity disagreement is rejected without journal writes', () => {
  for (const changed of [
    { amountBaseUnits: '1' }, { recipientCore: 'different' },
    { receiptAddress: 'wrong' }, { configBump: 4 }, { id: 'other' },
    { mint: 'wrong' }, { holochainScope: 'other' },
  ]) {
    const journal = new Map();
    const result = reviewShadowEvidence({ ...evidence, ...changed }, binding, journal);
    assert.equal(result.verdict, 'rejected');
    assert.ok(result.findings.some(x => x.startsWith('TX_SNAPSHOT_MISMATCH_')));
    assert.equal(journal.size, 0);
    inert(result);
  }
});

test('envelope missing origin and invalid signed-instruction identity are rejected', () => {
  for (const changed of [
    { receiptSnapshot: null }, { signature: '' }, { transactionHash: 'not-a-hash' },
    { occurrenceId: 'genesis:program:other:outer:1' },
    { instructionPath: 'inner:1' }, { cpiPath: 'inner:9:0' },
    { observationSlot: 98 }, { finalizedSlot: 101 }, { transactionVersion: 2 },
  ]) {
    const journal = new Map();
    const result = reviewShadowEvidence({ ...evidence, ...changed }, binding, journal);
    assert.equal(result.verdict, 'rejected', JSON.stringify(changed));
    assert.equal(journal.size, 0);
    inert(result);
  }
});

test('forged trust escalation or missing limitations never authorizes credit', () => {
  for (const changed of [
    { verifiedByRpcClaim: false }, { transactionVerified: false },
    { independentConsensusVerified: true }, { evidenceTrust: 'trusted' },
    { creditEligible: true }, { limitations: [] }, { limitations: ['good', null] },
  ]) {
    const result = createTestOnlyAdapter(binding).ingest({ ...evidence, ...changed });
    assert.equal(result.verdict, 'rejected');
    assert.ok(result.findings.includes('TX_EVIDENCE_TRUST_ESCALATION'));
    inert(result);
  }
});

test('bad inner receipt and binding still fail through existing account-state verifier', () => {
  for (const changed of [
    { amountBaseUnits: '5.1' },
    { transactionVerified: true },
    { evidenceTrust: 'trusted' },
    { receiptDigest: 'g'.repeat(64) },
  ]) {
    const receiptSnapshot = { ...snapshot, ...changed };
    const parent = { ...evidence, receiptSnapshot };
    if (changed.amountBaseUnits) parent.amountBaseUnits = changed.amountBaseUnits;
    const result = reviewShadowEvidence(parent, binding, new Map());
    assert.equal(result.verdict, 'rejected');
    inert(result);
  }
  const wrongBinding = reviewShadowEvidence(evidence, { ...binding, mint: 'wrong' }, new Map());
  assert.equal(wrongBinding.verdict, 'rejected');
  inert(wrongBinding);
});

test('refund state remains quarantined, never spendable or withdrawal-eligible', () => {
  const receiptSnapshot = { ...snapshot, refunded: true, state: 'refunded',
    receiptDigest: 'f'.repeat(64), finalizedSlot: 110 };
  const record = createTestOnlyAdapter(binding).ingest({
    ...evidence, receiptSnapshot, observationSlot: 110, refundedAtObservation: true,
  });
  assert.equal(record.verdict, 'quarantined');
  assert.ok(record.findings.includes('REFUNDED_COLLATERAL'));
  inert(record);
});

test('both CLI entry points accept valid transaction evidence only in shadow mode', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'rave-shadow-'));
  try {
    const config = join(tmp, 'binding.json');
    writeFileSync(config, JSON.stringify(binding));
    for (const [script, payload] of [
      ['../../holochain/shadow-cli.mjs', evidence],
      ['../../holochain/test-only-adapter-cli.mjs', [evidence]],
    ]) {
      const path = fileURLToPath(new URL(script, import.meta.url));
      const run = spawnSync(process.execPath, [path, config], {
        input: JSON.stringify(payload), encoding: 'utf8',
      });
      assert.equal(run.status, 0, run.stderr);
      const output = JSON.parse(run.stdout);
      const record = output.results?.[0] ?? output;
      assert.equal(record.verdict, 'quarantined');
      inert(record);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('combined OBS evidence rejects missing or escalated denial flags at either layer', () => {
  const probes = [
    ['creditEligible', true, 'TX_EVIDENCE_TRUST_ESCALATION', 'CREDIT_ELIGIBILITY_ESCALATION'],
    ['independentConsensusVerified', true, 'TX_EVIDENCE_TRUST_ESCALATION', 'INDEPENDENT_CONSENSUS_ESCALATION'],
    ['spendableBaseUnits', '1', 'TX_EVIDENCE_TRUST_ESCALATION', 'SPENDABLE_BALANCE_ESCALATION'],
    ['withdrawalAuthorized', true, 'TX_EVIDENCE_TRUST_ESCALATION', 'WITHDRAWAL_AUTHORIZATION_ESCALATION'],
  ];
  for (const [field, wrongValue, topFinding, nestedFinding] of probes) {
    for (const value of [wrongValue, undefined]) {
      const topJournal = new Map();
      const top = reviewShadowEvidence({ ...evidence, [field]: value }, binding, topJournal);
      assert.equal(top.verdict, 'rejected', field + ': parent');
      assert.ok(top.findings.includes(topFinding), field + ': parent finding');
      assert.equal(topJournal.size, 0);
      inert(top);
      const nestedJournal = new Map();
      const nested = reviewShadowEvidence({
        ...evidence, receiptSnapshot: { ...snapshot, [field]: value },
      }, binding, nestedJournal);
      assert.equal(nested.verdict, 'rejected', field + ': receipt');
      assert.ok(nested.findings.includes(nestedFinding), field + ': receipt finding');
      assert.equal(nestedJournal.size, 0);
      inert(nested);
    }
  }
});
