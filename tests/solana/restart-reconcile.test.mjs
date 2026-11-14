/**
 * Retained-ledger validator restart proof. Must be run through
 * restart-validator.sh against two actual solana-test-validator processes.
 * No mainnet RPC, production values, hidden private key fixtures or mocks.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import BN from 'bn.js';
import { Program } from '@anchor-lang/core';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from '@solana/spl-token';
import { decodeConfig, decodeReceipt, decodeTokenAccount } from '../../observer/src/decode.mjs';

const rpc = 'http://127.0.0.1:8899';
const connection = new Connection(rpc, 'confirmed');
const idl = JSON.parse(readFileSync(new URL('../../target/idl/deposit_prototype.json', import.meta.url), 'utf8'));
const programId = new PublicKey(idl.address);
const program = new Program(idl, { connection });
const phase = process.env.BRIDGE_RESTART_PHASE;
assert.ok(['setup', 'verify'].includes(phase), 'BRIDGE_RESTART_PHASE must be setup or verify');
const evidencePath = new URL('../../target/localnet-evidence/restart-state.json', import.meta.url);
const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
const vaultFor = (mint) => PublicKey.findProgramAddressSync([Buffer.from('vault'), mint.toBuffer()], programId)[0];
function receiptFor(owner, nonce) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(nonce.toString()));
  return PublicKey.findProgramAddressSync([Buffer.from('deposit'), owner.toBuffer(), buf], programId);
}
async function send(ix, signer) {
  return sendAndConfirmTransaction(connection, new Transaction().add(ix), [signer], { commitment: 'confirmed' });
}
async function snapshot(keys) {
  const response = await connection.getMultipleAccountsInfoAndContext(keys, 'finalized');
  assert.ok(response.value.every(Boolean), 'account disappeared at finalized commitment');
  return {
    slot: response.context.slot,
    accounts: response.value.map((account, i) => ({
      address: keys[i].toBase58(),
      owner: account.owner.toBase58(),
      lamports: account.lamports,
      dataBase64: Buffer.from(account.data).toString('base64'),
    })),
  };
}
test('persistent local validator state survives a REAL stop/restart and reconstructs all receipts',
  { timeout: 150_000 }, async () => {
    assert.equal(new URL(rpc).hostname, '127.0.0.1');
    assert.notEqual(idl.address, 'Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS');
    const deployed = await connection.getAccountInfo(programId, 'confirmed');
    assert.ok(deployed?.executable, 'must deploy compiled SBPF to actual validator');
    const genesisHash = await connection.getGenesisHash();
    if (phase === 'setup') {
      assert.equal(await connection.getAccountInfo(config), null, 'setup requires new ledger');
      const payer = Keypair.generate();
      const airdrop = await connection.requestAirdrop(payer.publicKey, 3 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdrop, 'confirmed');
      const mint = await createMint(connection, payer, payer.publicKey, null, 6);
      const source = await createAccount(connection, payer, mint, payer.publicKey);
      await mintTo(connection, payer, mint, source, payer, 20_000n);
      const vault = vaultFor(mint);
      const nonce = new BN('909000');
      const [receipt, bump] = receiptFor(payer.publicKey, nonce);
      const initIx = await program.methods.initialize(Array(32).fill(7)).accountsStrict({
        admin: payer.publicKey, config, mint, vault, tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).instruction();
      const initialized = await send(initIx, payer);
      const depIx = await program.methods.deposit(nonce, Array(32).fill(9), new BN('12345'))
        .accountsStrict({ depositor: payer.publicKey, config, mint, source, vault, receipt,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
      const deposited = await send(depIx, payer);
      await connection.confirmTransaction(deposited, 'finalized');
      assert.equal((await getAccount(connection, vault)).amount, 12_345n);
      assert.equal((await program.account.bridgeConfig.fetch(config)).totalActive.toString(), '12345');
      const before = await snapshot([config, vault, receipt, mint, source]);
      const receipts = await connection.getProgramAccounts(programId, {
        commitment: 'confirmed', filters: [{ dataSize: 218 }],
      });
      assert.equal(receipts.length, 1, 'fresh ledger must contain exactly one receipt');
      assert.equal(decodeReceipt(Buffer.from(receipts[0].account.data)).amount, '12345');
      mkdirSync(new URL('../../target/localnet-evidence/', import.meta.url), { recursive: true, mode: 0o700 });
      writeFileSync(evidencePath, JSON.stringify({
        kind: 'real-validator-persistent-ledger-not-cross-chain-finality', phase: 'before-restart',
        genesisHash, programId: programId.toBase58(), nonce: nonce.toString(), bump,
        depositor: payer.publicKey.toBase58(), signatures: { initialized, deposited },
        ...before,
      }, null, 2) + '\n', { mode: 0o600 });
    } else {
      const prior = JSON.parse(readFileSync(evidencePath, 'utf8'));
      assert.equal(prior.phase, 'before-restart');
      assert.equal(genesisHash, prior.genesisHash, 'ledger genesis changed: validator was RESET, not restarted');
      assert.equal(programId.toBase58(), prior.programId);
      const keys = prior.accounts.map((x) => new PublicKey(x.address));
      const current = await snapshot(keys);
      for (let i = 0; i < keys.length; i++) {
        assert.equal(current.accounts[i].owner, prior.accounts[i].owner, 'account owner changed');
        assert.equal(current.accounts[i].lamports, prior.accounts[i].lamports, 'account rent/lamports changed');
        assert.equal(current.accounts[i].dataBase64, prior.accounts[i].dataBase64, 'account data changed across restart');
      }
      const [rawConfig, rawVault, rawReceipt] = current.accounts.map((entry) =>
        Buffer.from(entry.dataBase64, 'base64'));
      const cfg = decodeConfig(rawConfig), tok = decodeTokenAccount(rawVault), rec = decodeReceipt(rawReceipt);
      const [expectedReceipt, bump] = receiptFor(new PublicKey(prior.depositor), new BN(prior.nonce));
      assert.equal(expectedReceipt.toBase58(), keys[2].toBase58());
      assert.equal(rec.bump, bump);
      assert.equal(rec.refunded, false);
      assert.equal(rec.nonce, prior.nonce);
      assert.equal(rec.amount, '12345');
      assert.equal(cfg.totalActive, '12345');
      assert.equal(tok.amount, '12345');
      assert.ok(BigInt(tok.amount) >= BigInt(cfg.totalActive));
      const scanned = await connection.getProgramAccounts(programId, {
        commitment: 'confirmed', filters: [{ dataSize: 218 }],
      });
      assert.equal(scanned.length, 1);
      let recovered = 0n;
      for (const item of scanned) {
        const receipt = decodeReceipt(Buffer.from(item.account.data));
        const derived = receiptFor(new PublicKey(receipt.depositor), new BN(receipt.nonce))[0];
        assert.equal(item.pubkey.toBase58(), derived.toBase58());
        if (!receipt.refunded) recovered += BigInt(receipt.amount);
      }
      assert.equal(recovered, 12_345n);
      assert.equal(recovered, BigInt(cfg.totalActive));
      const directory = new URL('../../target/localnet-evidence/', import.meta.url);
      writeFileSync(new URL('restart-after.json', directory),
        JSON.stringify({ phase: 'after-restart', genesisHash, programId: prior.programId,
          beforeSlot: prior.slot, afterSlot: current.slot, discoveredReceipts: scanned.length,
          totalActive: cfg.totalActive, vaultAmount: tok.amount }, null, 2) + '\n', { mode: 0o600 });
    }
  });
