import { createHash } from 'node:crypto';
import { addressBytes, decode58, decodeConfig, decodeReceipt, decodeTokenAccount, strictHex32 } from './decode.mjs';

export const CLASSIC_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function requireThat(ok, message) { if (!ok) throw new Error(message); }

/** This is RPC-observed state, not a cryptographically authenticated consensus proof. */
export function verifySnapshot({ snapshot, expected, genesisHash, source = 'rpc' }) {
  for (const field of ['program', 'receipt', 'config', 'vault', 'mint']) addressBytes(expected[field]);
  addressBytes(genesisHash);
  const expectedScope = strictHex32(expected.scope);
  requireThat(expectedScope !== '0'.repeat(64), 'Zero Holochain scope');
  requireThat(snapshot && Number.isSafeInteger(snapshot.slot) && snapshot.slot > 0, 'No finalized snapshot slot');
  requireThat(Array.isArray(snapshot.accounts) && snapshot.accounts.length === 3, 'Unexpected account snapshot');
  const [receiptInfo, configInfo, vaultInfo] = snapshot.accounts;
  requireThat(receiptInfo && configInfo && vaultInfo, 'Missing one or more accounts');
  requireThat(receiptInfo.owner === expected.program, 'Receipt has wrong program owner');
  requireThat(configInfo.owner === expected.program, 'Config has wrong program owner');
  requireThat(vaultInfo.owner === CLASSIC_TOKEN_PROGRAM, 'Vault is not a classic SPL Token account');
  const r = decodeReceipt(receiptInfo.raw);
  const c = decodeConfig(configInfo.raw);
  const v = decodeTokenAccount(vaultInfo.raw);
  requireThat(r.config === expected.config, 'Receipt config mismatch');
  requireThat(r.mint === expected.mint && c.mint === expected.mint && v.mint === expected.mint, 'Mint mismatch');
  requireThat(r.vault === expected.vault, 'Receipt vault mismatch');
  requireThat(r.scope === expectedScope && c.scope === expectedScope, 'Holochain scope mismatch');
  requireThat(r.recipientCore !== '0'.repeat(64), 'Zero Holochain recipient');
  requireThat(v.authority === expected.config, 'Vault authority is not config PDA');
  requireThat(v.state === 1, 'Vault token account is frozen or uninitialized');
  requireThat(!v.hasDelegate && !v.hasCloseAuthority, 'Vault has unapproved SPL delegated/close authority');
  requireThat(BigInt(r.amount) > 0n, 'Zero deposit amount');
  requireThat(BigInt(v.amount) >= BigInt(c.totalActive), 'Aggregate active liabilities exceed vault balance');
  // No withdrawal or Holochain issuance path exists in this prototype. Deposits ARE refundable.
  const receiptDigest = createHash('sha256').update(receiptInfo.raw).digest('hex');
  return Object.freeze({
    kind: 'solana-receipt-observation-v1',
    id: `${genesisHash}:${expected.program}:${expected.receipt}`,
    source,
    genesisHash,
    finalizedSlot: snapshot.slot,
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
    receiptDigest,
    refunded: r.refunded,
    state: r.refunded ? 'refunded' : 'active_refundable',
    /** HARD GATE: even unrefunded deposits must NEVER become spendable on Holochain. */
    creditEligible: false,
  });
}

/** Fail closed if two RPC endpoints disagree about the receipt's present state. */
export function reconcileObservations(a, b) {
  requireThat(a.id === b.id, 'Different deposit identities');
  requireThat(a.receiptDigest === b.receiptDigest, 'RPC providers disagree about receipt bytes');
  requireThat(a.refunded === b.refunded, 'RPC providers disagree about refund status');
  // Slot and total vault balance can legitimately differ on distinct finalized snapshots.
  return Object.freeze({ ...a, checkedBy: [a.source, b.source], creditEligible: false });
}

function decodeRpcAccount(value) {
  requireThat(value && typeof value.owner === 'string', 'Missing account owner');
  requireThat(Array.isArray(value.data) && value.data[1] === 'base64', 'Expected base64 account data');
  requireThat(typeof value.data[0] === 'string', 'Missing base64 account body');
  const raw = Buffer.from(value.data[0], 'base64');
  requireThat(raw.toString('base64') === value.data[0], 'Malformed account data');
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
  if (json.error) throw new Error(`RPC ${method} error ${json.error.code}: ${json.error.message}`);
  if (!Object.hasOwn(json, 'result')) throw new Error('RPC missing result');
  return json.result;
}

/** Read-only. Never posts an on-chain transaction or calls Holochain. */
export async function observeRpc({ rpcUrl, expected, genesisHash, fetchFn = fetch }) {
  const network = await rpcCall(rpcUrl, 'getGenesisHash', [], fetchFn);
  requireThat(network === genesisHash, 'RPC genesis hash mismatch');
  const result = await rpcCall(rpcUrl, 'getMultipleAccounts', [
    [expected.receipt, expected.config, expected.vault],
    { encoding: 'base64', commitment: 'finalized' },
  ], fetchFn);
  requireThat(result && result.context && result.value, 'Malformed getMultipleAccounts result');
  const snapshot = { slot: result.context.slot, accounts: result.value.map(decodeRpcAccount) };
  return verifySnapshot({ snapshot, expected, genesisHash, source: new URL(rpcUrl).host });
}
