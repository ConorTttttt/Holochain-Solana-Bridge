/**
 * SEC: exercise the unmodified OBS ledger against disk corruption and a hostile
 * filesystem administrator. These are local integrity boundaries, not economic
 * or finalized-history proofs. Requires the OBS+SEC integration checkout.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('SEC-LEDGER-CORRUPT: detectable bit flips vs non-authenticated local history', async t => {
  let DepositLedger;
  try {
    ({ DepositLedger } = await import('../../observer/src/ledger.mjs'));
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && /observer\/src\/ledger\.mjs/.test(error.message)) {
      t.skip('requires actual OBS source in combined checkout; not a passing security gate');
      return;
    }
    throw error;
  }
  const dir = mkdtempSync(join(tmpdir(), 'sec-ledger-corruption-'));
  const filename = join(dir, 'ledger.json');
  const options = { genesisHash:'test-genesis', program:'test-program', trustedDeploymentSlot:10 };
  const evidence = {
    kind:'solana-deposit-evidence-v1', id:'receipt1', occurrenceId:'signature:outer:0',
    transactionHash:'a'.repeat(64), amountBaseUnits:'9007199254740993',
    creditEligible:false, transactionVerified:true, independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false,
  };
  const read = () => JSON.parse(readFileSync(filename, 'utf8'));
  const save = state => writeFileSync(filename, JSON.stringify(state) + '\n');
  const reopen = () => new DepositLedger(filename, options);
  try {
    const first = reopen();
    try {
      first.commit({ checkpoint:10, block:{ slot:10, blockhash:'canonical-block' }, evidence:[evidence] });
    } finally { first.close(); }

    await t.test('uncoordinated evidence mutation fails recovery and cleans up writer lock', () => {
      const original = read();
      const corrupted = structuredClone(original);
      corrupted.processed.receipt1.evidence.amountBaseUnits = '9007199254740992';
      save(corrupted);
      assert.throws(reopen, /corrupt stored receipt evidence/);
      assert.equal(existsSync(filename + '.lock'), false);
      save(original);
    });

    await t.test('unkeyed persisted blockhash and checkpoint can be replaced by local administrator', () => {
      const original = read();
      const tampered = structuredClone(original);
      tampered.blocks['10'] = 'fabricated-block';
      tampered.checkpoint = 20; // No authenticated monotonic checkpoint anchor.
      save(tampered);
      const accepted = reopen();
      try {
        assert.equal(accepted.checkpoint, 20);
        assert.equal(read().blocks['10'], 'fabricated-block');
      } finally { accepted.close(); save(original); }
    });

    await t.test('attacker-recomputed plain SHA256 fingerprint does not authenticate evidence', () => {
      const original = read();
      const tampered = structuredClone(original);
      const row = tampered.processed.receipt1;
      row.evidence.amountBaseUnits = '9007199254740992';
      row.amountBaseUnits = row.evidence.amountBaseUnits;
      row.fingerprint = createHash('sha256').update(JSON.stringify(row.evidence)).digest('hex');
      save(tampered);
      const accepted = reopen();
      try {
        assert.equal(accepted.processed.receipt1.evidence.amountBaseUnits, '9007199254740992');
        assert.equal(accepted.processed.receipt1.evidence.creditEligible, false);
      } finally { accepted.close(); save(original); }
    });
  } finally {
    rmSync(dir, { recursive:true, force:true });
  }
});
