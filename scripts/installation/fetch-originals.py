#!/usr/bin/env python3
"""Read-only archive retrieval. Never run content from downloaded archives."""
import hashlib,json,pathlib,stat,subprocess,zipfile
pins=json.loads(pathlib.Path('demo/installation/baseline.json').read_text())
root=pathlib.Path('work/installation-originals');root.mkdir(parents=True,exist_ok=True)
def api(path):
    return json.loads(subprocess.check_output(['gh','api',f"repos/{pins['repository']}/"+path]))
for run_id in [pins['runId'],pins['sharedRunId']]:
    run=api(f'actions/runs/{run_id}')
    assert run['head_sha']==pins['sourceCommit'] and run['conclusion']=='success','BASELINE_CI_NOT_VERIFIED'
job=api(f"actions/jobs/{pins['buildJobId']}")
assert job['run_id']==pins['runId'] and job['conclusion']=='success','ORIGINAL_BUILD_JOB_NOT_VERIFIED'
for step in job['steps']:
    if step['name'].startswith(('Install disposable OWN','Publish seven-stage report ONLY')):
        assert step['conclusion']=='skipped','BASELINE_UNEXPECTED_MUTATION'
(root/'baseline-api-verification.json').write_text(json.dumps({'sourceCommit':pins['sourceCommit'],'runId':pins['runId'],'sharedRunId':pins['sharedRunId'],'buildJob':job['id'],'installationSkipped':True},indent=2)+'\n')
for kind,item in pins['artifacts'].items():
    archive=root/(kind+'.zip')
    with archive.open('wb') as out:
        subprocess.run(['gh','api',f"repos/{pins['repository']}/actions/artifacts/{item['id']}/zip"],stdout=out,check=True)
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==item['sha256'],'ORIGINAL_ZIP_DIGEST_MISMATCH'
    with zipfile.ZipFile(archive) as z:
        assert sum(x.file_size for x in z.infolist())<=64*1024*1024,'ARCHIVE_TOO_LARGE'
        names=set()
        for entry in z.infolist():
            p=pathlib.PurePosixPath(entry.filename)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in entry.filename,'UNSAFE_ARCHIVE_PATH'
            assert entry.filename not in names,'DUPLICATE_ARCHIVE_PATH'
            assert not stat.S_ISLNK(entry.external_attr>>16),'SYMLINK_ARCHIVE_REFUSED'
            names.add(entry.filename)
        z.extractall(root/kind)
print('ORIGINAL_ARCHIVE_BYTES_VERIFIED')
