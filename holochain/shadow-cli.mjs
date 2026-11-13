#!/usr/bin/env node
/** Read-only, single-process shadow intake. NEVER contact a conductor or execute crediting. */
import { readFileSync } from 'node:fs';
import { reviewShadowEvidence } from './transaction-shadow.mjs';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node holochain/shadow-cli.mjs <target-binding.json> < <observer-output.json>');
  const binding = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const observation = JSON.parse(readFileSync(0, 'utf8'));
  // This map is deliberately ephemeral per invocation, so it CANNOT supply
  // cross-process replay prevention. Reconciliation remains shadow-only.
  const result = reviewShadowEvidence(observation, binding, new Map());
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.verdict === 'quarantined' ? 0 : 2;
} catch (err) {
  process.stderr.write(`SHADOW_INTAKE_FAILED: ${err.message}\n`);
  process.exitCode = 2;
}
