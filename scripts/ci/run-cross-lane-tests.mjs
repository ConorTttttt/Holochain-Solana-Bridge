// Cross-lane fixture tests. In integration mode ALL declared suites are required.
// These are offline/model tests: only the independent localnet job proves on-chain execution.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cases = [
  ['observer-main', 'observer/test/verify.test.mjs'],
  ['observer-idl-contract', 'observer/test/idl-contract.test.mjs'],
  ['observer-transaction', 'observer/test/transaction.test.mjs'],
  ['observer-finalized-indexer', 'observer/test/indexer.test.mjs'],
  ['observer-durable-ledger', 'observer/test/ledger.test.mjs'],
  ['observer-real-localnet-fixtures', 'observer/test/real-localnet.test.mjs'],
  ['observer-validator-witness-rejection', 'observer/test/validator-witness.test.mjs'],
  ['sol-layout', 'tests/solana/layout.test.mjs'],
  ['sol-sdk-signature-regressions', 'tests/solana/sdk-compat.test.mjs'],
  ['security-adversarial', 'security/test/adversarial.test.mjs'],
  ['security-solvency', 'security/test/solvency-model.test.mjs'],
  ['security-sprint1-attacks', 'security/test/sprint1-economic-attacks.test.mjs'],
  ['security-localnet-historical', 'security/test/historical-localnet-accounts.test.mjs'],
  ['security-exact-numbers', 'security/test/numeric-boundary-reference.test.mjs'],
  ['security-replay-ledger', 'security/test/replay-ledger-adversarial.test.mjs'],
  ['security-signed-transaction-provenance', 'security/test/transaction-provenance-adversarial.test.mjs'],
  ['security-checkpoint-forgery', 'security/test/indexer-checkpoint-regression.test.mjs'],
  ['security-ledger-corruption', 'security/test/ledger-corruption-boundary.test.mjs'],
  ['security-solana-rave-numeric-conversion', 'security/test/solana-rave-numeric-gate.test.mjs'],
  ['rave-shadow', 'tests/holochain/shadow-review.test.mjs'],
  ['rave-shadow-cli', 'tests/holochain/shadow-cli.test.mjs'],
  ['rave-attack-model', 'tests/holochain/economic-attack-model.test.mjs'],
  ['rave-test-only-adapter', 'tests/holochain/test-only-adapter.test.mjs'],
  ['rave-transaction-shadow', 'tests/holochain/transaction-shadow.test.mjs'],
  ['rave-provenance-journal', 'tests/holochain/transaction-provenance-journal.test.mjs'],
];
const integrated = existsSync('ci-integration-snapshot.json');
mkdirSync('ci-artifacts', { recursive: true });
let failed = false;
const output = [];
for (const [name, filename] of cases) {
  if (!existsSync(filename)) {
    console.log(`NOT_PRESENT (NOT TESTED): ${filename}`);
    output.push({ name, filename, status: 'not_present', passed: 0, failed: 0, skipped: 0 });
    if (integrated) failed = true;
    continue;
  }
  console.log(`RUNNING: ${filename}`);
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', filename], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = (result.stdout ?? '') + (result.stderr ?? '');
  process.stdout.write(stdout);
  writeFileSync(resolve('ci-artifacts', `${name}.log`), stdout);
  const match = key => Number(stdout.match(new RegExp(`^# ${key}\\s+(\\d+)`, 'm'))?.[1] ?? -1);
  const total = match('tests'), passed = match('pass');
  const skipped = match('skipped'), failCount = match('fail');
  const cancelled = match('cancelled'), todo = match('todo');
  const good = result.status === 0 && total > 0 && passed === total &&
    skipped === 0 && failCount === 0 && cancelled === 0 && todo === 0;
  if (!good) {
    console.error(`CROSS_LANE_SUITE_FAILED: ${filename}; exit=${result.status}; total=${total}; passed=${passed}; failed=${failCount}; skipped=${skipped}; cancelled=${cancelled}; todo=${todo}`);
    failed = true;
  }
  output.push({ name, filename, status: good ? 'passed' : 'failed_or_skipped',
    exit: result.status, tests: total, passed, failed: failCount, skipped, cancelled, todo });
}
writeFileSync('ci-artifacts/cross-lane-summary.json', JSON.stringify({
  mode: integrated ? 'integrated-all-suites-required' : 'available-suites-only',
  results: output,
  totals: output.reduce((a, r) => {
    for (const k of ['tests','passed','failed','skipped','cancelled','todo'])
      a[k] += Math.max(0, r[k] ?? 0);
    return a;
  }, { tests: 0, passed: 0, failed: 0, skipped: 0, cancelled: 0, todo: 0 }),
  disclaimer: 'Model tests and offline fixtures are not Solana validator or deployed Unyt proof.',
}, null, 2) + '\n');
console.log(`CROSS_LANE_MODE: ${integrated ? 'INTEGRATED_REQUIRED' : 'AVAILABLE_ONLY'}`);
if (failed) process.exitCode = 1;
