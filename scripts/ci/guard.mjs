// Inspect Git-tracked paths and textual contents; never print discovered secret values.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function blockedPath(path) {
  if (/(^|\/)(?:target|node_modules|dist|coverage|\.anchor|test-ledger)(\/|$)/i.test(path)) return 'generated-directory';
  if (/(^|\/)\.env(?:\..+)?$/i.test(path) && !/(^|\/)\.env\.example$/i.test(path)) return 'environment-file';
  if (/(^|\/)(?:id_rsa|id_ed25519|wallet(?:[-_][^/]*)?|[^/]*keypair[^/]*)\.json$/i.test(path)) return 'private-key-file';
  if (/\.(?:pem|p12|pfx|key|so|rlib|rmeta)$/i.test(path)) return 'private-or-generated-file';
  return null;
}
export function blockedContent(content) {
  for (const [pattern, kind] of [
    [/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/, 'private-key-block'],
    [/github_pat_[A-Za-z0-9_]{20,}/, 'github-token'],
    [/gh[pousr]_[A-Za-z0-9_]{20,}/, 'github-token'],
    [/AKIA[0-9A-Z]{16}/, 'aws-access-key'],
    [/xox[baprs]-[A-Za-z0-9-]{16,}/, 'slack-token'],
  ]) if (pattern.test(content)) return kind;
  try {
    const v = JSON.parse(content.trim());
    if (Array.isArray(v) && v.length === 64 &&
      v.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) return 'solana-private-key-array';
  } catch { /* ordinary text */ }
  return null;
}
export function scanTrackedFiles(root = '.') {
  const tracked=execFileSync('git',['-C',root,'ls-files','-z'],{maxBuffer:20*1024*1024})
    .toString('utf8').split('\0').filter(Boolean);
  const failures=[];
  for (const path of tracked) {
    const badPath=blockedPath(path);
    if (badPath) { failures.push(`${path}: ${badPath}`); continue; }
    const bytes=readFileSync(resolve(root,path));
    if (bytes.includes(0)) continue; // Non-text data: path filters apply.
    const badContent=blockedContent(bytes.toString('utf8'));
    if (badContent) failures.push(`${path}: ${badContent}`);
  }
  return failures;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures=scanTrackedFiles();
  if (failures.length) {
    console.error('REPOSITORY_GUARD_FAILED:\n'+failures.join('\n'));
    process.exitCode=1;
  } else console.log('REPOSITORY_GUARD_OK: Git-tracked paths and textual files passed baseline screening.');
}
