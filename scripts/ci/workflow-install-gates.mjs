// Static CI scheduling guard: a workflow job or step that can install/start a
// Holochain conductor, install an app (genesis) or call a mutating zome function
// must be unconditionally disabled with exactly `if: ${{ false }}` (job or step
// level) until an independent exact-call authorization path exists.
// rave-unyt-release.yml must also stay non-dispatchable.
// Text-only: never executes workflow content and never contacts GitHub.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MUTATION_PATTERNS = [
  /probe-verified-unyt-conductor\.sh/,
  /a0-own-dna-install-readonly\.sh/,
  /\bhc\s+(?:sandbox|s)\s+(?:generate|create|run|call)\b/,
  /\binstall[-_]app\b/i,
  /\bholochain\s+(?:-c|--config-path)\b/,
  /\b(?:grant_capability|record_observation|execute_rave)\b/,
];
const DISABLED = /^(?:\$\{\{\s*false\s*\}\}|false)\s*(?:#.*)?$/;

const code = text => text.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
const mutates = text => MUTATION_PATTERNS.some(p => p.test(code(text)));
function ifValue(lines, indent) {
  const re = new RegExp('^' + ' '.repeat(indent) + 'if:\\s*(.*)$');
  for (const l of lines) { const m = re.exec(l); if (m) return m[1].trim(); }
  return null;
}
const disabled = v => v !== null && DISABLED.test(v);

export function parseJobs(text) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const jobs = [];
  let cur = null;
  for (const l of lines.slice(start + 1)) {
    if (/^\S/.test(l)) break;
    const h = /^  ([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (h) { cur = { id: h[1], lines: [] }; jobs.push(cur); continue; }
    if (cur) cur.lines.push(l);
  }
  for (const job of jobs) {
    const s = job.lines.findIndex(l => /^    steps:\s*$/.test(l));
    const header = s < 0 ? job.lines : job.lines.slice(0, s);
    const body = s < 0 ? [] : job.lines.slice(s + 1);
    job.header = header;
    job.if = ifValue(header, 4);
    job.steps = [];
    let step = null;
    for (const l of body) {
      if (/^      - /.test(l)) { step = { lines: [l.replace(/^      - /, '        ')] }; job.steps.push(step); continue; }
      if (l.trim() && !/^       /.test(l)) { step = null; continue; }
      if (step) step.lines.push(l);
    }
    for (const st of job.steps) {
      st.if = ifValue(st.lines, 8);
      st.name = (/^        name:\s*(.*)$/m.exec(st.lines.join('\n')) || [])[1] ?? '(unnamed)';
    }
  }
  return jobs;
}

export function triggers(text) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => /^(?:on|"on"|'on'):\s*$/.test(l));
  if (start < 0) {
    const inline = /^on:\s*(.+)$/m.exec(text);
    return inline ? inline[1].replace(/[[\]\s]/g, '').split(',').filter(Boolean) : [];
  }
  const keys = [];
  for (const l of lines.slice(start + 1)) {
    if (/^\S/.test(l)) break;
    const m = /^  ([A-Za-z_]+):/.exec(l);
    if (m) keys.push(m[1]);
  }
  return keys;
}

export function violations(file, text) {
  const out = [];
  for (const job of parseJobs(text)) {
    if (disabled(job.if)) continue;
    if (mutates(job.header.join('\n')))
      out.push(`${file}: job ${job.id}: mutation-capable job-level configuration without if: \${{ false }}`);
    if (/^    uses:\s*\.\/\.github\/workflows\//m.test(job.header.join('\n')))
      out.push(`${file}: job ${job.id}: local reusable workflow call must be job-disabled`);
    for (const st of job.steps)
      if (!disabled(st.if) && mutates(st.lines.join('\n')))
        out.push(`${file}: job ${job.id}: step "${st.name}" can install/start a conductor or call a mutating zome without if: \${{ false }}`);
  }
  if (/(^|\/)rave-unyt-release\.yml$/.test(file)) {
    const on = triggers(text);
    for (const t of on) if (t !== 'push')
      out.push(`${file}: forbidden trigger ${t}; only historical push branches are allowed until RAVE + SEC authorize conductor probes`);
    if (/^\s*-?\s*(?:main|master|claude\/[^\s,\]]*)\s*$/m.test(text) || /branches:\s*\[[^\]]*\b(?:main|master|claude\/)/.test(text))
      out.push(`${file}: must not run on main or the consolidation branch`);
    const probe = parseJobs(text).find(j => j.id === 'actual-non-economic-conductor-probe');
    if (probe && !disabled(probe.if))
      out.push(`${file}: actual-non-economic-conductor-probe must be job-disabled with if: \${{ false }}`);
  }
  return out;
}

export function scanWorkflows(root = '.') {
  const dir = join(root, '.github', 'workflows');
  const files = readdirSync(dir).filter(f => /\.ya?ml$/.test(f)).sort();
  return files.flatMap(f => violations('.github/workflows/' + f, readFileSync(join(dir, f), 'utf8')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures = scanWorkflows();
  if (failures.length) {
    console.error('WORKFLOW_INSTALL_GATE_FAILED:\n' + failures.join('\n'));
    process.exitCode = 1;
  } else console.log('WORKFLOW_INSTALL_GATES_OK: every conductor-install/genesis/mutating-zome step is unconditionally disabled; rave-unyt-release.yml is not dispatchable.');
}
