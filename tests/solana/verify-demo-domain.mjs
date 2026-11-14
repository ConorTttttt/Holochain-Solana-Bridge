// Verify the actual post-execution SOL domain handoff. Only public
// finalized localhost RPC claims and ORIGINAL signed submitted bytes are
// accepted; this does NOT authenticate independent Solana consensus/history.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Transaction } from '@solana/web3.js';
import { decodeConfig, decodeReceipt, decodeTokenAccount } from '../../observer/src/decode.mjs';
import { assertDemoDomainShape } from './demo-scope.mjs';

const dir = process.env.DEMO_WITNESS_DIR ?? 'target/localnet-evidence';
const readJson = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
const digest = (name) => createHash('sha256').update(readFileSync(name)).digest('hex');
const d = readJson('demo-source-domain.json');
assertDemoDomainShape(d);
const idl = JSON.parse(readFileSync('target/idl/deposit_prototype.json', 'utf8'));
assert.equal(d.programId, idl.address, 'manifest program is not actual generated IDL');
assert.equal(d.sourceCommitSha,
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  'manifest source is not this checkout');
assert.equal(d.idlSha256, digest('target/idl/deposit_prototype.json'),
  'generated IDL changed');
assert.equal(d.elfSha256, digest('target/deploy/deposit_prototype.so'),
  'deployed ELF artifact changed');
assert.equal(d.postSyncSourceSha256, digest(join(dir, 'tracked-post-sync.sha256')),
  'post anchor-keys-sync tracked source digest changed');

const bundle = readJson(d.witnessBundle);
assert.equal(bundle.complete, true, 'source domain contains incomplete witness archive');
assert.equal(bundle.mode, d.mode);
for (const k of ['genesisHash', 'programId', 'sourceCommitSha', 'idlSha256',
  'elfSha256', 'postSyncSourceSha256']) {
  assert.equal(bundle[k], d[k], 'original wire archive differs from domain: ' + k);
}

const instruction = (tx, name) => {
  assert.equal(tx.instructions.length, 1, name + ': unexpected extra instructions');
  assert.equal(tx.instructions[0].programId.toBase58(), d.programId,
    name + ': signed compiled program differs');
  const definition = idl.instructions.find(i => i.name === name);
  assert.ok(definition && Array.isArray(definition.discriminator) &&
    definition.discriminator.length === 8, 'missing generated instruction IDL: ' + name);
  const data = tx.instructions[0].data;
  assert.deepEqual(data.subarray(0, 8), Buffer.from(definition.discriminator),
    name + ': signed instruction discriminator differs');
  return data.subarray(8);
};
function verifyOriginal(stage, name) {
  const claim = d.transactions[stage];
  const witness = bundle.finalized.find(w => w.signature === claim.signature);
  assert.ok(witness, stage + ': original finalized signed witness missing');
  for (const k of ['slot', 'getTransactionRawFile', 'getTransactionBase64RawFile',
    'getBlockRawFile', 'getBlockBase64RawFile']) {
    assert.equal(claim[k], witness[k], stage + ': witness pointer changed: ' + k);
  }
  assert.equal(witness.meta.err, null, stage + ': claimed successful transaction rejected');
  const submissions = bundle.transactions
    .filter(row => row.signature === claim.signature && typeof row.signedWireBase64 === 'string');
  assert.ok(submissions.length > 0, stage + ': no original submitted wire');
  const wire = submissions[0].signedWireBase64;
  assert.ok(submissions.every(row => row.signedWireBase64 === wire),
    stage + ': contradictory original submitted wire');
  const original = Buffer.from(wire, 'base64');
  assert.equal(original.toString('base64'), wire, stage + ': noncanonical original wire');
  const txRpc = readJson(witness.getTransactionBase64RawFile).result;
  assert.equal(txRpc.transaction?.[0], wire, stage + ': signed getTransaction differs');
  assert.equal(txRpc.transaction?.[1], 'base64');
  assert.equal(txRpc.slot, witness.slot, stage + ': transaction slot differs');
  assert.equal(txRpc.meta?.err, null, stage + ': original RPC execution rejected');
  const blockRpc = readJson(witness.getBlockBase64RawFile).result;
  assert.equal(blockRpc.blockhash, witness.blockhash, stage + ': containing blockhash changed');
  assert.ok(blockRpc.transactions.some(item =>
    item.transaction?.[0] === wire && item.transaction?.[1] === 'base64' &&
    item.meta?.err === null), stage + ': original wire missing from containing block');
  const tx = Transaction.from(original);
  assert.ok(tx.verifySignatures(), stage + ': original Ed25519 signatures invalid');
  assert.equal(tx.feePayer?.toBase58(), d.depositor, stage + ': fee payer differs');
  return instruction(tx, name);
}

// Original signed instructions independently prove WHICH scope/nonce/amount
// the local validator reported executing, rather than trusting a later
// account snapshot or test-generated JSON metadata alone.
const initData = verifyOriginal('initialize', 'initialize');
assert.equal(initData.toString('hex'), d.scopeHex,
  'signed initialize instruction does not contain this exact scope');
const depositData = verifyOriginal('deposit', 'deposit');
assert.equal(depositData.length, 48, 'unexpected deposit instruction ABI');
assert.equal(depositData.readBigUInt64LE(0).toString(), d.nonce, 'signed nonce differs');
assert.equal(depositData.subarray(8, 40).toString('hex'), d.recipientCoreHex,
  'signed recipient differs');
assert.equal(depositData.readBigUInt64LE(40).toString(), d.amountBaseUnits,
  'signed exact u64 deposit amount differs');
const refundData = verifyOriginal('refund', 'refund');
assert.equal(refundData.length, 0, 'unexpected refund instruction ABI');

function verifySnapshot(name, expectedRefunded) {
  const snap = readJson(name);
  assert.equal(snap.kind, 'localnet-finalized-rpc-account-snapshot-not-consensus-proof');
  assert.equal(snap.genesisHash, d.genesisHash);
  for (const k of ['programId', 'sourceCommitSha', 'idlSha256',
    'elfSha256', 'postSyncSourceSha256']) assert.equal(snap[k], d[k], name + ': ' + k);
  assert.deepEqual(snap.accounts.map(a => a.address),
    [d.receipt, d.config, d.vault, d.mint], name + ': wrong snapshot account order');
  assert.equal(snap.signatures.initialize, d.transactions.initialize.signature);
  assert.equal(snap.signatures.deposit, d.transactions.deposit.signature);
  if (expectedRefunded) assert.equal(snap.signatures.refund, d.transactions.refund.signature);
  else assert.ok(!Object.hasOwn(snap.signatures, 'refund'),
    'active snapshot must precede the actual refund');
  assert.ok(Number.isSafeInteger(snap.slot) && snap.slot >=
    d.transactions[expectedRefunded ? 'refund' : 'deposit'].slot,
    name + ': account state snapshot predates transaction');
  assert.match(snap.getMultipleAccountsRawFile, /^[a-zA-Z0-9-]+\.rpc\.json$/);
  const rawRpc = readJson(snap.getMultipleAccountsRawFile).result;
  assert.ok(Array.isArray(rawRpc?.value) && rawRpc.value.length === 4,
    name + ': original raw RPC account snapshot missing');
  for (let i = 0; i < 4; i++) {
    const stored = snap.accounts[i], original = rawRpc.value[i];
    assert.equal(stored.dataBase64, original?.data?.[0],
      name + ': stored account differs from raw original RPC');
    assert.equal(stored.owner, original?.owner,
      name + ': account owner differs from original RPC');
    assert.equal(original?.data?.[1], 'base64');
  }
  const [receipt, cfg, vault, mint] = snap.accounts;
  assert.equal(receipt.owner, d.programId, name + ': invalid receipt owner');
  assert.equal(cfg.owner, d.programId, name + ': invalid config owner');
  assert.equal(vault.owner, 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    name + ': nonclassic token vault');
  assert.equal(mint.owner, 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    name + ': nonclassic token mint');
  const parsedReceipt = decodeReceipt(Buffer.from(receipt.dataBase64, 'base64'));
  const parsedConfig = decodeConfig(Buffer.from(cfg.dataBase64, 'base64'));
  const parsedVault = decodeTokenAccount(Buffer.from(vault.dataBase64, 'base64'));
  for (const [k, v] of Object.entries({
    depositor: d.depositor, mint: d.mint, config: d.config, vault: d.vault,
    scope: d.scopeHex, nonce: d.nonce, amount: d.amountBaseUnits,
    recipientCore: d.recipientCoreHex, refunded: expectedRefunded,
  })) assert.equal(parsedReceipt[k], v, name + ': inconsistent executed receipt: ' + k);
  assert.equal(parsedConfig.admin, d.depositor, name + ': config authority differs');
  assert.equal(parsedConfig.mint, d.mint, name + ': config mint differs');
  assert.equal(parsedConfig.scope, d.initializedScopeHex, name + ': real initialized scope differs');
  assert.equal(parsedConfig.totalActive, expectedRefunded ? '0' : d.amountBaseUnits,
    name + ': liability differs');
  assert.equal(parsedVault.mint, d.mint, name + ': vault mint differs');
  assert.equal(parsedVault.authority, d.config, name + ': vault PDA authority differs');
  assert.equal(parsedVault.hasDelegate, false);
  assert.equal(parsedVault.hasCloseAuthority, false);
  assert.equal(parsedVault.amount, expectedRefunded ? '0' : d.amountBaseUnits,
    name + ': vault amount differs');
  const mintRaw = Buffer.from(mint.dataBase64, 'base64');
  assert.equal(mintRaw.length, 82, 'classic SPL Mint expected');
  assert.equal(mintRaw[44], 6, 'unexpected SPL decimals');
  assert.equal(mintRaw[45], 1, 'SPL mint not initialized');
  assert.equal(mintRaw.readUInt32LE(46), 0, 'freeze authority must be absent');
}
verifySnapshot(d.snapshots.active, false);
verifySnapshot(d.snapshots.refunded, true);
console.log('DEMO_SOURCE_DOMAIN_VERIFIED original signed initialization/deposit/refund, ' +
  'actual localnet scope, classic SPL mint, original RPC snapshots; ' +
  'historyComplete=false independentConsensusVerified=false ' +
  'creditEligible=false spendableBaseUnits=0 withdrawalAuthorized=false');
