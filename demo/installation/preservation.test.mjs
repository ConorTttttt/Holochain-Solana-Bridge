// Adversarial tests for scripts/installation/preserve-originals.py.
// Synthetic archives in an isolated temp tree; NO real artifact, network,
// conductor, keystore or signing operation is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const SCRIPT = resolve('scripts/installation/preserve-originals.py');
const sha = b => createHash('sha256').update(b).digest('hex');
const DENIALS = {creditEligible: false, independentConsensusVerified: false, spendableBaseUnits: '0', withdrawalAuthorized: false};
const SRC = 'f'.repeat(40);

// Minimal stored (method 0) ZIP writer so tests can build hostile archives.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const locals = [], centrals = []; let off = 0;
  for (const {name, data, mode = 0o100644} of entries) {
    const n = Buffer.from(name), d = Buffer.from(data), crc = crc32(d);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(d.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0x031e, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(d.length, 24); ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE((mode << 16) >>> 0, 38); ch.writeUInt32LE(off, 42);
    locals.push(lh, n, d); centrals.push(ch, n); off += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}

const KINDS = [
  {kind: 'build', id: 101, base: true}, {kind: 'sol', id: 102, base: true},
  {kind: 'obs', id: 103, base: true}, {kind: 'rave', id: 104, base: false},
];
const SKIP = ['Install disposable OWN audit DNA and independently read actual CellId by Admin API',
  'Publish seven-stage report ONLY after actual installed identity proof'];

function fixture(t, {archives = {}, mutate = () => {}} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hsc-preserve-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const store = join(root, 'store'); mkdirSync(store);
  mkdirSync(join(root, 'demo/installation/preservation'), {recursive: true});
  const arts = [], meta = {capturedAt: 'T', capturedVia: 'synthetic', artifacts: {},
    runs: {'1': {head_sha: SRC, conclusion: 'success'}, '2': {head_sha: SRC, conclusion: 'success'}},
    buildJob: {id: 3, run_id: 1, conclusion: 'success', steps: SKIP.map(name => ({name, conclusion: 'skipped'}))}};
  const baseline = {repository: 'x/y', sourceCommit: SRC, runId: 1, sharedRunId: 2, buildJobId: 3, artifacts: {}};
  for (const k of KINDS) {
    const bytes = archives[k.kind] ?? zip([{name: `${k.kind}/evidence.json`, data: JSON.stringify({kind: k.kind, ...DENIALS})}]);
    writeFileSync(join(store, `${k.id}.zip`), bytes);
    const entries = (archives[k.kind] ? archives[`${k.kind}Entries`] : 1) ?? 1;
    arts.push({kind: k.kind, artifactId: k.id, name: k.kind + '-artifact', archiveBytes: bytes.length,
      archiveSha256: sha(bytes), zipEntries: entries, inInstallationBaseline: k.base});
    meta.artifacts[k.id] = {name: k.kind + '-artifact', size_in_bytes: bytes.length, digest: 'sha256:' + sha(bytes),
      workflow_run: {id: 1, head_sha: SRC}};
    if (k.base) baseline.artifacts[k.kind] = {id: k.id, sha256: sha(bytes)};
  }
  const manifest = {schema: 'hsc-original-artifact-preservation-manifest-v1', repository: 'x/y', sourceCommit: SRC,
    runId: 1, sharedRunId: 2, buildJobId: 3, mustBeSkippedBuildSteps: SKIP, artifacts: arts, nonEconomicPolicy: {...DENIALS}};
  mutate({manifest, baseline, meta, store});
  writeFileSync(join(root, 'demo/installation/preservation/pr66-originals-manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'demo/installation/baseline.json'), JSON.stringify(baseline));
  writeFileSync(join(root, 'meta.json'), JSON.stringify(meta));
  return {root, store};
}
const run = (root, ...args) => spawnSync('python3', ['-I', SCRIPT, ...args], {cwd: root, encoding: 'utf8'});
const refused = (r, code) => {
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, new RegExp('PRESERVATION_REFUSED:' + code));
};

test('positive: seal, verify and record-mode restore reproduce the exact archive bytes', t => {
  const {root, store} = fixture(t);
  let r = run(root, 'seal', '--dir', store, '--metadata', join(root, 'meta.json'));
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /SEALED_4_ORIGINAL_ARCHIVES/);
  const rec = JSON.parse(readFileSync(join(store, 'PRESERVATION_RECORD.json')));
  for (const [k, v] of Object.entries(DENIALS)) assert.deepEqual(rec[k], v);
  assert.equal(rec.installed, false); assert.equal(rec.actionHash, null);
  assert.equal(rec.durableLocation, null, 'sealing never claims a durable location');
  r = run(root, 'verify', '--dir', store); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /ORIGINAL_ARCHIVES_VERIFIED 4\/4/);
  r = run(root, 'restore', '--dir', store, '--metadata', 'record'); assert.equal(r.status, 0, r.stderr);
  for (const k of KINDS.filter(x => x.base))
    assert.ok(readFileSync(join(root, `work/installation-originals/${k.kind}.zip`)).equals(readFileSync(join(store, `${k.id}.zip`))));
  assert.ok(!existsSync(join(root, 'work/installation-originals/rave.zip')), 'non-baseline archive is not fed to installation');
  const prov = JSON.parse(readFileSync(join(root, 'work/installation-originals/restore-provenance.json')));
  assert.equal(prov.rebuilt, false); assert.equal(prov.substituted, false);
});

test('a single flipped byte, truncation or a missing archive is refused', t => {
  for (const [label, damage, code] of [
    ['flip', p => { const b = readFileSync(p); b[b.length - 30] ^= 1; writeFileSync(p, b); }, 'ARCHIVE_SHA256_MISMATCH'],
    ['truncate', p => writeFileSync(p, readFileSync(p).subarray(0, 40)), 'ARCHIVE_SIZE_MISMATCH'],
    ['delete', p => rmSync(p), 'ARCHIVE_MISSING_OR_SYMLINK'],
  ]) {
    const {root, store} = fixture(t);
    damage(join(store, '102.zip'));
    refused(run(root, 'verify', '--dir', store), code);
    refused(run(root, 'restore', '--dir', store, '--metadata', 'record'), code);
    assert.ok(!existsSync(join(root, 'work/installation-originals/sol.zip')), label + ': nothing restored');
  }
});

test('a same-size substitute archive with a different digest is refused', t => {
  const {root, store} = fixture(t);
  const orig = readFileSync(join(store, '103.zip'));
  const fake = Buffer.from(orig); fake[fake.length - 1] ^= 0xff; // same length, different bytes
  writeFileSync(join(store, '103.zip'), fake);
  refused(run(root, 'verify', '--dir', store), 'ARCHIVE_(SHA256_MISMATCH|CRC_FAILURE)');
});

test('symlinked archive files and hostile ZIP entries are refused even when the digest is pinned', t => {
  for (const [label, entries, code] of [
    ['traversal', [{name: '../escape.txt', data: 'x'}], 'UNSAFE_ARCHIVE_PATH'],
    ['absolute', [{name: '/etc/passwd', data: 'x'}], 'UNSAFE_ARCHIVE_PATH'],
    ['duplicate', [{name: 'a.json', data: '1'}, {name: 'a.json', data: '2'}], 'DUPLICATE_ARCHIVE_PATH'],
    ['symlink-entry', [{name: 'link', data: '/etc/passwd', mode: 0o120777}], 'SYMLINK_ARCHIVE_REFUSED'],
  ]) {
    const bytes = zip(entries);
    const {root, store} = fixture(t, {archives: {obs: bytes, obsEntries: entries.length}});
    refused(run(root, 'verify', '--dir', store), code);
    assert.ok(!existsSync(join(root, '..', 'escape.txt')), label);
  }
  const {root, store} = fixture(t);
  const real = join(store, 'real.zip'); copyFileSync(join(store, '101.zip'), real); rmSync(join(store, '101.zip'));
  symlinkSync(real, join(store, '101.zip'));
  refused(run(root, 'verify', '--dir', store), 'ARCHIVE_MISSING_OR_SYMLINK');
});

test('metadata proving an executed install step, a wrong source SHA or a failed run is refused', t => {
  for (const [label, mutate, code] of [
    ['install-ran', ({meta}) => { meta.buildJob.steps[0].conclusion = 'success'; }, 'BASELINE_UNEXPECTED_MUTATION'],
    ['wrong-sha', ({meta}) => { meta.runs['1'].head_sha = 'e'.repeat(40); }, 'BASELINE_CI_NOT_VERIFIED'],
    ['failed-run', ({meta}) => { meta.runs['2'].conclusion = 'failure'; }, 'BASELINE_CI_NOT_VERIFIED'],
    ['foreign-artifact', ({meta}) => { meta.artifacts['104'].workflow_run.id = 99; }, 'ARTIFACT_API_METADATA'],
  ]) {
    const {root, store} = fixture(t, {mutate});
    refused(run(root, 'seal', '--dir', store, '--metadata', join(root, 'meta.json')), code);
    assert.ok(!existsSync(join(store, 'PRESERVATION_RECORD.json')), label + ': nothing sealed');
  }
});

test('manifest/baseline disagreement or a changed economic policy is refused before any byte is read', t => {
  for (const [mutate, code] of [
    [({baseline}) => { baseline.artifacts.build.sha256 = '0'.repeat(64); }, 'BASELINE_MANIFEST_DIGEST_MISMATCH'],
    [({baseline}) => { baseline.sourceCommit = 'e'.repeat(40); }, 'BASELINE_MANIFEST_IDENTITY_MISMATCH'],
    [({manifest}) => { manifest.nonEconomicPolicy.creditEligible = true; }, 'MANIFEST_ECONOMIC_POLICY'],
    [({manifest}) => { manifest.nonEconomicPolicy.spendableBaseUnits = '1'; }, 'MANIFEST_ECONOMIC_POLICY'],
  ]) {
    const {root, store} = fixture(t, {mutate});
    refused(run(root, 'verify', '--dir', store), code);
  }
});

test('restore never overwrites an existing installation work tree', t => {
  const {root, store} = fixture(t);
  assert.equal(run(root, 'seal', '--dir', store, '--metadata', join(root, 'meta.json')).status, 0);
  mkdirSync(join(root, 'work/installation-originals'), {recursive: true});
  writeFileSync(join(root, 'work/installation-originals/sol.zip'), 'previous');
  refused(run(root, 'restore', '--dir', store, '--metadata', 'record'), 'RESTORE_TARGET_NOT_EMPTY');
  assert.equal(readFileSync(join(root, 'work/installation-originals/sol.zip'), 'utf8'), 'previous');
});
