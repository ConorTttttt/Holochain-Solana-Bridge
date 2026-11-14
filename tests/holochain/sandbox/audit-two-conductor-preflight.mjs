#!/usr/bin/env node
/**
 * Static, NON-EXECUTING, NON-ECONOMIC identity preflight for two disposable
 * Holochain 0.7.1 conductors. Inputs are untrusted admin snapshots; they are
 * NOT independent proof that a conductor ran, nor network/keystore isolation.
 * This tool NEVER reads Lair tokens, keys, databases, or calls a zome.
 */
import { realpathSync, lstatSync, statSync, readFileSync } from 'node:fs';
import { sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINNED_SANDBOX_DNA = 'uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ';

export function auditTwoConductorPreflight({ appsA, cellsA, rootA, appsB, cellsB, rootB }) {
  const findings = [];
  const flag = code => { if (!findings.includes(code)) findings.push(code); };
  function root(label, dir) {
    try {
      if (typeof dir !== 'string' || !dir.startsWith('/') || lstatSync(dir).isSymbolicLink()) {
        throw Error('not an absolute, non-symlink path');
      }
      const pathname = realpathSync(dir);
      const info = statSync(pathname);
      if (!info.isDirectory()) throw Error('not a directory');
      if ((info.mode & 0o077) !== 0) flag(label + '_SANDBOX_ROOT_NOT_PRIVATE');
      return pathname;
    } catch {
      flag(label + '_SANDBOX_ROOT_UNVERIFIED');
      return null;
    }
  }
  const leftRoot = root('A', rootA), rightRoot = root('B', rootB);
  if (leftRoot && rightRoot &&
      (leftRoot === rightRoot || leftRoot.startsWith(rightRoot + sep) ||
       rightRoot.startsWith(leftRoot + sep))) flag('OVERLAPPING_SANDBOX_ROOTS');

  function agent(label, apps, cells) {
    if (!Array.isArray(apps) || !Array.isArray(cells)) {
      flag(label + '_INVALID_ADMIN_SNAPSHOT');
      return null;
    }
    const installed = apps.filter(app => app?.installed_app_id === 'unyt-v0117-audit');
    if (installed.length !== 1) {
      flag(label + '_AMBIGUOUS_APP_IDENTITY');
      return null;
    }
    const app = installed[0];
    const provisioned = app?.cell_info?.alliance;
    const cell = Array.isArray(provisioned) && provisioned.length === 1 ? provisioned[0] : null;
    const id = cell?.value?.cell_id;
    const key = app?.agent_pub_key;
    if (app?.status?.type !== 'enabled' || cell?.type !== 'provisioned' ||
        typeof key !== 'string' || !key.startsWith('uhCAk') ||
        id?.dna_hash !== PINNED_SANDBOX_DNA || id?.agent_pub_key !== key ||
        cells.filter(c => c?.dna_hash === PINNED_SANDBOX_DNA && c?.agent_pub_key === key).length !== 1) {
      flag(label + '_APP_CELL_OR_PINNED_DNA_MISMATCH');
      return null;
    }
    return key;
  }
  const a = agent('A', appsA, cellsA), b = agent('B', appsB, cellsB);
  if (a && b && a === b) flag('REUSED_AGENT_IDENTITY');
  return Object.freeze({
    scope: 'UNTRUSTED_STATIC_ADMIN_SNAPSHOT_SHAPE_ONLY',
    shapeVerdict: findings.length ? 'rejected' : 'consistent-not-proven',
    findings: Object.freeze(findings),
    runtimeStatus: 'BLOCKED_SOURCE_EQUIVALENCE_ABI_CAPABILITY_NETWORK_ISOLATION',
    networkIsolationVerified: false, sourceChainsIndependentlyVerified: false,
    sourceEquivalent: false, zomeCallAuthorized: false, conductorExecutedByThisTool: false,
    creditEligible: false, independentConsensusVerified: false,
    spendableBaseUnits: '0', withdrawalAuthorized: false,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 8) throw Error(
      'usage: audit-two-conductor-preflight.mjs <apps-a.json> <cells-a.json> <root-a> <apps-b.json> <cells-b.json> <root-b>');
    const [appsA, cellsA, rootA, appsB, cellsB, rootB] = process.argv.slice(2);
    const result = auditTwoConductorPreflight({
      appsA: JSON.parse(readFileSync(appsA, 'utf8')),
      cellsA: JSON.parse(readFileSync(cellsA, 'utf8')), rootA,
      appsB: JSON.parse(readFileSync(appsB, 'utf8')),
      cellsB: JSON.parse(readFileSync(cellsB, 'utf8')), rootB,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.shapeVerdict !== 'consistent-not-proven') process.exitCode = 2;
  } catch (error) {
    console.error('BLOCKED_TWO_CONDUCTOR_PREFLIGHT: ' + error.message);
    process.exitCode = 2;
  }
}
