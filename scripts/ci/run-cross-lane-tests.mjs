// Require every available cross-lane test and report missing fixtures without pretending they ran.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cases = [
  ['observer-main', 'observer/test/verify.test.mjs'],
  ['observer-idl-contract', 'observer/test/idl-contract.test.mjs'],
  ['sol-layout', 'tests/solana/layout.test.mjs'],
  ['security-adversarial', 'security/test/adversarial.test.mjs'],
  ['security-solvency', 'security/test/solvency-model.test.mjs'],
  ['rave-shadow', 'tests/holochain/shadow-review.test.mjs'],
  ['rave-shadow-cli', 'tests/holochain/shadow-cli.test.mjs'],
  ['rave-attack-model', 'tests/holochain/economic-attack-model.test.mjs'],
];
const integrated = existsSync('ci-integration-snapshot.json');
mkdirSync('ci-artifacts', { recursive: true });
let failed = false;
const output = [];
for (const [name, filename] of cases) {
  if (!existsSync(filename)) {
    console.log(`NOT_PRESENT (NOT TESTED): ${filename}`);
    output.push({ name, filename, status: 'not_present' });
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
  const skipped = Number(stdout.match(/^# skipped\s+(\d+)/m)?.[1] ?? 0);
  const failCount = Number(stdout.match(/^# fail\s+(\d+)/m)?.[1] ?? 0);
  const good = result.status === 0 && skipped === 0 && failCount === 0;
  if (!good) {
    console.error(`CROSS_LANE_SUITE_FAILED: ${filename}; exit=${result.status}; failed=${failCount}; skipped=${skipped}`);
    failed = true;
  }
  output.push({ name, filename, status: good ? 'passed' : 'failed_or_skipped',
    exit: result.status, passed: Number(stdout.match(/^# pass\s+(\d+)/m)?.[1] ?? 0),
    failed: failCount, skipped });
}
writeFileSync('ci-artifacts/cross-lane-summary.json', JSON.stringify({
  mode: integrated ? 'integrated-all-suites-required' : 'available-suites-only',
  results: output,
  disclaimer: 'Model tests and offline fixtures are not Solana validator or deployed Unyt proof.',
}, null, 2) + '\n');
console.log(`CROSS_LANE_MODE: ${integrated ? 'INTEGRATED_REQUIRED' : 'AVAILABLE_ONLY'}`);
if (failed) process.exitCode = 1;
