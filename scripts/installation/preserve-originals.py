#!/usr/bin/env python3
"""Preserve, verify and restore the ORIGINAL #66 GitHub Actions archives.

Read-only with respect to archive content: archives are hashed, CRC-tested and
(only in `restore`) safely extracted with the same refusals as
fetch-originals.py. Nothing from an archive is ever executed. No Holochain,
Lair, conductor or signing operation exists in this script.

Subcommands
  download --out DIR            Owner/CI: fetch via authenticated `gh api`, then seal.
  seal --dir DIR --metadata F   Seal bytes obtained through another authenticated
                                GitHub channel, with an API metadata snapshot F.
  verify --dir DIR              Re-verify a (durable) copy: size, SHA-256, CRC,
                                entry count, unsafe paths, SHA256SUMS. No extraction.
  restore --dir DIR --metadata api|record
                                Verify, then lay the build/sol/obs originals out
                                exactly as fetch-originals.py does, so the
                                UNCHANGED demo/installation/verify-originals.mjs
                                consumes the original bytes. Nothing is rebuilt.

DIR must contain <artifactId>.zip files named by the pinned manifest.
"""
import argparse, datetime, hashlib, json, pathlib, shutil, stat, subprocess, sys, zipfile

MANIFEST = pathlib.Path('demo/installation/preservation/pr66-originals-manifest.json')
BASELINE = pathlib.Path('demo/installation/baseline.json')
WORK = pathlib.Path('work/installation-originals')
DENIALS = {'creditEligible': False, 'independentConsensusVerified': False,
           'spendableBaseUnits': '0', 'withdrawalAuthorized': False}


def fail(code):
    print('PRESERVATION_REFUSED:' + code, file=sys.stderr)
    sys.exit(3)


def need(ok, code):
    if not ok:
        fail(code)


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def load_pins():
    m = json.loads(MANIFEST.read_text())
    need(m['schema'] == 'hsc-original-artifact-preservation-manifest-v1', 'MANIFEST_SCHEMA')
    need(m['nonEconomicPolicy'] == DENIALS, 'MANIFEST_ECONOMIC_POLICY')
    b = json.loads(BASELINE.read_text())
    # The installation baseline and this manifest must name the same bytes.
    need(b['sourceCommit'] == m['sourceCommit'] and b['runId'] == m['runId'] and
         b['sharedRunId'] == m['sharedRunId'] and b['buildJobId'] == m['buildJobId'],
         'BASELINE_MANIFEST_IDENTITY_MISMATCH')
    for a in m['artifacts']:
        if a['inInstallationBaseline']:
            pin = b['artifacts'][a['kind']]
            need(pin['id'] == a['artifactId'] and pin['sha256'] == a['archiveSha256'],
                 'BASELINE_MANIFEST_DIGEST_MISMATCH:' + a['kind'])
    return m


def check_archive(path, art):
    """Byte identity + structural safety. Never extracts."""
    need(path.is_file() and not path.is_symlink(), 'ARCHIVE_MISSING_OR_SYMLINK:' + path.name)
    data = path.read_bytes()
    need(len(data) == art['archiveBytes'], 'ARCHIVE_SIZE_MISMATCH:%s:%d' % (path.name, len(data)))
    digest = sha256(data)
    need(digest == art['archiveSha256'], 'ARCHIVE_SHA256_MISMATCH:' + path.name)
    with zipfile.ZipFile(path) as z:
        need(z.testzip() is None, 'ARCHIVE_CRC_FAILURE:' + path.name)
        infos = z.infolist()
        need(len(infos) == art['zipEntries'], 'ARCHIVE_ENTRY_COUNT:' + path.name)
        need(sum(x.file_size for x in infos) <= 64 * 1024 * 1024, 'ARCHIVE_TOO_LARGE:' + path.name)
        names = set()
        for e in infos:
            p = pathlib.PurePosixPath(e.filename)
            need(not p.is_absolute() and '..' not in p.parts and '\\' not in e.filename,
                 'UNSAFE_ARCHIVE_PATH:' + path.name)
            need(e.filename not in names, 'DUPLICATE_ARCHIVE_PATH:' + path.name)
            need(not stat.S_ISLNK(e.external_attr >> 16), 'SYMLINK_ARCHIVE_REFUSED:' + path.name)
            names.add(e.filename)
    return {'artifactId': art['artifactId'], 'name': art['name'], 'file': path.name,
            'archiveBytes': len(data), 'archiveSha256': digest, 'zipEntries': len(infos),
            'crc': 'OK'}


def check_metadata(m, meta):
    """Assert an API metadata snapshot proves the pinned origin and no mutation."""
    for rid in (m['runId'], m['sharedRunId']):
        r = meta['runs'][str(rid)]
        need(r['head_sha'] == m['sourceCommit'] and r['conclusion'] == 'success',
             'BASELINE_CI_NOT_VERIFIED:%s' % rid)
    j = meta['buildJob']
    need(j['id'] == m['buildJobId'] and j['run_id'] == m['runId'] and j['conclusion'] == 'success',
         'ORIGINAL_BUILD_JOB_NOT_VERIFIED')
    steps = {s['name']: s['conclusion'] for s in j['steps']}
    for name in m['mustBeSkippedBuildSteps']:
        need(steps.get(name) == 'skipped', 'BASELINE_UNEXPECTED_MUTATION:' + name)
    for a in m['artifacts']:
        x = meta['artifacts'][str(a['artifactId'])]
        need(x['name'] == a['name'] and x['size_in_bytes'] == a['archiveBytes'] and
             x['digest'] == 'sha256:' + a['archiveSha256'] and
             x['workflow_run']['id'] == m['runId'] and
             x['workflow_run']['head_sha'] == m['sourceCommit'], 'ARTIFACT_API_METADATA:%s' % a['artifactId'])


def gh(path, binary=False):
    out = subprocess.check_output(['gh', 'api', path])
    return out if binary else json.loads(out)


def api_snapshot(m, require_unexpired=True):
    repo = m['repository']
    meta = {'capturedAt': now(), 'capturedVia': 'gh api (authenticated GitHub REST)',
            'runs': {}, 'artifacts': {}}
    for rid in (m['runId'], m['sharedRunId']):
        r = gh(f'repos/{repo}/actions/runs/{rid}')
        meta['runs'][str(rid)] = {k: r[k] for k in ('id', 'head_sha', 'conclusion', 'status', 'path')}
    j = gh(f"repos/{repo}/actions/jobs/{m['buildJobId']}")
    meta['buildJob'] = {'id': j['id'], 'run_id': j['run_id'], 'conclusion': j['conclusion'],
                        'steps': [{'name': s['name'], 'conclusion': s['conclusion']} for s in j['steps']]}
    for a in m['artifacts']:
        x = gh(f"repos/{repo}/actions/artifacts/{a['artifactId']}")
        if require_unexpired:
            need(not x['expired'], 'ORIGINAL_ARTIFACT_EXPIRED_USE_DURABLE_COPY:%s' % a['artifactId'])
        meta['artifacts'][str(a['artifactId'])] = {k: x[k] for k in (
            'id', 'name', 'size_in_bytes', 'digest', 'created_at', 'expires_at', 'expired', 'workflow_run')}
    return meta


def seal(m, d, meta):
    check_metadata(m, meta)
    results = [check_archive(d / f"{a['artifactId']}.zip", a) for a in m['artifacts']]
    (d / 'SHA256SUMS').write_text(''.join(f"{r['archiveSha256']}  {r['file']}\n" for r in results))
    record = {
        'schema': 'hsc-original-artifact-preservation-record-v1',
        'repository': m['repository'], 'sourceCommit': m['sourceCommit'],
        'runId': m['runId'], 'sharedRunId': m['sharedRunId'], 'buildJobId': m['buildJobId'],
        'sealedAt': now(), 'archives': results, 'apiMetadataSnapshot': meta,
        'statement': 'Exact original GitHub Actions archive bytes; not rebuilt, repacked or substituted. '
                     'This record is NOT installation authorization and NOT runtime evidence.',
        'durableLocation': None, 'durableAccessControl': None,
        **DENIALS, 'installed': False, 'actionHash': None,
    }
    (d / 'PRESERVATION_RECORD.json').write_text(json.dumps(record, indent=2) + '\n')
    print('SEALED_%d_ORIGINAL_ARCHIVES %s' % (len(results), d))


def cmd_download(args):
    m = load_pins()
    d = pathlib.Path(args.out)
    need(not d.exists() or not any(d.iterdir()), 'OUTPUT_DIR_NOT_EMPTY')
    d.mkdir(parents=True, exist_ok=True)
    meta = api_snapshot(m)
    for a in m['artifacts']:
        data = gh(f"repos/{m['repository']}/actions/artifacts/{a['artifactId']}/zip", binary=True)
        (d / f"{a['artifactId']}.zip").write_bytes(data)
    seal(m, d, meta)


def cmd_seal(args):
    m = load_pins()
    seal(m, pathlib.Path(args.dir), json.loads(pathlib.Path(args.metadata).read_text()))


def cmd_verify(args):
    m = load_pins()
    d = pathlib.Path(args.dir)
    results = [check_archive(d / f"{a['artifactId']}.zip", a) for a in m['artifacts']]
    sums = d / 'SHA256SUMS'
    if sums.exists():
        expected = {line.split()[1]: line.split()[0] for line in sums.read_text().splitlines() if line.strip()}
        for r in results:
            need(expected.get(r['file']) == r['archiveSha256'], 'SHA256SUMS_MISMATCH:' + r['file'])
    rec = d / 'PRESERVATION_RECORD.json'
    if rec.exists():
        check_metadata(m, json.loads(rec.read_text())['apiMetadataSnapshot'])
    print(json.dumps({'verifiedAt': now(), 'dir': str(d), 'archives': results}, indent=2))
    print('ORIGINAL_ARCHIVES_VERIFIED %d/%d' % (len(results), len(m['artifacts'])))


def cmd_restore(args):
    m = load_pins()
    d = pathlib.Path(args.dir)
    need(not WORK.exists() or not any(WORK.iterdir()), 'RESTORE_TARGET_NOT_EMPTY:' + str(WORK))
    for a in m['artifacts']:
        check_archive(d / f"{a['artifactId']}.zip", a)
    if args.metadata == 'api':
        # Run/job/artifact records outlive artifact bytes; expiry is expected here.
        meta = api_snapshot(m, require_unexpired=False)
        check_metadata(m, meta)
        source = 'live GitHub REST API at restore time'
    else:
        meta = json.loads((d / 'PRESERVATION_RECORD.json').read_text())['apiMetadataSnapshot']
        check_metadata(m, meta)
        source = 'apiMetadataSnapshot captured at sealing (%s via %s)' % (meta['capturedAt'], meta['capturedVia'])
    WORK.mkdir(parents=True, exist_ok=True)
    # Same layout and same extraction refusals as fetch-originals.py.
    for a in m['artifacts']:
        if not a['inInstallationBaseline']:
            continue
        archive = WORK / (a['kind'] + '.zip')
        shutil.copyfile(d / f"{a['artifactId']}.zip", archive)
        need(sha256(archive.read_bytes()) == a['archiveSha256'], 'RESTORED_COPY_DRIFT:' + a['kind'])
        with zipfile.ZipFile(archive) as z:
            z.extractall(WORK / a['kind'])
    (WORK / 'baseline-api-verification.json').write_text(json.dumps({
        'sourceCommit': m['sourceCommit'], 'runId': m['runId'], 'sharedRunId': m['sharedRunId'],
        'buildJob': m['buildJobId'], 'installationSkipped': True}, indent=2) + '\n')
    (WORK / 'restore-provenance.json').write_text(json.dumps({
        'restoredAt': now(), 'restoredFrom': str(d), 'metadataSource': source,
        'archives': {a['kind']: a['archiveSha256'] for a in m['artifacts'] if a['inInstallationBaseline']},
        'rebuilt': False, 'substituted': False}, indent=2) + '\n')
    print('ORIGINAL_ARCHIVE_BYTES_RESTORED (metadata: %s)' % source)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('download'); s.add_argument('--out', required=True); s.set_defaults(fn=cmd_download)
    s = sub.add_parser('seal'); s.add_argument('--dir', required=True); s.add_argument('--metadata', required=True); s.set_defaults(fn=cmd_seal)
    s = sub.add_parser('verify'); s.add_argument('--dir', required=True); s.set_defaults(fn=cmd_verify)
    s = sub.add_parser('restore'); s.add_argument('--dir', required=True)
    s.add_argument('--metadata', choices=['api', 'record'], required=True)
    s.set_defaults(fn=cmd_restore)
    a = p.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
