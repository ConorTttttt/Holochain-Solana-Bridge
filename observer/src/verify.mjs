import { createHash } from 'node:crypto';
import { addressBytes, decodeConfig, decodeReceipt, decodeTokenAccount, decodeMint, strictHex32 } from './decode.mjs';
import { deriveBridgeAddresses } from './pda.mjs';

export const CLASSIC_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ZERO32 = '0'.repeat(64);
const digest = raw => createHash('sha256').update(raw).digest('hex');
function requireThat(ok, message) { if (!ok) throw new Error(message); }

/** Observes (untrusted) RPC-reported state; does not verify a creating transaction. */
export async function verifySnapshot({ snapshot, expected, genesisHash, source = 'rpc' }) {
  requireThat(expected && typeof expected === 'object', 'Missing trusted expected addresses');
  for (const field of ['program', 'receipt', 'config', 'vault', 'mint']) addressBytes(expected[field]);
  addressBytes(genesisHash);
  const expectedScope = strictHex32(expected.scope);
  requireThat(expectedScope !== ZERO32, 'Zero Holochain scope');
  requireThat(snapshot && Number.isSafeInteger(snapshot.slot) && snapshot.slot > 0, 'No finalized snapshot slot');
  requireThat(Array.isArray(snapshot.accounts) && snapshot.accounts.length === 4, 'Unexpected account snapshot');
  const [receiptInfo, configInfo, vaultInfo, mintInfo] = snapshot.accounts;
  requireThat(receiptInfo && configInfo && vaultInfo && mintInfo, 'Missing one or more accounts');
  requireThat(receiptInfo.owner === expected.program, 'Receipt has wrong program owner');
  requireThat(configInfo.owner === expected.program, 'Config has wrong program owner');
  requireThat(vaultInfo.owner === CLASSIC_TOKEN_PROGRAM, 'Vault is not a classic SPL Token account');
  requireThat(mintInfo.owner === CLASSIC_TOKEN_PROGRAM, 'Mint is not owned by classic SPL Token program');
  const r = decodeReceipt(receiptInfo.raw);
  const c = decodeConfig(configInfo.raw);
  const v = decodeTokenAccount(vaultInfo.raw);
  const m = decodeMint(mintInfo.raw);
  requireThat(r.config === expected.config, 'Receipt config mismatch');
  requireThat(r.mint === expected.mint && c.mint === expected.mint && v.mint === expected.mint, 'Mint mismatch');
  requireThat(r.vault === expected.vault, 'Receipt vault mismatch');
  requireThat(r.scope === expectedScope && c.scope === expectedScope, 'Holochain scope mismatch');
  requireThat(r.depositor !== '11111111111111111111111111111111', 'Zero depositor');
  requireThat(c.admin !== '11111111111111111111111111111111', 'Zero config admin');
  requireThat(r.recipientCore !== ZERO32, 'Zero Holochain recipient');
  requireThat(v.authority === expected.config, 'Vault authority is not config PDA');
  requireThat(v.state === 1, 'Vault token account is frozen or uninitialized');
  requireThat(!v.isNative && !v.hasDelegate && !v.hasCloseAuthority, 'Vault has unapproved SPL token authority or native flag');
  requireThat(m.initialized && !m.hasFreezeAuthority, 'Mint uninitialized or freezable');
  requireThat(BigInt(r.amount) > 0n, 'Zero deposit amount');
  requireThat(BigInt(m.supply) >= BigInt(v.amount), 'Vault exceeds mint total supply');
  requireThat(BigInt(v.amount) >= BigInt(c.totalActive), 'Aggregate active liabilities exceed vault balance');

  const pdas = await deriveBridgeAddresses({
    program: expected.program, mint: expected.mint, depositor: r.depositor, nonce: BigInt(r.nonce),
  });
  requireThat(expected.config === pdas.config, 'Noncanonical config PDA');
  requireThat(expected.vault === pdas.vault, 'Noncanonical vault PDA');
  requireThat(expected.receipt === pdas.receipt, 'Noncanonical receipt PDA/nonce/depositor/program');
  requireThat(c.bump === pdas.configBump, 'Incorrect config PDA bump');
  requireThat(r.bump === pdas.receiptBump, 'Incorrect receipt PDA bump');

  // Current state can change after this read, and a refunded receipt remains refundable evidence ONLY.
  return Object.freeze({
    kind: 'solana-receipt-observation-v1',
    id: `${genesisHash}:${expected.program}:${expected.receipt}`,
    source,
    genesisHash,
    finalizedSlot: snapshot.slot,
    commitmentRequested: 'finalized',
    program: expected.program,
    receiptAddress: expected.receipt,
    configAddress: expected.config,
    vaultAddress: expected.vault,
    mint: expected.mint,
    depositor: r.depositor,
    recipientCore: r.recipientCore,
    holochainScope: r.scope,
    depositNonce: r.nonce,
    amountBaseUnits: r.amount,
    activeVaultBaseUnits: v.amount,
    activeLiabilitiesBaseUnits: c.totalActive,
    mintSupplyBaseUnits: m.supply,
    receiptDigest: digest(receiptInfo.raw),
    configDigest: digest(configInfo.raw),
    vaultDigest: digest(vaultInfo.raw),
    mintDigest: digest(mintInfo.raw),
    configBump: c.bump,
    receiptBump: r.bump,
    refunded: r.refunded,
    state: r.refunded ? 'refunded' : 'active_refundable',
    transactionVerified: false,
    independentConsensusVerified: false,
    spendableBaseUnits: '0',
    withdrawalAuthorized: false,
    evidenceTrust: 'untrusted_rpc_snapshot',
    /** HARD GATE: no observation ever grants Holochain economic authorization. */
    creditEligible: false,
  });
}

/** Reject duplicate IDs in a candidate batch. Durable deduplication belongs to the S2 indexer. */
export function assertUniqueObservations(observations) {
  requireThat(Array.isArray(observations), 'Expected observation array');
  const ids = new Set();
  for (const item of observations) {
    requireThat(item && item.kind === 'solana-receipt-observation-v1' && item.creditEligible === false &&
      item.independentConsensusVerified === false && item.spendableBaseUnits === '0' &&
      item.withdrawalAuthorized === false && typeof item.id === 'string', 'Invalid observation');
    requireThat(!ids.has(item.id), 'Duplicated receipt observation');
    ids.add(item.id);
  }
  return Object.freeze([...observations]);
}

/** Compare RPC-reported observations; neither provider is an independent consensus proof. */
export function reconcileObservations(a, b) {
  for (const obs of [a, b]) {
    requireThat(obs && obs.kind === 'solana-receipt-observation-v1' && obs.creditEligible === false &&
      obs.transactionVerified === false && obs.independentConsensusVerified === false &&
      obs.spendableBaseUnits === '0' && obs.withdrawalAuthorized === false, 'Invalid untrusted observation');
  }
  for (const field of ['id', 'genesisHash', 'program', 'receiptAddress', 'configAddress', 'vaultAddress', 'mint', 'depositor', 'recipientCore', 'holochainScope', 'depositNonce', 'amountBaseUnits', 'receiptDigest', 'refunded']) {
    requireThat(a[field] === b[field], `RPC providers disagree about ${field}`);
  }
  if (a.finalizedSlot === b.finalizedSlot) {
    for (const field of ['configDigest', 'vaultDigest', 'mintDigest']) {
      requireThat(a[field] === b[field], `RPC providers disagree about ${field} at same slot`);
    }
  }
  return Object.freeze({
    ...a,
    checkedBy: Object.freeze([a.source, b.source]),
    providerFinalizedSlots: Object.freeze([a.finalizedSlot, b.finalizedSlot]),
    agreement: a.finalizedSlot === b.finalizedSlot ? 'same_slot_bytes' : 'receipt_bytes_only',
    transactionVerified: false,
    independentConsensusVerified: false,
    spendableBaseUnits: '0',
    withdrawalAuthorized: false,
    evidenceTrust: 'untrusted_rpc_snapshot',
    creditEligible: false,
  });
}

function decodeRpcAccount(value) {
  requireThat(value && typeof value.owner === 'string', 'Missing account owner');
  requireThat(value.executable === false, 'Unexpected executable account');
  requireThat(Array.isArray(value.data) && value.data.length === 2 && value.data[1] === 'base64', 'Expected base64 account data');
  requireThat(typeof value.data[0] === 'string' && value.data[0].length > 0, 'Missing base64 account body');
  const raw = Buffer.from(value.data[0], 'base64');
  requireThat(raw.length > 0 && raw.toString('base64') === value.data[0], 'Malformed account data');
  if (value.space !== undefined) requireThat(value.space === raw.length, 'RPC account space mismatch');
  if (value.lamports !== undefined) requireThat(Number.isSafeInteger(value.lamports) && value.lamports > 0, 'Unfunded or invalid account');
  return { owner: value.owner, raw };
}

async function rpcCall(url, method, params, fetchFn) {
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`RPC HTTP failure: ${response.status}`);
  const json = await response.json();
  requireThat(json && json.jsonrpc === '2.0' && json.id === 1, `Malformed RPC ${method} response envelope`);
  if (json.error) throw new Error(`RPC ${method} error ${json.error.code}: ${json.error.message}`);
  if (!Object.hasOwn(json, 'result')) throw new Error('RPC missing result');
  return json.result;
}

/** Read-only. getMultipleAccounts is a point-in-time RPC view, not historical tx proof. */
export async function observeRpc({ rpcUrl, expected, genesisHash, fetchFn = fetch }) {
  const network = await rpcCall(rpcUrl, 'getGenesisHash', [], fetchFn);
  requireThat(network === genesisHash, 'RPC genesis hash mismatch');
  const result = await rpcCall(rpcUrl, 'getMultipleAccounts', [
    [expected.receipt, expected.config, expected.vault, expected.mint],
    { encoding: 'base64', commitment: 'finalized' },
  ], fetchFn);
  requireThat(result && result.context && Array.isArray(result.value), 'Malformed getMultipleAccounts result');
  const snapshot = { slot: result.context.slot, accounts: result.value.map(decodeRpcAccount) };
  return verifySnapshot({ snapshot, expected, genesisHash, source: new URL(rpcUrl).host });
}
