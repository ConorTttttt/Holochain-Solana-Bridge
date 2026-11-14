#!/usr/bin/env node
/**
 * Non-executing static export inventory for the exact publisher-signed Unyt
 * Sandbox v0.117.0 Holochain WASM artifacts. Not source equivalence, a call
 * authorization, a proof of function semantics or economic validation.
 *
 * Usage: node inventory-verified-unyt-wasm.mjs <transactor.wasm> <transactor_integrity.wasm>
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const EXACT = Object.freeze([
  { zome: 'transactor', sha256: '8337488fcff06e8d1b37f68bc8dc2a14a33492769bce1fdb183406ae032c770d', functions: 121 },
  { zome: 'transactor_integrity', sha256: '1bcbf9993e5695247d9c54c7b3ee1cbd825cf4167606ee6af3691a39d01a68ab', functions: 8 },
]);

function examine(filename, expected) {
  const bytes = readFileSync(filename);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected.sha256) {
    throw new Error(expected.zome + ': untrusted WASM bytes (SHA-256 mismatch)');
  }
  // Only parse/compile for metadata. Never instantiate or execute guest WASM.
  const exports = WebAssembly.Module.exports(new WebAssembly.Module(bytes));
  const functions = exports.filter(item => item.kind === 'function').map(item => item.name);
  if (functions.length !== expected.functions ||
      exports.filter(item => item.kind === 'memory').length !== 1) {
    throw new Error(expected.zome + ': unexpected export count/layout');
  }
  if (!['entry_defs', 'validate', 'genesis_self_check_2'].every(name => functions.includes(name))) {
    throw new Error(expected.zome + ': expected Holochain callbacks missing');
  }
  return { zome: expected.zome, sha256: actual, bytes: bytes.length,
    exportCount: exports.length, functionExportCount: functions.length,
    exportedFunctions: functions.sort(),
    nonFunctionExports: exports.filter(item => item.kind !== 'function'),
    sourceEquivalent: false, auditedReadOnlyCall: false, capabilityRulesVerified: false };
}

if (process.argv.length !== 4) {
  console.error('Usage: node inventory-verified-unyt-wasm.mjs <transactor.wasm> <transactor_integrity.wasm>');
  process.exitCode = 2;
} else {
  try {
    const results = EXACT.map((expectation, index) => examine(process.argv[index + 2], expectation));
    console.log(JSON.stringify({
      release: 'unytco/unyt-sandbox@v0.117.0',
      expectedSourceGitlink: 'unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf',
      proofScope: 'STATIC_VERIFIED_WASM_EXPORT_NAMES_ONLY',
      zomes: results,
      caveat: 'Exported names do not prove semantic read-only safety, ABI arguments, authorization or source equivalence. No zome executed.',
    }, null, 2));
  } catch (error) {
    console.error('BLOCKED_UNYT_EXPORT_INVENTORY: ' + error.message);
    process.exitCode = 2;
  }
}
