/**
 * Read-only, fail-closed Solana deposit transaction evidence.
 * Uses @solana/kit 8.x to decode actual signed wire bytes (legacy/v0/v1)
 * and resolve outer/inner instructions. RPC finality remains a provider claim.
 */
import { createHash } from 'node:crypto';
import {
  getBase64Encoder, getTransactionDecoder, getCompiledTransactionMessageDecoder,
  walkInstructions, isSignerRole, isWritableRole,
  getPublicKeyFromAddress, verifySignature,
} from '@solana/kit';
import { addressBytes, encode58, strictHex32 } from './decode.mjs';
import { deriveBridgeAddresses } from './pda.mjs';
import { CLASSIC_TOKEN_PROGRAM } from './verify.mjs';
import { validateGeneratedIdl } from '../scripts/verify-idl.mjs';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const ZERO32 = '0'.repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const hex = x => Buffer.from(x).toString('hex');
const hash = x => createHash('sha256').update(x).digest('hex');
const disc = name => createHash('sha256').update('global:' + name).digest().subarray(0, 8);
function need(ok, msg) { if (!ok) throw new Error('Transaction verification failed: ' + msg); }
function integer(n, name) { need(Number.isSafeInteger(n) && n >= 0, 'invalid ' + name); return n; }
function exactAmount(value) {
  need(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), 'invalid exact token balance');
  const n = BigInt(value);
  need(n <= U64_MAX, 'token balance exceeds u64');
  return n;
}
function sameAddress(value, expected, what) {
  need(value === expected, 'wrong ' + what);
}
function instructionName(ix) {
  const data = ix.data ? Buffer.from(ix.data) : Buffer.alloc(0);
  return data.length >= 8 ? data.subarray(0, 8) : Buffer.alloc(0);
}
function accountAddress(ix, i) {
  need(Array.isArray(ix.accounts) && ix.accounts[i]?.address, 'missing instruction account ' + i);
  return ix.accounts[i].address;
}
function tokenBalance(meta, side, index, mint, owner) {
  const balances = meta[side + 'TokenBalances'];
  need(Array.isArray(balances), 'missing ' + side + 'TokenBalances');
  const matches = balances.filter(x => x.accountIndex === index);
  need(matches.length === 1, 'missing/duplicated ' + side + ' token balance for account ' + index);
  const b = matches[0];
  sameAddress(b.mint, mint, side + ' mint');
  sameAddress(b.owner, owner, side + ' token authority');
  need(b.programId === CLASSIC_TOKEN_PROGRAM, 'wrong ' + side + ' token program');
  need(b.uiTokenAmount && Number.isInteger(b.uiTokenAmount.decimals) && b.uiTokenAmount.decimals >= 0 &&
    b.uiTokenAmount.decimals <= 255, 'missing token decimals');
  return {value: exactAmount(b.uiTokenAmount.amount), decimals: b.uiTokenAmount.decimals};
}
function ensureDelta(meta, keyIndex, mint, owner, delta) {
  const before = tokenBalance(meta, 'pre', keyIndex, mint, owner);
  const after = tokenBalance(meta, 'post', keyIndex, mint, owner);
  need(before.decimals === after.decimals, 'token decimals changed within transaction');
  need(after.value - before.value === delta, 'custody/source token balance delta mismatch');
  return before.decimals;
}
function checkIdl(idl, program) {
  need(idl && typeof idl === 'object', 'actual Anchor IDL required');
  validateGeneratedIdl(idl, {expectedProgramId:program});
  const norm = x => typeof x === 'string' ? x.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()) : x;
  const ix = idl.instructions?.find(x => norm(x.name) === 'deposit');
  need(ix && Array.isArray(ix.discriminator) && hex(ix.discriminator) === hex(disc('deposit')), 'generated deposit discriminator mismatch');
  need(Array.isArray(ix.accounts) && ix.accounts.length === 8 &&
    ix.accounts.map(x => norm(x.name)).join(',') ===
    'depositor,config,mint,source,vault,receipt,tokenProgram,systemProgram', 'generated deposit accounts differ');
  const args = ix.args || [];
  need(args.length === 3 && norm(args[0].name) === 'nonce' && args[0].type === 'u64' &&
    norm(args[1].name) === 'recipientCore' && JSON.stringify(args[1].type) === JSON.stringify({array:['u8',32]}) &&
    norm(args[2].name) === 'amount' && args[2].type === 'u64', 'generated deposit instruction args differ');
}
/** Decode, including v0 lookup-table keys and v1 message configuration, from signed base64 wire bytes. */
export function decodeFinalizedWire(rpcTransaction, signature) {
  need(rpcTransaction && typeof rpcTransaction === 'object', 'missing transaction result');
  need(['legacy', 0, 1].includes(rpcTransaction.version), 'unsupported transaction version');
  need(rpcTransaction.meta && rpcTransaction.meta.err === null, 'missing/failed transaction metadata');
  need(Number.isSafeInteger(rpcTransaction.slot) && rpcTransaction.slot > 0, 'invalid finalized transaction slot');
  const encoded = rpcTransaction.transaction;
  need(Array.isArray(encoded) && encoded.length === 2 && encoded[1] === 'base64' &&
    typeof encoded[0] === 'string', 'expected raw base64 wire transaction, not jsonParsed');
  const bytes = Buffer.from(encoded[0], 'base64');
  need(bytes.length && bytes.toString('base64') === encoded[0], 'noncanonical base64 transaction');
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(encoded[0]));
  const compiledMessage = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  need(compiledMessage.version === rpcTransaction.version, 'RPC transaction version contradicts signed wire');
  // Kit 8.6's SignaturesMap is an address-keyed object, NOT a JS Map.
  // Bind the transaction id to the actual first static signer (the fee payer),
  // rather than relying on JSON property enumeration order.
  const signatures = tx.signatures;
  need(signatures && typeof signatures === 'object' && !Array.isArray(signatures) &&
    !(signatures instanceof Map), 'missing signed transaction signatures');
  const signerAddresses = Object.keys(signatures);
  const header = compiledMessage.header;
  need(Number.isInteger(header?.numSignerAccounts) && header.numSignerAccounts > 0 &&
    header.numSignerAccounts <= compiledMessage.staticAccounts.length &&
    signerAddresses.length === header.numSignerAccounts &&
    compiledMessage.staticAccounts.slice(0, header.numSignerAccounts)
      .every(address => Object.hasOwn(signatures, address)),
    'header/signature signer mismatch');
  const first = signatures[compiledMessage.staticAccounts[0]];
  need(first instanceof Uint8Array && first.length === 64 && encode58(first) === signature,
    'transaction signature does not match signed bytes');
  const loaded = rpcTransaction.meta.loadedAddresses;
  if (rpcTransaction.version === 0) {
    const tables = compiledMessage.addressTableLookups || [];
    const counts = tables.reduce((sum, table) => {
      need(Array.isArray(table.writableIndexes) && Array.isArray(table.readonlyIndexes),
        'invalid signed v0 address lookup table shape');
      sum.writable += table.writableIndexes.length;
      sum.readonly += table.readonlyIndexes.length;
      return sum;
    }, {writable:0, readonly:0});
    const writable = loaded?.writable || [];
    const readonly = loaded?.readonly || [];
    need(Array.isArray(writable) && Array.isArray(readonly) &&
      writable.length === counts.writable && readonly.length === counts.readonly,
      'v0 address lookup resolution unavailable/inconsistent with signed indexes');
    for (const address of [...writable,...readonly]) addressBytes(address);
  } else {
    need(!compiledMessage.addressTableLookups?.length &&
      !loaded?.writable?.length && !loaded?.readonly?.length,
      'non-v0 transaction cannot contain address lookup table keys');
  }
  const instructions = [...walkInstructions({compiledMessage,loadedAddresses:loaded,meta:{...rpcTransaction.meta,innerInstructions:rpcTransaction.meta.innerInstructions || []}})];
  return {compiledMessage, instructions, bytes, transactionHash:hash(bytes), signedTransaction:tx};
}
/**
 * Verify every required Ed25519 signature over the exact signed wire-message bytes.
 * This is local cryptographic validation, NOT block inclusion or source consensus.
 */
export async function verifyWireSignatures(decoded) {
  const {compiledMessage, signedTransaction} = decoded;
  const required=compiledMessage.staticAccounts.slice(0,compiledMessage.header.numSignerAccounts);
  const signatures = signedTransaction.signatures;
  need(required.length > 0 && signatures && typeof signatures === 'object' &&
    Object.keys(signatures).length === required.length &&
    required.every(address => Object.hasOwn(signatures, address)),
    'required signer/signature count mismatch');
  for(const signer of required) {
    const sig=signatures[signer];
    need(sig && sig.length===64, 'missing required signer signature');
    const key=await getPublicKeyFromAddress(signer);
    need(await verifySignature(key,sig,signedTransaction.messageBytes),
      'invalid Ed25519 transaction signature');
  }
  return true;
}
/**
 * Obtain deposit candidates from a SUCCESSFUL transaction fetched with commitment finalized.
 * finalizedClaim is only an assertion that the caller made that RPC request; NOT consensus proof.
 * A transaction-wide vault/source delta must equal the sum of the verified deposits.
 */
export async function verifyDepositCandidates({
  rpcTransaction, signature, expected, genesisHash, idl, finalizedClaim = false,
  blockhash, source = 'untrusted_rpc',
}) {
  need(finalizedClaim === true, 'finalized RPC request not established');
  need(expected && typeof expected === 'object', 'missing pinned deployment manifest');
  for (const key of ['program','mint','config','vault']) addressBytes(expected[key]);
  addressBytes(genesisHash);
  const scope = strictHex32(expected.scope);
  need(scope !== ZERO32, 'zero trusted Holochain scope');
  need(typeof signature === 'string' && signature.length > 0, 'missing signature');
  need(typeof blockhash === 'string', 'missing finalized blockhash');
  addressBytes(blockhash);
  checkIdl(idl, expected.program);
  const decoded=decodeFinalizedWire(rpcTransaction,signature);
  await verifyWireSignatures(decoded);
  const {compiledMessage, instructions, bytes, transactionHash} = decoded;
  const cfg = await deriveBridgeAddresses({
    program:expected.program,mint:expected.mint,depositor:SYSTEM_PROGRAM,nonce:0n,
  });
  need(cfg.config === expected.config && cfg.vault === expected.vault, 'noncanonical pinned config/vault');
  const metas = rpcTransaction.meta;
  const allKeys = [
    ...compiledMessage.staticAccounts,
    ...(metas.loadedAddresses?.writable || []),
    ...(metas.loadedAddresses?.readonly || []),
  ];
  need(allKeys.every(x => typeof x === 'string'), 'unresolved transaction accounts');
  need(Array.isArray(metas.preBalances) && Array.isArray(metas.postBalances) &&
    metas.preBalances.length === allKeys.length && metas.postBalances.length === allKeys.length,
    'missing transaction account balance metadata');
  const deposits = [];
  const matchedTransfers = new Set();
  const sourceSums = new Map();
  let vaultSum = 0n;
  for (const [index, ix] of instructions.entries()) {
    if (ix.programAddress !== expected.program) continue;
    if (instructionName(ix).equals(disc('refund'))) {
      throw new Error('Transaction verification failed: refund lifecycle needs separate reconciliation');
    }
    if (!instructionName(ix).equals(disc('deposit'))) continue;
    need(ix.trace?.kind === 'outer', 'nested/CPI deposit requires unambiguous execution trace');
    const data = Buffer.from(ix.data || []);
    need(data.length === 56, 'invalid deposit instruction length');
    const nonce = data.readBigUInt64LE(8);
    const recipientCore = data.subarray(16,48).toString('hex');
    const amount = data.readBigUInt64LE(48);
    need(amount > 0n && recipientCore !== ZERO32, 'zero deposit amount/destination');
    need(ix.accounts?.length === 8, 'wrong number of deposit instruction accounts');
    const [depositor, config, mint, sourceAccount, vault, receipt, tokenProgram, systemProgram] =
      ix.accounts.map(x => x.address);
    sameAddress(config, expected.config, 'config');
    sameAddress(mint, expected.mint, 'mint');
    sameAddress(vault, expected.vault, 'vault');
    sameAddress(tokenProgram, CLASSIC_TOKEN_PROGRAM, 'SPL token program');
    sameAddress(systemProgram, SYSTEM_PROGRAM, 'system program');
    addressBytes(depositor); addressBytes(sourceAccount); addressBytes(receipt);
    need(isSignerRole(ix.accounts[0].role), 'depositor not a transaction signer');
    for (const position of [0,1,3,4,5]) {
      need(isWritableRole(ix.accounts[position].role), 'deposit account is not writable: ' + position);
    }
    const pdas = await deriveBridgeAddresses({program:expected.program,mint,depositor,nonce});
    sameAddress(receipt,pdas.receipt,'receipt PDA');
    need(!deposits.some(x=>x.receiptAddress===receipt), 'duplicate receipt creation in one transaction');
    const descendants = instructions.map((candidate, n) => ({candidate,n})).filter(
      x => x.candidate.trace?.kind === 'inner' && x.candidate.trace.outerIndex === ix.trace.index &&
      x.candidate.programAddress === CLASSIC_TOKEN_PROGRAM);
    const transfers = descendants.filter(x => Buffer.from(x.candidate.data || [])[0] === 12);
    need(transfers.length === 1, 'expected exactly one inner SPL TransferChecked for deposit');
    const transfer = transfers[0];
    const t = transfer.candidate, td = Buffer.from(t.data || []);
    need(td.length === 10 && td.readBigUInt64LE(1) === amount, 'SPL transfer amount mismatch');
    need(t.accounts?.length === 4 &&
      [sourceAccount,mint,vault,depositor].every((a,i)=>accountAddress(t,i)===a),
      'SPL transfer accounts mismatch');
    matchedTransfers.add(transfer.n);
    const receiptIndex = allKeys.indexOf(receipt);
    need(receiptIndex >= 0 && metas.preBalances[receiptIndex] === 0 &&
      Number.isSafeInteger(metas.postBalances[receiptIndex]) && metas.postBalances[receiptIndex] > 0,
      'receipt not newly rent-funded in transaction');
    deposits.push({
      id: genesisHash + ':' + expected.program + ':' + receipt,
      occurrenceId: genesisHash + ':' + expected.program + ':' + signature + ':outer:' + ix.trace.index,
      signature, transactionVersion:rpcTransaction.version, finalizedSlot:rpcTransaction.slot,
      blockhash, transactionHash, instructionPath:'outer:' + ix.trace.index,
      cpiPath:'inner:' + ix.trace.index + ':' + transfer.candidate.trace.innerIndex,
      program:expected.program, configAddress:config,vaultAddress:vault,mint,
      receiptAddress:receipt,depositor,sourceTokenAccount:sourceAccount,
      holochainScope:scope, recipientCore, depositNonce:nonce.toString(),
      amountBaseUnits:amount.toString(), receiptBump:pdas.receiptBump,
      configBump:pdas.configBump, source,
    });
    const previous = sourceSums.get(sourceAccount) || 0n;
    sourceSums.set(sourceAccount,previous + amount);
    vaultSum += amount;
    need(td[9] <= 255, 'invalid SPL decimals');
  }
  if (!deposits.length) return Object.freeze([]);
  need(Array.isArray(metas.innerInstructions), 'missing CPI execution metadata for deposit');
  // Disallow extra classic SPL instructions touching the vault or any depositor source
  // because per-transaction balance deltas cannot uniquely attribute such movements.
  for (const [n,ix] of instructions.entries()) {
    if (ix.programAddress !== CLASSIC_TOKEN_PROGRAM || matchedTransfers.has(n)) continue;
    if (ix.accounts?.some(a=>a.address===expected.vault || sourceSums.has(a.address))) {
      throw new Error('Transaction verification failed: unaccounted SPL instruction touches custody/source');
    }
  }
  const vaultIndex = allKeys.indexOf(expected.vault);
  need(vaultIndex >= 0, 'vault missing from transaction accounts');
  const vaultDecimals=ensureDelta(metas,vaultIndex,expected.mint,expected.config,vaultSum);
  for (const [account,total] of sourceSums) {
    const sourceIndex=allKeys.indexOf(account);
    need(sourceIndex >= 0, 'source missing from transaction accounts');
    const sourceDecimals=ensureDelta(metas,sourceIndex,expected.mint,
      deposits.find(x=>x.sourceTokenAccount===account).depositor,-total);
    need(sourceDecimals===vaultDecimals, 'SPL source/vault decimals mismatch');
  }
  // Validate all transfer_checked inner instructions, including decimals per candidate.
  for (const ix of instructions.filter((_,n)=>matchedTransfers.has(n))) {
    need(Buffer.from(ix.data)[9]===vaultDecimals, 'TransferChecked decimals mismatch');
  }
  return Object.freeze(deposits.map(d=>Object.freeze({...d,
    kind:'solana-deposit-transaction-candidate-v1',
    verifiedByRpcClaim:true, transactionVerified:true, independentConsensusVerified:false,
    evidenceTrust:'rpc_finalized_transaction_with_custody_deltas',
    creditEligible:false,
  })));
}
/** Attach independently decoded canonical receipt-account snapshot to each candidate. */
export function attachReceiptObservation(candidate, observation) {
  need(candidate?.kind==='solana-deposit-transaction-candidate-v1' &&
    candidate.creditEligible===false, 'invalid transaction candidate');
  need(observation?.kind==='solana-receipt-observation-v1' &&
    observation.creditEligible===false && observation.transactionVerified===false, 'invalid receipt observation');
  for (const [a,b] of [
    ['id','id'],['program','program'],['receiptAddress','receiptAddress'],
    ['configAddress','configAddress'],['vaultAddress','vaultAddress'],['mint','mint'],
    ['depositor','depositor'],['recipientCore','recipientCore'],['holochainScope','holochainScope'],
    ['depositNonce','depositNonce'],['amountBaseUnits','amountBaseUnits'],
  ]) need(candidate[a]===observation[b],'receipt snapshot mismatch: '+a);
  need(observation.finalizedSlot >= candidate.finalizedSlot, 'receipt snapshot precedes deposit');
  need(observation.configBump===candidate.configBump &&
    observation.receiptBump===candidate.receiptBump, 'incorrect on-chain PDA bump');
  return Object.freeze({
    ...candidate, kind:'solana-deposit-evidence-v1', receiptSnapshot:observation,
    observationSlot:observation.finalizedSlot, refundedAtObservation:observation.refunded,
    evidenceTrust:'rpc_finalized_transaction_and_later_account_snapshot',
    limitations:Object.freeze([
      'RPC-finalized is a provider assertion, not independent consensus verification',
      'Account snapshot is later than or equal to creation slot, not historical post-state',
      'Deposits remain refundable; collateral is not economically final',
      'Program upgrades, archival completeness and all Holochain fork rules are not proved',
    ]),
    creditEligible:false,
  });
}
