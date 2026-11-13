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
import { BPF_LOADER_UPGRADEABLE_PROGRAM_ID, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, AuthorityType, createAccount, createMint, createMintToInstruction, createSetAuthorityInstruction, getAccount, mintTo } from '@solana/spl-token';
import { decodeConfig, decodeReceipt, decodeTokenAccount, discriminator } from '../../observer/src/decode.mjs';

const RPC = 'http://127.0.0.1:8899'; // Never accept an externally supplied RPC URL.
const connection = new Connection(RPC, 'confirmed');
const idl = JSON.parse(readFileSync(new URL('../../target/idl/deposit_prototype.json', import.meta.url), 'utf8'));
const programId = new PublicKey(idl.address);
const program = new Program(idl, { connection });
async function recordUpgradeAuthority() {
  const deployed = await connection.getAccountInfo(programId, 'confirmed');
  assert.ok(deployed?.executable, 'deployed program missing');
  same(deployed.owner, BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
  const programBytes = Buffer.from(deployed.data);
  assert.equal(programBytes.readUInt32LE(0), 2, 'unexpected upgradeable loader Program state');
  const programDataAddress = new PublicKey(programBytes.subarray(4, 36));
  const dataAccount = await connection.getAccountInfo(programDataAddress, 'confirmed');
  assert.ok(dataAccount, 'missing upgradeable ProgramData');
  same(dataAccount.owner, BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
  const data = Buffer.from(dataAccount.data);
  assert.equal(data.readUInt32LE(0), 3, 'unexpected ProgramData state');
  assert.ok(data[12] === 0 || data[12] === 1, 'noncanonical upgrade authority option');
  const upgradeAuthority = data[12] === 1 ? new PublicKey(data.subarray(13, 45)).toBase58() : null;
  transactionEvidence.push({ label: 'observed-deployment-upgrade-authority-not-governed',
    programDataAddress: programDataAddress.toBase58(), upgradeAuthority });
}
const scope = Array(32).fill(7);
const recipient = Array(32).fill(9);
const nonce = new BN('42017');
const amount = 250_000n;
const U64_MAX = (1n << 64n) - 1n;
const mode = process.env.BRIDGE_TEST_MODE ?? 'lifecycle';
assert.ok(['lifecycle', 'init-capture', 'u64-max'].includes(mode), 'unknown isolated test mode');
const transactionEvidence = [];
async function saveTransactionEvidence() {
  const directory = new URL('../../target/localnet-evidence/', import.meta.url);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(new URL('sprint1-' + mode + '-transactions.json', directory),
    JSON.stringify({ mode, genesisHash: await connection.getGenesisHash(), programId: programId.toBase58(), transactions: transactionEvidence }, null, 2) + '\n',
    { mode: 0o600 });
}
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
async function submitOnChain(ix, signers) {
  // Reject preflight-only false positives: verify actual confirmed meta.err.
  const blockhash = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: signers[0].publicKey, recentBlockhash: blockhash.blockhash }).add(ix);
  tx.sign(...signers);
  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  const confirmation = await connection.confirmTransaction({ signature, ...blockhash }, 'confirmed');
  let included;
  for (let i = 0; i < 20; i++) {
    included = await connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (included?.meta) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(included?.meta, 'transaction not included: ' + signature);
  assert.deepEqual(included.meta.err, confirmation.value.err, 'confirmation and transaction mismatch');
  assert.ok(included.meta.logMessages?.length, 'no validator execution logs');
  return { signature, error: included.meta.err, logs: included.meta.logMessages };
}
async function rejectsInstruction(buildIx, signers, message) {
  const ix = await buildIx(); // must encode successfully
  const result = await submitOnChain(ix, signers);
  assert.notEqual(result.error, null, message + ': unexpectedly succeeded');
  transactionEvidence.push({ label: message, ...result });
  return result;
}
const same = (a, b) => assert.equal(a.toBase58(), b.toBase58());

test('localnet-only: initialize, deposit, validation failures, pause and one refund', { timeout: 240_000, skip: mode !== 'lifecycle' }, async (t) => {
  assert.equal(new URL(RPC).hostname, '127.0.0.1');
  assert.notEqual(idl.address, 'Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS',
    'run anchor keys sync with a freshly generated LOCAL keypair');
  await connection.getVersion();
  const deployed = await connection.getAccountInfo(programId, 'confirmed');
  assert.ok(deployed?.executable, 'deploy the built program to the local validator first');
  await recordUpgradeAuthority();
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
  // Compare real validator account bytes with the independent OBS decoder.
  async function assertRawState(expectedTotal, expectedVault, records = []) {
    const [configInfo, vaultInfo] = await connection.getMultipleAccountsInfo([config, vault], 'confirmed');
    assert.ok(configInfo && vaultInfo, 'on-chain config/vault missing');
    same(configInfo.owner, programId);
    same(vaultInfo.owner, TOKEN_PROGRAM_ID);
    assert.equal(configInfo.data.length, 114);
    assert.equal(vaultInfo.data.length, 165);
    assert.deepEqual(Buffer.from(configInfo.data.subarray(0, 8)), discriminator('BridgeConfig'));
    const cfg = decodeConfig(Buffer.from(configInfo.data));
    const token = decodeTokenAccount(Buffer.from(vaultInfo.data));
    assert.equal(cfg.totalActive, expectedTotal.toString());
    assert.equal(cfg.bump, configBump);
    assert.equal(cfg.mint, mint.toBase58());
    assert.equal(token.amount, expectedVault.toString());
    assert.equal(token.mint, mint.toBase58());
    assert.equal(token.authority, config.toBase58());
    assert.equal(token.hasDelegate, false);
    assert.equal(token.hasCloseAuthority, false);
    assert.equal(Buffer.from(vaultInfo.data).readUInt32LE(109), 0, 'vault must not be native SOL');
    if ('isNative' in token) assert.equal(token.isNative, false);
    assert.ok(BigInt(token.amount) >= BigInt(cfg.totalActive));
    for (const { key, n, value, refunded, bump } of records) {
      same(key, receiptFor(owner.publicKey, n)[0]);
      const info = await connection.getAccountInfo(key, 'confirmed');
      assert.ok(info, 'expected receipt absent');
      same(info.owner, programId);
      assert.equal(info.data.length, 218);
      assert.deepEqual(Buffer.from(info.data.subarray(0, 8)), discriminator('DepositReceipt'));
      const decoded = decodeReceipt(Buffer.from(info.data));
      assert.equal(decoded.depositor, owner.publicKey.toBase58());
      assert.equal(decoded.mint, mint.toBase58());
      assert.equal(decoded.vault, vault.toBase58());
      assert.equal(decoded.config, config.toBase58());
      assert.equal(decoded.scope, Buffer.from(scope).toString('hex'));
      assert.equal(decoded.nonce, n.toString());
      assert.equal(decoded.amount, value.toString());
      assert.equal(decoded.refunded, refunded);
      assert.equal(decoded.bump, bump);
    }
  }

  // Rejected transactions must leave all tracked state byte-for-byte intact.
  async function rejectsUnchanged(buildIx, signers, label) {
    const tracked = [config, vault, receipt];
    const before = await connection.getMultipleAccountsInfo(tracked, 'confirmed');
    await rejectsInstruction(buildIx, signers, label);
    const after = await connection.getMultipleAccountsInfo(tracked, 'confirmed');
    for (let i = 0; i < tracked.length; i++) {
      assert.deepEqual(after[i]?.data, before[i]?.data, label + ': account data changed');
      assert.equal(after[i]?.lamports, before[i]?.lamports, label + ': account lamports changed');
    }
  }

  let depositSignature; let refundSignature;
  const depositIx = ({ signer = owner.publicKey, mintKey = mint, from = source,
    vaultKey = vault, receiptKey = receipt, n = nonce, amt = amount, core = recipient, tokenProg = TOKEN_PROGRAM_ID } = {}) =>
    program.methods.deposit(n, core, new BN(amt.toString())).accountsStrict({
      depositor: signer, config, mint: mintKey, source: from, vault: vaultKey, receipt: receiptKey,
      tokenProgram: tokenProg, systemProgram: SystemProgram.programId,
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
    await assertRawState(amount, amount, [{ key: receipt, n: nonce, value: amount, refunded: false, bump: receiptBump }]);
    await capturePublicAccountFixture('active-receipt', [receipt, config, vault, mint], { deposit: depositSignature });
  });

  await t.test('duplicate nonce, wrong signer, wrong mint and wrong source fail atomically', async () => {
    await rejectsUnchanged(() => depositIx(), [owner], 'duplicate receipt nonce must fail');
    await rejectsUnchanged(() => depositIx({ signer: attacker.publicKey }), [attacker], 'wrong signer/PDA must fail');
    await rejectsUnchanged(() => depositIx({ from: strangerSource }), [owner], 'wrong source owner must fail');
    const otherMint = await createMint(connection, owner, owner.publicKey, null, 6);
    await rejectsUnchanged(() => depositIx({ mintKey: otherMint }), [owner], 'wrong mint must fail');
    await rejectsUnchanged(() => refundIx({ signer: attacker.publicKey }), [attacker], 'wrong refund signer must fail');
    await rejectsUnchanged(() => refundIx({ to: strangerSource }), [owner], 'wrong refund destination must fail');
    await rejectsUnchanged(() => depositIx({ vaultKey: source }), [owner], 'substituted vault must fail');
    const boundNonce = new BN('42019');
    await rejectsUnchanged(
      () => depositIx({ n: boundNonce, receiptKey: receiptFor(owner.publicKey, boundNonce)[0], amt: 0n }),
      [owner], 'zero amount must fail');
    await rejectsUnchanged(
      () => depositIx({ n: boundNonce, receiptKey: receiptFor(owner.publicKey, boundNonce)[0], core: Array(32).fill(0) }),
      [owner], 'zero recipient core must fail');
    await rejectsUnchanged(
      () => depositIx({ n: boundNonce, receiptKey: receiptFor(owner.publicKey, boundNonce)[0], amt: (1n << 64n) - 1n }),
      [owner], 'u64 maximum beyond funded balance must fail');
    assert.equal(await connection.getAccountInfo(receiptFor(owner.publicKey, boundNonce)[0]), null,
      'failed boundary transfers must not create a receipt');

    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), amount.toString());
    assert.equal((await getAccount(connection, vault)).amount, amount);
    assert.equal((await program.account.depositReceipt.fetch(receipt)).refunded, false);
    await assertRawState(amount, amount, [{ key: receipt, n: nonce, value: amount, refunded: false, bump: receiptBump }]);
  });

  await t.test('only admin pauses; deposits halt; refund works and is once-only', async () => {
    const pauseIx = (adminKey, paused) => program.methods.setPaused(paused)
      .accountsStrict({ admin: adminKey, config }).instruction();
    await rejectsUnchanged(() => pauseIx(attacker.publicKey, true), [attacker], 'wrong admin must fail');
    await send(await pauseIx(owner.publicKey, true), [owner]);
    const newNonce = new BN('42018');
    await rejectsUnchanged(
      () => depositIx({ n: newNonce, receiptKey: receiptFor(owner.publicKey, newNonce)[0] }),
      [owner], 'paused deposit must fail');
    refundSignature = await send(await refundIx(), [owner]);
    await connection.confirmTransaction(refundSignature, 'finalized');
    assert.equal((await program.account.depositReceipt.fetch(receipt)).refunded, true);
    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '0');
    assert.equal((await getAccount(connection, vault)).amount, 0n);
    assert.equal((await getAccount(connection, recipientAccount)).amount, amount);
    await assertRawState(0n, 0n, [{ key: receipt, n: nonce, value: amount, refunded: true, bump: receiptBump }]);
    await capturePublicAccountFixture('refunded-receipt', [receipt, config, vault, mint],
      { deposit: depositSignature, refund: refundSignature });
    await rejectsUnchanged(() => refundIx(), [owner], 'second refund must fail');
    await send(await pauseIx(owner.publicKey, false), [owner]);
    await rejectsUnchanged(() => depositIx(), [owner], 'nonce remains consumed after refund');
    const maxNonce = new BN('18446744073709551615');
    const [maxReceipt, maxBump] = receiptFor(owner.publicKey, maxNonce);
    await send(await depositIx({ n: maxNonce, receiptKey: maxReceipt, amt: 1n }), [owner]);
    const maxRecord = await program.account.depositReceipt.fetch(maxReceipt);
    assert.equal(maxRecord.nonce.toString(), maxNonce.toString(), 'u64 max nonce did not roundtrip');
    assert.equal(maxRecord.bump, maxBump);
    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '1');
    assert.equal((await getAccount(connection, vault)).amount, 1n);
    await assertRawState(1n, 1n, [{ key: maxReceipt, n: maxNonce, value: 1n, refunded: false, bump: maxBump }]);
    await send(await refundIx({ receiptKey: maxReceipt }), [owner]);
    assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '0');
    assert.equal((await getAccount(connection, vault)).amount, 0n);
    await assertRawState(0n, 0n, [{ key: maxReceipt, n: maxNonce, value: 1n, refunded: true, bump: maxBump }]);

    // Verify additive accounting for two simultaneously live receipts, and
    // partial refunds, not only the single-receipt happy path.
    const nA = new BN('42020'); const nB = new BN('42021');
    const [receiptA, bumpA] = receiptFor(owner.publicKey, nA);
    const [receiptB, bumpB] = receiptFor(owner.publicKey, nB);
    await send(await depositIx({ n: nA, receiptKey: receiptA, amt: 15_000n }), [owner]);
    const secondDepositSig = await send(await depositIx({ n: nB, receiptKey: receiptB, amt: 9_000n }), [owner]);
    await connection.confirmTransaction(secondDepositSig, 'finalized');
    await assertRawState(24_000n, 24_000n, [
      { key: receiptA, n: nA, value: 15_000n, refunded: false, bump: bumpA },
      { key: receiptB, n: nB, value: 9_000n, refunded: false, bump: bumpB },
    ]);
    await capturePublicAccountFixture('two-active-receipts', [receiptA, receiptB, config, vault, mint], {});
    await send(await refundIx({ receiptKey: receiptA }), [owner]);
    await assertRawState(9_000n, 9_000n, [
      { key: receiptA, n: nA, value: 15_000n, refunded: true, bump: bumpA },
      { key: receiptB, n: nB, value: 9_000n, refunded: false, bump: bumpB },
    ]);
    await rejectsUnchanged(() => refundIx({ receiptKey: receiptA }), [owner], 'double refund must fail');
    const finalRefundSig = await send(await refundIx({ receiptKey: receiptB }), [owner]);
    await connection.confirmTransaction(finalRefundSig, 'finalized');
    await assertRawState(0n, 0n, [
      { key: receiptA, n: nA, value: 15_000n, refunded: true, bump: bumpA },
      { key: receiptB, n: nB, value: 9_000n, refunded: true, bump: bumpB },
    ]);
    await capturePublicAccountFixture('two-refunded-receipts', [receiptA, receiptB, config, vault, mint], {});
  });
  await t.test('independent wallet accounting, concurrent deposits, rollback and authority attacks', async () => {
    await mintTo(connection, owner, mint, strangerSource, owner, 300_000n);
    const tracked = [
      { who: owner.publicKey, n: nonce, amount, refunded: true },
      { who: owner.publicKey, n: new BN(U64_MAX.toString()), amount: 1n, refunded: true },
      { who: owner.publicKey, n: new BN('42020'), amount: 15_000n, refunded: true },
      { who: owner.publicKey, n: new BN('42021'), amount: 9_000n, refunded: true },
    ];
    let sourceBalance = (await getAccount(connection, source)).amount;
    let strangerBalance = (await getAccount(connection, strangerSource)).amount;
    async function reconcile(label) {
      const [rawConfig, rawVault] = await connection.getMultipleAccountsInfo([config, vault], 'confirmed');
      assert.ok(rawConfig && rawVault, label + ': missing custody accounts');
      assert.equal(rawConfig.data.length, 114);
      assert.equal(rawVault.data.length, 165);
      const decodedConfig = decodeConfig(Buffer.from(rawConfig.data));
      const decodedVault = decodeTokenAccount(Buffer.from(rawVault.data));
      same(rawVault.owner, TOKEN_PROGRAM_ID);
      assert.equal(decodedVault.mint, mint.toBase58());
      assert.equal(decodedVault.authority, config.toBase58());
      assert.equal(decodedVault.hasDelegate, false);
      assert.equal(decodedVault.hasCloseAuthority, false);
      assert.equal(Buffer.from(rawVault.data).readUInt32LE(109), 0, 'wrapped/native vault rejected');
      let expectedLiabilities = 0n;
      for (const record of tracked) {
        const [address, bump] = receiptFor(record.who, record.n);
        const raw = await connection.getAccountInfo(address, 'confirmed');
        assert.ok(raw, label + ': missing receipt ' + address.toBase58());
        same(raw.owner, programId);
        const decoded = decodeReceipt(Buffer.from(raw.data));
        assert.equal(decoded.depositor, record.who.toBase58());
        assert.equal(decoded.nonce, record.n.toString());
        assert.equal(decoded.amount, record.amount.toString());
        assert.equal(decoded.refunded, record.refunded);
        assert.equal(decoded.bump, bump);
        assert.equal(decoded.config, config.toBase58());
        assert.equal(decoded.vault, vault.toBase58());
        assert.equal(decoded.mint, mint.toBase58());
        if (!record.refunded) expectedLiabilities += record.amount;
      }
      assert.equal(BigInt(decodedConfig.totalActive), expectedLiabilities, label + ': active receipt total');
      assert.equal(BigInt(decodedVault.amount), expectedLiabilities, label + ': vault balance');
      assert.ok(BigInt(decodedVault.amount) >= BigInt(decodedConfig.totalActive), label + ': insolvency');
      assert.equal((await getAccount(connection, source)).amount, sourceBalance, label + ': owner source');
      assert.equal((await getAccount(connection, strangerSource)).amount, strangerBalance, label + ': second source');
    }
    async function rejectedWithoutChanges(label, instruction, signers, extra = []) {
      const keys = [config, vault, source, strangerSource, ...extra];
      const before = await connection.getMultipleAccountsInfo(keys, 'confirmed');
      await rejectsInstruction(() => Promise.resolve(instruction), signers, label);
      const after = await connection.getMultipleAccountsInfo(keys, 'confirmed');
      for (let i = 0; i < keys.length; i++) {
        assert.deepEqual(after[i]?.data, before[i]?.data, label + ': changed account data');
        assert.equal(after[i]?.lamports, before[i]?.lamports, label + ': changed account rent');
      }
    }
    await reconcile('after funding second wallet');
    const n1 = new BN('60001'), n2 = new BN('60002');
    const [r1] = receiptFor(owner.publicKey, n1), [r2] = receiptFor(attacker.publicKey, n2);
    const concurrent = await Promise.all([
      submitOnChain(await depositIx({ n: n1, receiptKey: r1, amt: 13_000n }), [owner]),
      submitOnChain(await depositIx({
        signer: attacker.publicKey, from: strangerSource, n: n2, receiptKey: r2, amt: 17_000n,
      }), [attacker]),
    ]);
    for (let i = 0; i < concurrent.length; i++) {
      assert.equal(concurrent[i].error, null, 'different-wallet simultaneous deposit rejected');
      transactionEvidence.push({ label: 'parallel-valid-deposit-' + i, ...concurrent[i] });
    }
    tracked.push({ who: owner.publicKey, n: n1, amount: 13_000n, refunded: false });
    tracked.push({ who: attacker.publicKey, n: n2, amount: 17_000n, refunded: false });
    sourceBalance -= 13_000n; strangerBalance -= 17_000n;
    await reconcile('two independent wallets with active deposits');
    await connection.confirmTransaction(concurrent[1].signature, 'finalized');
    await capturePublicAccountFixture('sprint1-two-wallets-live', [r1, r2, config, vault, mint],
      { ownerDeposit: concurrent[0].signature, strangerDeposit: concurrent[1].signature });

    const failedNonce = new BN('60003'), [failedReceipt] = receiptFor(owner.publicKey, failedNonce);
    await rejectedWithoutChanges('failed SPL transfer rolls back receipt init',
      await depositIx({ n: failedNonce, receiptKey: failedReceipt, amt: sourceBalance + 1n }),
      [owner], [failedReceipt]);
    await rejectedWithoutChanges('incorrect vault account rejected',
      await depositIx({ n: failedNonce, receiptKey: failedReceipt, vaultKey: source, amt: 1n }),
      [owner], [failedReceipt]);
    await rejectedWithoutChanges('token-program substitution rejected',
      await depositIx({ n: failedNonce, receiptKey: failedReceipt, tokenProg: SystemProgram.programId, amt: 1n }),
      [owner], [failedReceipt]);
    await rejectedWithoutChanges('unauthorized admin configuration update',
      await program.methods.setPaused(true).accountsStrict({ admin: attacker.publicKey, config }).instruction(),
      [attacker], [r1, r2]);
    await rejectedWithoutChanges('unauthorized mintTo rejected',
      createMintToInstruction(mint, strangerSource, attacker.publicKey, 1n), [attacker], [mint]);
    await rejectedWithoutChanges('mint authority reassignment by non-authority rejected',
      createSetAuthorityInstruction(mint, attacker.publicKey, AuthorityType.MintTokens, attacker.publicKey),
      [attacker], [mint]);
    await rejectedWithoutChanges('freeze authority cannot be reinstated after mint has none',
      createSetAuthorityInstruction(mint, owner.publicKey, AuthorityType.FreezeAccount, attacker.publicKey),
      [owner], [mint]);
    await rejectedWithoutChanges('unauthorized vault authority rotation rejected',
      createSetAuthorityInstruction(vault, attacker.publicKey, AuthorityType.AccountOwner, attacker.publicKey),
      [attacker], [vault]);
    await reconcile('after attempted CPI rollback and authority substitution');

    const partSignature = await send(await refundIx({ receiptKey: r1 }), [owner]);
    transactionEvidence.push({ label: 'partial-aggregate-refund', signature: partSignature, error: null });
    tracked.find((x) => x.n.eq(n1)).refunded = true;
    await reconcile('one of two wallet deposits refunded');
    const strangerDestination = await createAccount(connection, attacker, mint, attacker.publicKey, Keypair.generate());
    const otherSignature = await send(await refundIx({
      signer: attacker.publicKey, to: strangerDestination, receiptKey: r2,
    }), [attacker]);
    transactionEvidence.push({ label: 'second-wallet-refund', signature: otherSignature, error: null });
    tracked.find((x) => x.n.eq(n2)).refunded = true;
    await reconcile('second wallet refunded');
    assert.equal((await getAccount(connection, strangerDestination)).amount, 17_000n);

    const raceNonce = new BN('60004'), [raceReceipt] = receiptFor(owner.publicKey, raceNonce);
    const sameNonceRace = await Promise.all([
      submitOnChain(await depositIx({ n: raceNonce, receiptKey: raceReceipt, amt: 73n }), [owner]),
      submitOnChain(await depositIx({ n: raceNonce, receiptKey: raceReceipt, amt: 74n }), [owner]),
    ]);
    assert.equal(sameNonceRace.filter((x) => x.error === null).length, 1,
      'same nonce race must have exactly one success');
    assert.equal(sameNonceRace.filter((x) => x.error !== null).length, 1,
      'duplicate nonce must be rejected by the validator');
    sameNonceRace.forEach((outcome, i) =>
      transactionEvidence.push({ label: 'same-wallet-duplicate-nonce-race-' + i, ...outcome }));
    const wonAmount = sameNonceRace[0].error === null ? 73n : 74n;
    tracked.push({ who: owner.publicKey, n: raceNonce, amount: wonAmount, refunded: false });
    sourceBalance -= wonAmount;
    await reconcile('exactly one racing nonce receipt remains active');
    await rejectedWithoutChanges('reusing racing receipt rejected',
      await depositIx({ n: raceNonce, receiptKey: raceReceipt, amt: 1n }), [owner], [raceReceipt]);
    const raceRefundSignature = await send(await refundIx({ receiptKey: raceReceipt }), [owner]);
    transactionEvidence.push({ label: 'race-winner-refund', signature: raceRefundSignature, error: null });
    tracked.find((x) => x.n.eq(raceNonce)).refunded = true;
    await reconcile('all competing deposits refunded');
    await saveTransactionEvidence();
  });

});

test('isolated first-initializer capture attack (not safe for public deployment)', {
  timeout: 150_000, skip: mode !== 'init-capture'
}, async () => {
  assert.ok((await connection.getAccountInfo(programId))?.executable, 'real deployed SBPF required');
  assert.equal(await connection.getAccountInfo(config), null, 'must use fresh isolated validator');
  const operator = Keypair.generate(), attacker = Keypair.generate();
  await fund(operator); await fund(attacker);
  const maliciousMint = await createMint(connection, attacker, attacker.publicKey, null, 6);
  const operatorMint = await createMint(connection, operator, operator.publicKey, null, 6);
  const maliciousScope = Array(32).fill(42);
  const firstIx = await program.methods.initialize(maliciousScope).accountsStrict({
    admin: attacker.publicKey, config, mint: maliciousMint, vault: vaultFor(maliciousMint)[0],
    tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }).instruction();
  const captureSignature = await send(firstIx, [attacker]);
  transactionEvidence.push({ label: 'first-caller-can-seize-configuration', signature: captureSignature, error: null });
  const captured = await program.account.bridgeConfig.fetch(config);
  same(captured.admin, attacker.publicKey);
  same(captured.mint, maliciousMint);
  assert.deepEqual([...captured.scope], maliciousScope);
  const operatorInitIx = await program.methods.initialize(scope).accountsStrict({
    admin: operator.publicKey, config, mint: operatorMint, vault: vaultFor(operatorMint)[0],
    tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }).instruction();
  await rejectsInstruction(() => Promise.resolve(operatorInitIx), [operator],
    'authorized operator cannot initialize after attacker captured singleton');
  const operatorPauseIx = await program.methods.setPaused(true).accountsStrict({
    admin: operator.publicKey, config,
  }).instruction();
  await rejectsInstruction(() => Promise.resolve(operatorPauseIx), [operator],
    'operator cannot pause attacker-controlled config');
  const attackerPause = await program.methods.setPaused(true).accountsStrict({
    admin: attacker.publicKey, config,
  }).instruction();
  const pauseSignature = await send(attackerPause, [attacker]);
  transactionEvidence.push({ label: 'attacker-can-update-captured-config', signature: pauseSignature, error: null });
  assert.equal((await program.account.bridgeConfig.fetch(config)).paused, true);
  await connection.confirmTransaction(pauseSignature, 'finalized');
  await capturePublicAccountFixture('sprint1-initializer-capture',
    [config, vaultFor(maliciousMint)[0], maliciousMint],
    { capture: captureSignature, attackerPause: pauseSignature });
  await saveTransactionEvidence();
});

test('isolated maximum u64 deposit, nonce and refund with exact on-chain bytes', {
  timeout: 150_000, skip: mode !== 'u64-max'
}, async () => {
  assert.ok((await connection.getAccountInfo(programId))?.executable, 'real deployed SBPF required');
  assert.equal(await connection.getAccountInfo(config), null, 'must use fresh isolated validator');
  const admin = Keypair.generate();
  await fund(admin);
  const mint = await createMint(connection, admin, admin.publicKey, null, 6);
  const source = await createAccount(connection, admin, mint, admin.publicKey);
  const destination = await createAccount(connection, admin, mint, admin.publicKey, Keypair.generate());
  const [vault] = vaultFor(mint);
  const maxNonce = new BN(U64_MAX.toString()), [receipt, bump] = receiptFor(admin.publicKey, maxNonce);
  await mintTo(connection, admin, mint, source, admin, U64_MAX);
  const initIx = await program.methods.initialize(scope).accountsStrict({
    admin: admin.publicKey, config, mint, vault, tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).instruction();
  const initSignature = await send(initIx, [admin]);
  transactionEvidence.push({ label: 'u64-init', signature: initSignature, error: null });
  const depositIx = await program.methods.deposit(maxNonce, recipient, new BN(U64_MAX.toString()))
    .accountsStrict({ depositor: admin.publicKey, config, mint, source, vault, receipt,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
  const depositSignature = await send(depositIx, [admin]);
  transactionEvidence.push({ label: 'u64-max-deposit', signature: depositSignature, error: null });
  const [cfgRaw, vaultRaw, receiptRaw] = await connection.getMultipleAccountsInfo([config, vault, receipt]);
  assert.equal(decodeConfig(Buffer.from(cfgRaw.data)).totalActive, U64_MAX.toString());
  assert.equal(decodeTokenAccount(Buffer.from(vaultRaw.data)).amount, U64_MAX.toString());
  assert.equal(decodeReceipt(Buffer.from(receiptRaw.data)).nonce, U64_MAX.toString());
  assert.equal(decodeReceipt(Buffer.from(receiptRaw.data)).amount, U64_MAX.toString());
  assert.equal(decodeReceipt(Buffer.from(receiptRaw.data)).bump, bump);
  assert.equal(decodeReceipt(Buffer.from(receiptRaw.data)).refunded, false);
  assert.equal((await getAccount(connection, source)).amount, 0n);
  assert.equal((await getAccount(connection, vault)).amount, U64_MAX);
  await rejectsInstruction(() => Promise.resolve(createMintToInstruction(mint, source, admin.publicKey, 1n)),
    [admin], 'mint supply increment beyond u64 max must fail');
  assert.equal((await getAccount(connection, vault)).amount, U64_MAX);
  assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), U64_MAX.toString());
  const refundIx = await program.methods.refund().accountsStrict({
    depositor: admin.publicKey, config, mint, vault, receipt, destination, tokenProgram: TOKEN_PROGRAM_ID,
  }).instruction();
  const refundSignature = await send(refundIx, [admin]);
  transactionEvidence.push({ label: 'u64-max-refund', signature: refundSignature, error: null });
  assert.equal((await getAccount(connection, vault)).amount, 0n);
  assert.equal((await getAccount(connection, destination)).amount, U64_MAX);
  assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '0');
  assert.equal((await program.account.depositReceipt.fetch(receipt)).refunded, true);
  await rejectsInstruction(() => Promise.resolve(refundIx), [admin],
    'repeated full-u64 refund must not underflow total_active');
  assert.equal((await getAccount(connection, vault)).amount, 0n);
  assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '0');
  await connection.confirmTransaction(refundSignature, 'finalized');
  await capturePublicAccountFixture('sprint1-u64-refunded', [receipt, config, vault, mint],
    { deposit: depositSignature, refund: refundSignature });
  await saveTransactionEvidence();
});
