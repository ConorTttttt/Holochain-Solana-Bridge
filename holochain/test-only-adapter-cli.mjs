#!/usr/bin/env node
/** Executable audit demonstration, NOT a Holochain conductor or trusted ledger. */
import { readFileSync } from 'node:fs';
import { createTestOnlyAdapter } from './test-only-adapter.mjs';

try {
  if (process.argv.length !== 3) {
    throw new Error('Usage: node holochain/test-only-adapter-cli.mjs <binding.json> < <observation-array.json>');
  }
  const binding = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const observations = JSON.parse(readFileSync(0, 'utf8'));
  if (!Array.isArray(observations)) throw new Error('Expected JSON array of Observer observations');
  const adapter = createTestOnlyAdapter(binding);
  const results = observations.map(obs => adapter.ingest(obs));
  process.stdout.write(JSON.stringify({
    kind: 'test-only-holochain-shadow-batch-v1',
    conductorExecuted: false,
    deployedDnaVerified: false,
    economicAuthorization: false,
    results,
  }, null, 2) + '\n');
  if (results.some(result => result.verdict === 'rejected')) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`TEST_ONLY_SHADOW_FAILED: ${error.message}\n`);
  process.exitCode = 2;
}
