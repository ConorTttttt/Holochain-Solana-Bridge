/**
 * Anchor 1.2.2 local-validator integration test. NOT an offline simulation.
 * Only executable after anchor keys sync, anchor build and a localnet deployment.
 * No public RPC or real-value tokens.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import BN from 'bn.js';
import { Program } from '@anchor-lang/core';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createAccount, createMint, getAccount, mintTo } from '@solana/spl-token';

const RPC = 'http://127.0.0.1:8899'; // Never accept an externally supplied RPC URL.
const connection = new Connection(RPC, 'confirmed');
const idl = JSON.parse(readFileSync(new URL('../../target/idl/deposit_prototype.json', import.meta.url), 'utf8'));
const programId = new PublicKey(idl.address);
const program = new Program(idl, { connection });
const scope = Array(32).fill(7);
const recipient = Array(32).fill(9);
const nonce = new BN('42017');
const amount = 250_000n;
// Evidence files contain only public keys and publicly readable Solana account
// bytes. Never serialize, log or upload payer/depositor private keypairs.
async function capturePublicAccountFixture(label, keys, signatures) {
  const result = await connection.getMultipleAccountsInfoAndContext(keys, 'finalized');
  assert.ok(result.value.every(Boolean), 'finalized evidence snapshot is missing an account');
  const fixture = {
    kind: 'localnet-finalized-rpc-account-snapshot-not-consensus-proof',
    label,
    genesisHash: await connection.getGenesisHash(),
    programId: programId.toBase58(),
    slot: result.context.slot,
    signatures,
    accounts: result.value.map((account, index) => ({
      address: keys[index].toBase58(),
      owner: account.owner.toBase58(),
      lamports: account.lamports,
      executable: account.executable,
      dataBase64: Buffer.from(account.data).toString('base64'),
    })),
  };
  const directory = new URL('../../target/localnet-evidence/', import.meta.url);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(new URL(label + '.json', directory), JSON.stringify(fixture, null, 2) + '\n', { mode: 0o600 });
  return fixture;
}

const [config, configBump] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
const vaultFor = (mint) => PublicKey.findProgramAddressSync([Buffer.from('vault'), mint.toBuffer()], programId);
const receiptFor = (owner, n) => {
  const le = Buffer.alloc(8);
  le.writeBigUInt64LE(BigInt(n.toString()));
  return PublicKey.findProgramAddressSync([Buffer.from('deposit'), owner.toBuffer(), le], programId);
};

async function send(ix, signers) {
  return sendAndConfirmTransaction(connection, new Transaction().add(ix), signers, { commitment: 'confirmed' });
}
async function fund(keypair) {
  const signature = await connection.requestAirdrop(keypair.publicKey, 3 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature, 'confirmed');
}
async function rejectsInstruction(buildIx, signers, message) {
  await assert.rejects(async () => send(await buildIx(), signers), message);
}
const same = (a, b) => assert.equal(a.toBase58(), b.toBase58());

test('localnet-only: initialize, deposit, validation failures, pause and one refund', { timeout: 180_000 }, async (t) => {
  assert.equal(new URL(RPC).hostname, '127.0.0.1');
  assert.notEqual(idl.address, 'Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS',
    'run anchor keys sync with a freshly generated LOCAL keypair');
  await connection.getVersion();
  const deployed = await connection.getAccountInfo(programId, 'confirmed');
  assert.ok(deployed?.executable, 'deploy the built program to the local validator first');
  assert.equal(await connection.getAccountInfo(config), null, 'fresh local-validator ledger required');

  const owner = Keypair.generate();
  const attacker = Keypair.generate();
  await fund(owner);
  await fund(attacker);
  const mint = await createMint(connection, owner, owner.publicKey, null, 6, undefined,
    { commitment: 'confirmed' }, TOKEN_PROGRAM_ID);
  const [vault] = vaultFor(mint);
  const source = await createAccount(connection, owner, mint, owner.publicKey);
  const strangerSource = await createAccount(connection, attacker, mint, attacker.publicKey);
  // Explicit non-ATA SPL account: the source above is already owner's ATA.
  // Recreating the same ATA fails with "Provided owner is not allowed".
  const recipientAccount = await createAccount(connection, owner, mint, owner.publicKey, Keypair.generate());
  await mintTo(connection, owner, mint, source, owner, 1_000_000n);

  const initIx = (mintKey, vaultKey, adminKey = owner.publicKey) => program.methods.initialize(scope)
    .accountsStrict({ admin: adminKey, config, mint: mintKey, vault: vaultKey,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();

  await t.test('freeze-enabled mint is rejected with atomic rollback', async () => {
    const frozenMint = await createMint(connection, owner, owner.publicKey, owner.publicKey, 6);
    await rejectsInstruction(() => initIx(frozenMint, vaultFor(frozenMint)[0]), [owner], 'freeze-enabled init must fail');
    assert.equal(await connection.getAccountInfo(config), null);
  });

  await t.test('initialize pins one classic SPL mint and PDA authority', async () => {
    await send(await initIx(mint, vault), [owner]);
    const c = await program.account.bridgeConfig.fetch(config);
    same(c.admin, owner.publicKey);
    same(c.mint, mint);
    assert.equal(Buffer.from(c.scope).toString('hex'), Buffer.from(scope).toString('hex'));
    assert.equal(c.totalActive.toString(), '0');
    assert.equal(c.bump, configBump);
    const v = await getAccount(connection, vault);
    same(v.owner, config);
    same(v.mint, mint);
    assert.equal(v.delegate, null);
    assert.equal(v.closeAuthority, null);
    await rejectsInstruction(() => initIx(mint, vault), [owner], 'second initialize must fail');
  });

  const [receipt, receiptBump] = receiptFor(owner.publicKey, nonce);
  let depositSignature; let refundSignature;
  const depositIx = ({ signer = owner.publicKey, mintKey = mint, from = source,
    vaultKey = vault, receiptKey = receipt, n = nonce, amt = amount, core = recipient } = {}) =>
    program.methods.deposit(n, core, new BN(amt.toString())).accountsStrict({
      depositor: signer, config, mint: mintKey, source: from, vault: vaultKey, receipt: receiptKey,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).instruction();
  const refundIx = ({ signer = owner.publicKey, to = recipientAccount, receiptKey = receipt } = {}) =>
    program.methods.refund().accountsStrict({
      depositor: signer, config, mint, vault, receipt: receiptKey, destination: to,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();

  await t.test('deposit creates nonce-keyed receipt and conserves base units', async () => {
    depositSignature = await send(await depositIx(), [owner]);
    await connection.confirmTransaction(depositSignature, 'finalized');
    const c = await program.account.bridgeConfig.fetch(config);
    const r = await program.account.depositReceipt.fetch(receipt);
    same(r.depositor, owner.publicKey);
    same(r.mint, mint);
    same(r.vault, vault);
    same(r.config, config);
    assert.equal(r.amount.toString(), amount.toString());
    assert.equal(r.nonce.toString(), nonce.toString());
    assert.equal(Buffer.from(r.recipientCore).toString('hex'), Buffer.from(recipient).toString('hex'));
    assert.equal(r.refunded, false);
    assert.equal(r.bump, receiptBump);
    assert.equal(c.totalActive.toString(), amount.toString());
    assert.equal((await getAccount(connection, vault)).amount, amount);
    assert.equal((await getAccount(connection, source)).amount, 1_000_000n - amount);
    await capturePublicAccountFixture('active-receipt', [receipt, config, vault, mint], { deposit: depositSignature });
  });

  await t.test('duplicate nonce, wrong signer, wrong mint and wrong source fail atomically', async () => {
    await rejectsInstruction(() => depositIx(), [owner], 'duplicate receipt nonce must fail');
    await rejectsInstruction(() => depositIx({ signer: attacker.publicKey }), [attacker], 'wrong signer/PDA must fail');
    await rejectsInstruction(() => depositIx({ from: strangerSource }), [owner], 'wrong source owner must fail');
    const otherMint = await createMint(connection, owner, owner.publicKey, null, 6);
    await rejectsInstruction(() => depositIx({ mintKey: otherMint }), [owner], 'wrong mint must fail');
    await rejectsInstruction(() => refundIx({ signer: attacker.publicKey }), [attacker], 'wrong refund signer must fail');
    await rejectsInstruction(() => refundIx({ to: strangerSource }), [owner], 'wrong refund destination must fail');
    const boundNonce = new BN('42019');
    await rejectsInstruction(
      () => depositIx({ n: boundNonce, receiptKey: receiptFor(owner.publicKey, boundNonce)[0], amt: 0n }),
      [owner], 'zero amount must fail');
    await rejectsInstruction(
      () => depositIx({ n: boundNonce, receiptKey: receiptFor(owner.publicKey, boundNonce)[0], core: Array(32).fill(0) }),
      [owner], 'zero recipient core must fail');
    await rejectsInstruction(
      () => depositIx({ n: boundNonce, receiptKey: receiptFor(owner.publicKey, boundNonce)[0], amt: (1n << 64n) - 1n }),
      [owner], 'u64 maximum beyond funded balance must fail');
    assert.equal(await connection.getAccountInfo(receiptFor(owner.publicKey, boundNonce)[0]), null,
      'failed boundary transfers must not create a receipt');

    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), amount.toString());
    assert.equal((await getAccount(connection, vault)).amount, amount);
    assert.equal((await program.account.depositReceipt.fetch(receipt)).refunded, false);
  });

  await t.test('only admin pauses; deposits halt; refund works and is once-only', async () => {
    const pauseIx = (adminKey, paused) => program.methods.setPaused(paused)
      .accountsStrict({ admin: adminKey, config }).instruction();
    await rejectsInstruction(() => pauseIx(attacker.publicKey, true), [attacker], 'wrong admin must fail');
    await send(await pauseIx(owner.publicKey, true), [owner]);
    const newNonce = new BN('42018');
    await rejectsInstruction(
      () => depositIx({ n: newNonce, receiptKey: receiptFor(owner.publicKey, newNonce)[0] }),
      [owner], 'paused deposit must fail');
    refundSignature = await send(await refundIx(), [owner]);
    await connection.confirmTransaction(refundSignature, 'finalized');
    assert.equal((await program.account.depositReceipt.fetch(receipt)).refunded, true);
    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '0');
    assert.equal((await getAccount(connection, vault)).amount, 0n);
    assert.equal((await getAccount(connection, recipientAccount)).amount, amount);
    await capturePublicAccountFixture('refunded-receipt', [receipt, config, vault, mint],
      { deposit: depositSignature, refund: refundSignature });
    await rejectsInstruction(() => refundIx(), [owner], 'second refund must fail');
    await send(await pauseIx(owner.publicKey, false), [owner]);
    await rejectsInstruction(() => depositIx(), [owner], 'nonce remains consumed after refund');
    const maxNonce = new BN('18446744073709551615');
    const [maxReceipt, maxBump] = receiptFor(owner.publicKey, maxNonce);
    await send(await depositIx({ n: maxNonce, receiptKey: maxReceipt, amt: 1n }), [owner]);
    const maxRecord = await program.account.depositReceipt.fetch(maxReceipt);
    assert.equal(maxRecord.nonce.toString(), maxNonce.toString(), 'u64 max nonce did not roundtrip');
    assert.equal(maxRecord.bump, maxBump);
    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '1');
    assert.equal((await getAccount(connection, vault)).amount, 1n);
    await send(await refundIx({ receiptKey: maxReceipt }), [owner]);
    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '0');
    assert.equal((await getAccount(connection, vault)).amount, 0n);

  });
});
