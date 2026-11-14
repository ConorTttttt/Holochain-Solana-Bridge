// Network-isolated original RPC producer tests. Two local ports are NOT
// independent operators and therefore MUST NOT make a full-history green gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function serve(block7 = true) {
  const history = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const msg = JSON.parse(body);
    history.push(msg);
    const result = msg.method === 'getGenesisHash' ? '11111111111111111111111111111111'
      : msg.method === 'getFirstAvailableBlock' ? 2
      : msg.method === 'getSlot' ? 40
      : msg.method === 'getBlocks' ? [5, 7]
      : msg.method === 'getBlock' ? (msg.params[0] === 7 && !block7 ? null : {
        blockhash: '11111111111111111111111111111111',
        previousBlockhash: '11111111111111111111111111111111',
        parentSlot: msg.params[0] === 5 ? 4 : 5,
        transactions: [],
      })
      : msg.method === 'getMultipleAccounts' ? {
        context: { slot: 12 }, value: [null, null, null, null],
      } : undefined;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  return { server, history, url: 'http://127.0.0.1:' + port };
}
function command(args) {
  // Async child: the mock HTTP servers run on THIS process event loop.
  return new Promise(resolve => {
    const child = spawn(process.execPath,
      ['tests/solana/produce-history-archive.mjs', ...args], { timeout: 10000 });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}
function load(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function checkManifest(dir) {
  const manifest = readFileSync(join(dir, 'evidence-manifest.sha256'), 'utf8').trim().split('\n');
  for (const entry of manifest) {
    const [hash, file] = entry.split('  ');
    assert.equal(createHash('sha256').update(readFileSync(join(dir, file)))
      .digest('hex'), hash);
  }
  return manifest;
}
test('inclusive produced slots, full raw getBlock and same-host limitation', async () => {
  const a = await serve(), b = await serve();
  const dir = mkdtempSync(join(tmpdir(), 'sol-archive-mock-'));
  try {
    const p = await command([
      '--provider-a-id=sourceA', '--provider-a-operator=operatorA',
      '--provider-a-url=' + a.url,
      '--provider-b-id=sourceB', '--provider-b-operator=operatorB',
      '--provider-b-url=' + b.url,
      '--from-slot=5', '--to-slot=7', '--out=' + dir,
      '--required-signatures=11111111111111111111111111111111',
    ]);
    assert.equal(p.status, 2, p.stderr);
    const coverage = load(join(dir, 'observer-history-candidate.json'));
    assert.equal(coverage.kind, 'observer-original-two-provider-history-v1');
    assert.equal(coverage.providers.length, 2);
    for (const provider of coverage.providers) {
      assert.deepEqual(provider.getBlocks[0].result, [5, 7]);
      assert.equal(provider.getBlocks[0].fromSlot, 5);
      assert.equal(provider.getBlocks[0].toSlot, 7);
      assert.deepEqual(provider.getBlock.map(row => row.slot), [5, 7]);
      assert.equal(provider.getBlock[0].options.transactionDetails, 'full');
      assert.equal(provider.getBlock[0].options.encoding, 'base64');
    }
    const handoff = load(join(dir, 'produced-slot-handoff.json'));
    assert.equal(handoff.fullHistoryGate, 'BLOCKED');
    assert.equal(handoff.absentSlotsClassifiedAsEmpty, false);
    assert.equal(handoff.independentConsensusVerified, false);
    assert.equal(handoff.creditEligible, false);
    assert.ok(handoff.gaps.some(x =>
      x.classification === 'SAME_OPERATOR_OR_ENDPOINT_NOT_INDEPENDENT'));
    assert.ok(handoff.gaps.some(x =>
      x.classification === 'ORIGINAL_SUBMITTED_WIRE_MISSING'));
    assert.equal(a.history.filter(x => x.method === 'getBlock').length, 2);
    assert.equal(b.history.filter(x => x.method === 'getBlock').length, 2);
    assert.ok(readdirSync(join(dir, 'rpc')).length >= 12);
    assert.ok(checkManifest(dir).length >= 14);
  } finally {
    await Promise.all([new Promise(ok => a.server.close(ok)),
      new Promise(ok => b.server.close(ok))]);
    rmSync(dir, { recursive: true, force: true });
  }
});
test('null produced-block RPC records error and cannot pass', async () => {
  const a = await serve(false), b = await serve();
  const dir = mkdtempSync(join(tmpdir(), 'sol-archive-null-'));
  try {
    const p = await command([
      '--provider-a-id=a', '--provider-a-operator=operatorA', '--provider-a-url=' + a.url,
      '--provider-b-id=b', '--provider-b-operator=operatorB', '--provider-b-url=' + b.url,
      '--from-slot=5', '--to-slot=7', '--out=' + dir,
    ]);
    assert.equal(p.status, 2, p.stderr);
    const handoff = load(join(dir, 'produced-slot-handoff.json'));
    assert.ok(handoff.gaps.some(x =>
      x.classification === 'MISSING_PRODUCED_BLOCK' && x.slot === 7));
    assert.ok(handoff.gaps.some(x =>
      x.classification === 'FULL_BLOCK_COVERAGE_MISSING'));
    assert.equal(handoff.fullHistoryGate, 'BLOCKED');
    assert.ok(checkManifest(dir).length > 0);
  } finally {
    await Promise.all([new Promise(ok => a.server.close(ok)),
      new Promise(ok => b.server.close(ok))]);
    rmSync(dir, { recursive: true, force: true });
  }
});
test('four-account pre-capture records raw finalized context, never historical claim', async () => {
  const a = await serve();
  const dir = mkdtempSync(join(tmpdir(), 'sol-archive-capture-'));
  try {
    const addresses = Array(4).fill('11111111111111111111111111111111').join(',');
    const p = await command(['--capture-four-accounts=pre', '--provider-a-id=sourceA',
      '--provider-a-url=' + a.url, '--four-addresses=' + addresses, '--out=' + dir]);
    assert.equal(p.status, 0, p.stderr);
    const row = load(join(dir, 'refund-pre-four-accounts.json'));
    assert.equal(row.phase, 'pre');
    assert.equal(row.response.result.context.slot, 12);
    assert.equal(row.exactHistoricalSlotProven, false);
    assert.equal(load(join(dir, 'capture-status.json')).independentConsensusVerified, false);
    assert.ok(checkManifest(dir).length > 0);
  } finally {
    await new Promise(ok => a.server.close(ok));
    rmSync(dir, { recursive: true, force: true });
  }
});
