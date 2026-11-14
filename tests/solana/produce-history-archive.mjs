#!/usr/bin/env node
/**
 * SOL -> OBS original-RPC produced-slot archive producer (non-economic).
 *
 * Standard Node 22 only. Save ORIGINAL JSON-RPC request/response envelopes
 * alongside an observer-original-two-provider-history-v1 candidate. Never
 * infer skipped slots are empty, that two URLs are independent operators,
 * that getMultipleAccounts is a historical bank snapshot, or that an RPC
 * response is authenticated Solana consensus.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z0-9-]+)=(.*)$/.exec(arg);
  if (!match) throw Error('Expected --key=value; got ' + arg);
  return [match[1], match[2]];
}));
const requireArg = name => {
  if (!argv[name]) throw Error('Missing --' + name);
  return argv[name];
};
const sha256 = data => createHash('sha256').update(data).digest('hex');
const safeUrl = raw => {
  const url = new URL(raw);
  assert.ok(['http:', 'https:'].includes(url.protocol));
  assert.ok(!url.username && !url.password, 'URL embedded credentials prohibited');
  // API-key query strings must never be written into artifacts.
  return url.origin + url.pathname;
};
const slot = (s, name) => {
  const n = Number(s);
  assert.ok(Number.isSafeInteger(n) && n >= 0, 'invalid ' + name);
  return n;
};
const encode58 = bytes => {
  const abc = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const b = Buffer.from(bytes);
  let n = BigInt('0x' + (b.toString('hex') || '0'));
  let out = '';
  while (n) { out = abc[Number(n % 58n)] + out; n /= 58n; }
  for (const x of b) { if (x) break; out = '1' + out; }
  return out;
};
function firstWireSignature(base64) {
  const wire = Buffer.from(base64, 'base64');
  assert.equal(wire.toString('base64'), base64, 'noncanonical signed wire');
  let cursor = 0, count = 0, shift = 0, b;
  do {
    b = wire[cursor++];
    assert.ok(b !== undefined && cursor <= 3, 'truncated signature shortvec');
    count |= (b & 127) << shift;
    shift += 7;
  } while (b & 128);
  assert.ok(count >= 1 && wire.length >= cursor + count * 64,
    'invalid signed transaction signature vector');
  return encode58(wire.subarray(cursor, cursor + 64));
}
function safeFilename(value) {
  assert.match(value, /^[a-zA-Z0-9_-]{1,100}$/);
  return value;
}
const out = resolve(requireArg('out'));
assert.ok(!existsSync(out) || readdirSync(out).length === 0,
  'refuse nonempty output path / overwriting prior evidence');
mkdirSync(out, { recursive: true, mode: 0o700 });
mkdirSync(join(out, 'rpc'), { mode: 0o700 });
const errors = [];
const captures = [];
let requestId = 0;
const requestedAt = () => new Date().toISOString();
async function rpc(url, providerId, method, params, tag) {
  const file = 'rpc/' + safeFilename(providerId) + '-' +
    safeFilename(tag) + '.rpc.json';
  const request = { jsonrpc: '2.0', id: ++requestId, method, params };
  const record = { requestedAt: requestedAt(), providerId, method, params,
    request, response: null, responseAt: null, transportError: null };
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();
    assert.ok(response.ok, 'HTTP ' + response.status);
    const json = JSON.parse(raw);
    record.response = json;
    record.responseAt = requestedAt();
    assert.equal(json.jsonrpc, '2.0', 'JSON-RPC version');
    assert.equal(json.id, request.id, 'JSON-RPC request ID');
    assert.equal(json.error, undefined, 'JSON-RPC error ' + JSON.stringify(json.error));
    assert.ok(Object.hasOwn(json, 'result'), 'JSON-RPC result missing');
    writeFileSync(join(out, file), JSON.stringify(record, null, 2) + '\n');
    captures.push(file);
    return json.result;
  } catch (error) {
    record.responseAt = requestedAt();
    record.transportError = String(error?.message ?? error);
    errors.push({ providerId, method, params, file,
      reason: record.transportError, classification: 'UNAVAILABLE_OR_PRUNED' });
    writeFileSync(join(out, file), JSON.stringify(record, null, 2) + '\n');
    captures.push(file);
    return undefined;
  }
}

const blockOptions = { commitment: 'finalized', encoding: 'base64',
  transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 };
const rangeOptions = { commitment: 'finalized' };
function readOptionalJson(flag) {
  return argv[flag] ? JSON.parse(readFileSync(resolve(argv[flag]), 'utf8')) : null;
}
function originalSubmittedWires(input) {
  if (!input) return [];
  assert.ok(Array.isArray(input.transactions), 'original witness bundle transactions absent');
  const wires = [];
  const bySignature = new Map();
  for (const row of input.transactions) {
    if (!Object.hasOwn(row, 'signedWireBase64')) continue;
    const sig = firstWireSignature(row.signedWireBase64);
    assert.equal(sig, row.signature, 'submitted wire signature label disagreement');
    if (bySignature.has(sig)) {
      assert.equal(bySignature.get(sig), row.signedWireBase64,
        'conflicting original submitted wires for one signature');
    }
    bySignature.set(sig, row.signedWireBase64);
  }
  for (const [signature, signedWireBase64] of bySignature) {
    wires.push({ signature, signedWireBase64,
      sha256: sha256(Buffer.from(signedWireBase64, 'base64')),
      provenance: 'ORIGINAL_SUBMITTED_WIRE_FROM_USER_SUPPLIED_SOL_BUNDLE_NOT_RECONSTRUCTED' });
  }
  return wires;
}
function readAlt(flag, id) {
  const rows = readOptionalJson(flag);
  if (!rows) return [];
  assert.ok(Array.isArray(rows), id + ': historic ALT must be an array');
  for (const row of rows) {
    assert.ok(Number.isSafeInteger(row.slot) &&
      row.contextSlot === row.slot && row.commitment === 'finalized' &&
      typeof row.lookupTableAddress === 'string' &&
      row.owner === 'AddressLookupTab1e1111111111111111111111111' &&
      typeof row.rawBase64 === 'string' &&
      Buffer.from(row.rawBase64, 'base64').toString('base64') === row.rawBase64,
      id + ': invalid historical ALT record (never substitute current account state)');
  }
  return rows;
}
function validateFourAccountCapture(value, phase) {
  if (!value) return null;
  assert.ok(value.phase === phase && Array.isArray(value.addresses) &&
    value.addresses.length === 4 &&
    value.request?.method === 'getMultipleAccounts' &&
    value.request.params[0].length === 4 &&
    JSON.stringify(value.request.params[0]) === JSON.stringify(value.addresses) &&
    value.request.params[1]?.commitment === 'finalized' &&
    value.response?.result?.value?.length === 4 &&
    Number.isSafeInteger(value.response.result.context?.slot),
    'invalid ' + phase + ' four-account capture');
  // RPC context.slot is an observation time, NOT a historical at-slot proof.
  return value;
}
async function captureFourAccounts() {
  const phase = requireArg('capture-four-accounts');
  assert.ok(phase === 'pre' || phase === 'post');
  const url = requireArg('provider-a-url');
  const id = safeFilename(requireArg('provider-a-id'));
  const addresses = requireArg('four-addresses').split(',');
  assert.ok(addresses.length === 4 && addresses.every(x =>
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)),
  'four-addresses must be receipt,config,vault,mint');
  const result = await rpc(url, id, 'getMultipleAccounts',
    [addresses, { commitment: 'finalized', encoding: 'base64' }],
    'refund-' + phase);
  const file = { phase, addresses, requestedAt: requestedAt(),
    sourceProvider: id, request: { method: 'getMultipleAccounts',
      params: [addresses, { commitment: 'finalized', encoding: 'base64' }] },
    response: result === undefined ? null :
      JSON.parse(readFileSync(join(out, captures.at(-1)), 'utf8')).response,
    exactHistoricalSlotProven: false, limitation:
      'getMultipleAccounts finalized context.slot does not pin a past bank; capture pre and post around actual refund; require slot-indexed replay/proof for historical exactness',
  };
  writeFileSync(join(out, 'refund-' + phase + '-four-accounts.json'),
    JSON.stringify(file, null, 2) + '\n');
  return result ? 0 : 2;
}
async function archiveHistory() {
  const start = slot(requireArg('from-slot'), 'from-slot');
  const end = slot(requireArg('to-slot'), 'to-slot');
  assert.ok(start > 0 && end >= start && end - start <= 4095,
    'require bounded 1..4096 inclusive-slot archive, then checkpoint and resume');
  const configs = ['a','b'].map(k => ({
    providerId: safeFilename(requireArg('provider-' + k + '-id')),
    operator: requireArg('provider-' + k + '-operator'),
    url: requireArg('provider-' + k + '-url'),
  }));
  for (const c of configs) c.rpcUrl = safeUrl(c.url);
  assert.notEqual(configs[0].providerId, configs[1].providerId,
    'provider IDs must differ');
  const independenceUnproven = configs[0].rpcUrl === configs[1].rpcUrl ||
    configs[0].operator === configs[1].operator ||
    new URL(configs[0].rpcUrl).hostname === new URL(configs[1].rpcUrl).hostname;
  if (independenceUnproven) errors.push({
    classification: 'SAME_OPERATOR_OR_ENDPOINT_NOT_INDEPENDENT',
    reason: 'Two URLs on the same host/operator do not provide independent consensus or archive operator provenance',
  });
  const archive = {
    kind: 'observer-original-two-provider-history-v1',
    fromSlot: start, toSlot: end, genesisHash: null, providers: [],
  };
  const producedByProvider = [];
  for (let i = 0; i < 2; i++) {
    const config = configs[i], prefix = config.providerId, url = config.url;
    const provider = { providerId: prefix, rpcUrl: config.rpcUrl,
      operatorClaim: config.operator, operatorIdentityIndependentlyVerified: false,
      commitment: 'finalized', genesisHash: null, firstAvailableBlock: null,
      finalizedTip: null, getBlocks: [], getBlock: [], historicalAltAccounts:
        readAlt(i === 0 ? 'alt-a-json' : 'alt-b-json', prefix) };
    archive.providers.push(provider);
    provider.genesisHash = await rpc(url, prefix, 'getGenesisHash', [], 'genesis');
    provider.firstAvailableBlock =
      await rpc(url, prefix, 'getFirstAvailableBlock', [], 'first-available');
    provider.finalizedTip = await rpc(url, prefix, 'getSlot',
      [{ commitment: 'finalized' }], 'finalized-tip');
    if (!archive.genesisHash) archive.genesisHash = provider.genesisHash;
    if (provider.genesisHash !== archive.genesisHash) errors.push({
      classification: 'GENESIS_CONFLICT', providerId: prefix });
    if (!Number.isSafeInteger(provider.firstAvailableBlock) ||
        provider.firstAvailableBlock > start) errors.push({
      classification: 'PRUNED_BEFORE_START', providerId: prefix,
      firstAvailableBlock: provider.firstAvailableBlock, fromSlot: start });
    if (!Number.isSafeInteger(provider.finalizedTip) ||
        provider.finalizedTip < end) errors.push({
      classification: 'TIP_BEFORE_END', providerId: prefix,
      finalizedTip: provider.finalizedTip, toSlot: end });
    let produced = [], enumerationComplete = true;
    for (let from = start; from <= end; from += 256) {
      const to = Math.min(end, from + 255);
      const result = await rpc(url, prefix, 'getBlocks',
        [from, to, rangeOptions], 'getBlocks-' + from + '-' + to);
      if (!Array.isArray(result) ||
          result.some((n,j) => !Number.isSafeInteger(n) || n < from || n > to ||
            (j > 0 && n <= result[j-1]))) {
        enumerationComplete = false;
        errors.push({ classification: 'MISSING_OR_INVALID_GETBLOCKS',
          providerId: prefix, fromSlot: from, toSlot: to });
        break;
      }
      provider.getBlocks.push({ method: 'getBlocks', commitment: 'finalized',
        fromSlot: from, toSlot: to, result });
      produced.push(...result);
    }
    if (enumerationComplete) {
      for (let j = 1; j < produced.length; j++) {
        if (produced[j] <= produced[j-1]) {
          enumerationComplete = false;
          errors.push({ classification: 'DUPLICATE_PRODUCED_SLOT', providerId: prefix });
        }
      }
    }
    producedByProvider.push(enumerationComplete ? produced : null);
    if (enumerationComplete) {
      for (const number of produced) {
        const block = await rpc(url, prefix, 'getBlock',
          [number, blockOptions], 'getBlock-' + number);
        if (!block || !Array.isArray(block.transactions)) {
          errors.push({ classification: 'MISSING_PRODUCED_BLOCK',
            providerId: prefix, slot: number, resultWasNull: block === null });
          continue;
        }
        provider.getBlock.push({ method: 'getBlock', slot: number,
          options: blockOptions, result: block });
        for (const entry of block.transactions) {
          if (!Array.isArray(entry.transaction) ||
              entry.transaction[1] !== 'base64' ||
              !entry.meta || !Object.hasOwn(entry.meta, 'err')) {
            errors.push({ classification: 'INCOMPLETE_TRANSACTION',
              providerId: prefix, slot: number });
          }
          if (entry.version === 0 &&
              (!Array.isArray(provider.historicalAltAccounts) ||
               (entry.meta?.loadedAddresses?.writable?.length ||
                entry.meta?.loadedAddresses?.readonly?.length) &&
               !provider.historicalAltAccounts.some(x => x.slot === number))) {
            errors.push({ classification: 'HISTORIC_ALT_REQUIRED',
              providerId: prefix, slot: number });
          }
          if (!['legacy', 0, 1].includes(entry.version)) errors.push({
            classification: 'UNREVIEWED_TRANSACTION_VERSION',
            providerId: prefix, slot: number, version: entry.version });
        }
      }
    }
  }
  if (!producedByProvider[0] || !producedByProvider[1] ||
      JSON.stringify(producedByProvider[0]) !== JSON.stringify(producedByProvider[1]))
    errors.push({ classification: 'PRODUCED_SLOT_ENUMERATION_DISAGREEMENT' });
  if (archive.providers[0].getBlock.length !== producedByProvider[0]?.length ||
      archive.providers[1].getBlock.length !== producedByProvider[1]?.length)
    errors.push({ classification: 'FULL_BLOCK_COVERAGE_MISSING' });
  // Only ORIGINAL submitted bytes supplied by producer; never relabel RPC
  // getBlock bytes as original submitted wires.
  const wires = originalSubmittedWires(readOptionalJson('witness-bundle'));
  const required = (argv['required-signatures'] || '').split(',').filter(Boolean);
  if (!required.length) errors.push({ classification: 'REQUIRED_SIGNATURE_SET_UNDECLARED',
    reason: 'Deposit/refund signatures must be supplied for source wire coverage' });
  const observedSigs = new Set();
  for (const provider of archive.providers) for (const b of provider.getBlock) {
    for (const entry of b.result.transactions) {
      try { observedSigs.add(firstWireSignature(entry.transaction[0])); }
      catch (err) { errors.push({ classification: 'MALFORMED_FINALIZED_WIRE',
        providerId: provider.providerId, slot: b.slot, reason: String(err.message) }); }
    }
  }
  for (const signature of required) {
    if (!wires.some(w => w.signature === signature))
      errors.push({ classification: 'ORIGINAL_SUBMITTED_WIRE_MISSING', signature });
    if (!observedSigs.has(signature))
      errors.push({ classification: 'FINALIZED_SIGNATURE_NOT_IN_FETCHED_BLOCK', signature });
  }
  const refundPre = validateFourAccountCapture(readOptionalJson('refund-pre-json'), 'pre');
  const refundPost = validateFourAccountCapture(readOptionalJson('refund-post-json'), 'post');
  if (!refundPre || !refundPost) errors.push({
    classification: 'REFUND_FOUR_ACCOUNT_PRE_POST_MISSING',
    reason: 'Need genuine receipt/config/vault/mint pre and post snapshots around refund' });
  else if (JSON.stringify(refundPre.addresses) !== JSON.stringify(refundPost.addresses) ||
    refundPre.response.result.context.slot >= refundPost.response.result.context.slot)
    errors.push({ classification: 'REFUND_SNAPSHOT_ORDER_OR_ACCOUNTS_CONFLICT' });
  // Even successful snapshot capture does not authenticate a historical bank
  // or prove it is exactly the state at the refund instruction boundaries.
  errors.push({ classification: 'HISTORICAL_REFUND_STATE_PROOF_NOT_ESTABLISHED',
    reason: 'RPC getMultipleAccounts cannot query an exact prior transaction-slot bank; use independent archival replay/bank proof' });
  if (independenceUnproven) errors.push({
    classification: 'INDEPENDENT_RPC_OPERATOR_UNPROVEN' });
  const handoff = {
    kind: 'solana-produced-slot-archive-handoff-v1',
    createdAt: requestedAt(), archive, originalSubmittedWires: wires,
    requiredSignatures: required,
    refundFourAccountCaptures: { pre: refundPre, post: refundPost },
    gaps: errors, sourceFiles: captures,
    coveredByTwoSourceClaims: errors.filter(x =>
      !['HISTORICAL_REFUND_STATE_PROOF_NOT_ESTABLISHED'].includes(x.classification)).length===0,
    fullHistoryGate: 'BLOCKED',
    absentSlotsClassifiedAsEmpty: false,
    independentConsensusVerified: false, creditEligible: false,
    spendableBaseUnits: '0', withdrawalAuthorized: false,
    caveat: 'Local RPC or two endpoint agreement is NOT independently authenticated consensus; missing evidence never passes',
  };
  writeFileSync(join(out, 'observer-history-candidate.json'),
    JSON.stringify(archive, null, 2) + '\n');
  writeFileSync(join(out, 'produced-slot-handoff.json'),
    JSON.stringify(handoff, null, 2) + '\n');
  return errors.length ? 2 : 0;
}
let exitCode;
try {
  exitCode = argv['capture-four-accounts'] ?
    await captureFourAccounts() : await archiveHistory();
} catch (error) {
  errors.push({ classification: 'PRODUCER_FATAL', reason: String(error?.message ?? error) });
  exitCode = 2;
}
// Preserve all failure/partial records, even when the CLI exits nonzero.
const allFiles = readdirSync(join(out, 'rpc')).map(name => 'rpc/' + name);
for (const name of ['observer-history-candidate.json',
  'produced-slot-handoff.json', 'refund-pre-four-accounts.json',
  'refund-post-four-accounts.json']) if (existsSync(join(out, name))) allFiles.push(name);
writeFileSync(join(out, 'capture-status.json'),
  JSON.stringify({ status: exitCode ? 'BLOCKED_PARTIAL' : 'RECORDED_NOT_SEC_APPROVED',
    errors, recordedAt: requestedAt(), fileCount: allFiles.length,
    independentConsensusVerified: false, creditEligible: false,
    spendableBaseUnits: '0', withdrawalAuthorized: false }, null, 2) + '\n');
allFiles.push('capture-status.json');
writeFileSync(join(out, 'evidence-manifest.sha256'),
  allFiles.sort().map(name =>
    sha256(readFileSync(join(out, name))) + '  ' + name).join('\n') + '\n');
console.log('Produced-slot archive capture: ' + (exitCode ? 'BLOCKED_PARTIAL' : 'RECORDED_NOT_SEC_APPROVED') +
  ' | original response files ' + captures.length +
  ' | gaps ' + errors.length + ' | ' + out);
process.exitCode = exitCode;
