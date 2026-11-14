#!/usr/bin/env node
/**
 * SHA-locked static release WASM check plus negative tamper cases.
 * Must be run on signed-release unpacked WASM bytes; no WASM is instantiated.
 * CI integration owner must invoke this after verified Holonix unpack.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const inspector = fileURLToPath(new URL('./inventory-verified-unyt-wasm.mjs', import.meta.url));
const expected = [
  ['transactor', '8337488fcff06e8d1b37f68bc8dc2a14a33492769bce1fdb183406ae032c770d', 121, 122],
  ['transactor_integrity', '1bcbf9993e5695247d9c54c7b3ee1cbd825cf4167606ee6af3691a39d01a68ab', 8, 9],
];
function call(first, second) {
  return spawnSync(process.execPath, [inspector, first, second], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
}
function main() {
  if (process.argv.length !== 4) throw new Error('usage: node assert-verified-unyt-wasm-inventory.mjs <transactor.wasm> <transactor_integrity.wasm>');
  const [coordinator, integrity] = process.argv.slice(2);
  const positive = call(coordinator, integrity);
  assert.equal(positive.status, 0, positive.stderr || positive.error?.message);
  const inventory = JSON.parse(positive.stdout);
  assert.equal(inventory.proofScope, 'STATIC_VERIFIED_WASM_EXPORT_NAMES_ONLY');
  assert.equal(inventory.zomes.length, 2);
  for (let i = 0; i < expected.length; i++) {
    const [zome, sha, functions, exports] = expected[i];
    const found = inventory.zomes[i];
    assert.equal(found.zome, zome);
    assert.equal(found.sha256, sha);
    assert.equal(found.functionExportCount, functions);
    assert.equal(found.exportCount, exports);
    assert.equal(found.nonFunctionExports.length, 1);
    assert.equal(found.nonFunctionExports[0].kind, 'memory');
    assert.equal(found.sourceEquivalent, false);
    assert.equal(found.auditedReadOnlyCall, false);
    assert.equal(found.capabilityRulesVerified, false);
    assert.equal(new Set(found.exportedFunctions).size, functions);
    assert.deepEqual(found.exportedFunctions, [...found.exportedFunctions].sort());
  }
  for (const exported of ['whoami', 'get_status', 'get_parked_link_standing', 'get_recovered_commitments']) {
    assert.ok(inventory.zomes[0].exportedFunctions.includes(exported), exported);
  }
  const tmp = mkdtempSync(join(tmpdir(), 'unyt-wasm-tamper-'));
  try {
    const tampered = Buffer.from(readFileSync(integrity));
    assert.ok(tampered.length > 8);
    tampered[tampered.length - 1] ^= 1;
    const path = join(tmp, 'integrity-tampered.wasm');
    writeFileSync(path, tampered, { mode: 0o600 });
    const bad = call(coordinator, path);
    assert.equal(bad.status, 2, 'tampered WASM must fail closed');
    assert.match(bad.stderr, /BLOCKED_UNYT_EXPORT_INVENTORY: transactor_integrity: untrusted WASM bytes \(SHA-256 mismatch\)/);
    const swapped = call(integrity, coordinator);
    assert.equal(swapped.status, 2, 'swapped WASM positions must fail closed');
    assert.match(swapped.stderr, /SHA-256 mismatch/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log('SIGNED_RELEASE_STATIC_EXPORT_PASS: coordinator 121 + integrity 8 functions; genuine pinned hashes; bitflip and swap rejected; ZERO zome calls');
}
try { main(); } catch (error) {
  console.error('BLOCKED_UNYT_INVENTORY_TEST: ' + error.message);
  process.exitCode = 2;
}
