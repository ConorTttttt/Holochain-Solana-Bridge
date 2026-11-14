import test from 'node:test';
import assert from 'node:assert/strict';
import { addressBytes, decode58, discriminator, encode58 } from '../src/decode.mjs';
import { deriveBridgeAddresses } from '../src/pda.mjs';
import { CLASSIC_TOKEN_PROGRAM, assertUniqueObservations, observeRpc, reconcileObservations, verifySnapshot } from '../src/verify.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const pub = x => encode58(Buffer.alloc(32, x));
const a = {
  program: 'Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS',
  mint: pub(5), depositor: pub(6), admin: pub(7),
  recipient: Buffer.alloc(32, 8), scope: Buffer.alloc(32, 9), genesis: pub(10),
};
const p = await deriveBridgeAddresses({program: a.program, mint: a.mint, depositor: a.depositor, nonce: 42n});
const expected = { program: a.program, receipt: p.receipt, config: p.config, vault: p.vault, mint: a.mint, scope: a.scope.toString('hex') };

function putKey(bytes, pos, key) { addressBytes(key).copy(bytes, pos); }
function config({paused = false, active = 100n, scope = a.scope, bump = p.configBump, admin = a.admin} = {}) {
  const b = Buffer.alloc(114);
  discriminator('BridgeConfig').copy(b);
  putKey(b, 8, admin); putKey(b, 40, a.mint); scope.copy(b, 72);
  b[104] = paused ? 1 : 0;
  b.writeBigUInt64LE(active, 105); b[113] = bump;
  return b;
}
function receipt({refunded = false, amount = 100n, mint = a.mint, scope = a.scope, nonce = 42n, depositor = a.depositor, configAddress = p.config, vaultAddress = p.vault, bump = p.receiptBump} = {}) {
  const b = Buffer.alloc(218);
  discriminator('DepositReceipt').copy(b);
  putKey(b, 8, depositor); putKey(b, 40, mint);
  putKey(b, 72, vaultAddress); putKey(b, 104, configAddress);
  a.recipient.copy(b, 136); scope.copy(b, 168);
  b.writeBigUInt64LE(nonce, 200); b.writeBigUInt64LE(amount, 208);
  b[216] = refunded ? 1 : 0; b[217] = bump;
  return b;
}
function vault({amount = 100n, mint = a.mint, authority = p.config, delegate = false, frozen = false, close = false, native = false} = {}) {
  const b = Buffer.alloc(165);
  putKey(b, 0, mint); putKey(b, 32, authority);
  b.writeBigUInt64LE(amount, 64);
  b.writeUInt32LE(delegate ? 1 : 0, 72); b[108] = frozen ? 2 : 1;
  b.writeUInt32LE(native ? 1 : 0, 109);
  b.writeUInt32LE(close ? 1 : 0, 129);
  return b;
}
function mint({supply = 1000n, initialized = true, freeze = false} = {}) {
  const b = Buffer.alloc(82);
  b.writeUInt32LE(1, 0); // mint authority exists (allowed for disposable localnet mint)
  b.writeBigUInt64LE(supply, 36); b[44] = 6; b[45] = initialized ? 1 : 0;
  b.writeUInt32LE(freeze ? 1 : 0, 46);
  return b;
}
function snapshot({r = receipt(), c = config(), v = vault(), m = mint(), receiptOwner = a.program, configOwner = a.program, vaultOwner = CLASSIC_TOKEN_PROGRAM, mintOwner = CLASSIC_TOKEN_PROGRAM, slot = 5000} = {}) {
  return {slot, accounts: [
    {owner: receiptOwner, raw: r}, {owner: configOwner, raw: c},
    {owner: vaultOwner, raw: v}, {owner: mintOwner, raw: m},
  ]};
}
function verified(s = snapshot(), e = expected) {
  return verifySnapshot({snapshot: s, expected: e, genesisHash: a.genesis});
}
function fakeRpc(s = snapshot(), transform = () => {}) {
  const calls = [];
  const fakeFetch = async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    let result = body.method === 'getGenesisHash' ? a.genesis : {
      context: {slot: s.slot},
      value: s.accounts.map(x => ({owner:x.owner, executable:false, space:x.raw.length, lamports:1000000, data:[x.raw.toString('base64'),'base64']})),
    };
    const envelope = {jsonrpc:'2.0',id:body.id,result};
    transform(envelope, body);
    return {ok:true,json:async()=>envelope};
  };
  return {fakeFetch,calls};
}

test('base58 canonical 32-byte addresses round-trip with leading zeroes', () => {
  for (const x of [Buffer.alloc(32), Buffer.alloc(32, 1), Buffer.from([0, 0, ...new Array(30).fill(2)])]) {
    assert.deepEqual(decode58(encode58(x)), x);
  }
  assert.throws(() => addressBytes('BAD@ADDRESS'));
  assert.throws(() => addressBytes('2'));
});

test('PDA seed recipe is deterministic; nonce, program, mint and depositor are domain-bound', async () => {
  const again = await deriveBridgeAddresses({program:a.program,mint:a.mint,depositor:a.depositor,nonce:42n});
  assert.deepEqual(again,p);
  const nonce = await deriveBridgeAddresses({program:a.program,mint:a.mint,depositor:a.depositor,nonce:43n});
  assert.notEqual(nonce.receipt,p.receipt); assert.equal(nonce.config,p.config); assert.equal(nonce.vault,p.vault);
  const other = await deriveBridgeAddresses({program:pub(11),mint:pub(12),depositor:pub(13),nonce:42n});
  assert.notEqual(other.config,p.config); assert.notEqual(other.vault,p.vault); assert.notEqual(other.receipt,p.receipt);
  await assert.rejects(deriveBridgeAddresses({program:a.program,mint:a.mint,depositor:a.depositor,nonce:-1n}), /u64/);
  await assert.rejects(deriveBridgeAddresses({program:a.program,mint:a.mint,depositor:a.depositor,nonce:2n**64n}), /u64/);
});

test('valid receipt is state-only evidence and never credit authorization', async () => {
  const got = await verified();
  assert.equal(got.amountBaseUnits, '100');
  assert.equal(got.depositNonce, '42');
  assert.equal(got.state, 'active_refundable');
  assert.equal(got.creditEligible, false);
  assert.equal(got.transactionVerified, false);
  assert.equal(got.evidenceTrust, 'untrusted_rpc_snapshot');
  assert.equal(got.finalizedSlot, 5000);
  assert.throws(() => issueHolochainCredit(got), /CREDITING_DISABLED/);
  assert.throws(() => authorizeSolanaWithdrawal({}), /WITHDRAWALS_DISABLED/);
});

test('refunded receipt remains observation, never credit authorization', async () => {
  const got = await verified(snapshot({r:receipt({refunded:true}),c:config({active:0n}),v:vault({amount:0n})}));
  assert.equal(got.state, 'refunded'); assert.equal(got.creditEligible,false);
});

test('u64 amounts remain exact decimal strings above JS safe integer', async () => {
  const large = 9007199254740993n;
  const got = await verified(snapshot({r:receipt({amount:large}),c:config({active:large}),v:vault({amount:large}),m:mint({supply:large})}));
  assert.equal(got.amountBaseUnits, large.toString());
});

test('rejects receipt/config owner and wrong program ID even with forged owners', async () => {
  await assert.rejects(verified(snapshot({receiptOwner:pub(24)})), /Receipt has wrong program owner/);
  await assert.rejects(verified(snapshot({configOwner:pub(24)})), /Config has wrong program owner/);
  const wrong = pub(25);
  await assert.rejects(verified(snapshot({receiptOwner:wrong,configOwner:wrong}),{...expected,program:wrong}), /Noncanonical config PDA/);
});

test('rejects substitutions of receipt, config, vault and wrong receipt nonce or depositor', async () => {
  await assert.rejects(verified(snapshot(),{...expected,receipt:pub(22)}),/Noncanonical receipt PDA/);
  await assert.rejects(verified(snapshot({r:receipt({configAddress:pub(23)})}),{...expected,config:pub(23)}), /Vault authority|Noncanonical config PDA/);
  await assert.rejects(verified(snapshot({r:receipt({vaultAddress:pub(24)})}),{...expected,vault:pub(24)}), /Noncanonical vault PDA/);
  await assert.rejects(verified(snapshot({r:receipt({nonce:43n})})), /Noncanonical receipt PDA/);
  await assert.rejects(verified(snapshot({r:receipt({depositor:pub(26)})})), /Noncanonical receipt PDA/);
  await assert.rejects(verified(snapshot({r:receipt({bump:p.receiptBump^1})})), /Incorrect receipt PDA bump/);
  await assert.rejects(verified(snapshot({c:config({bump:p.configBump^1})})), /Incorrect config PDA bump/);
});

test('rejects mint/scope and token-owner substitutions', async () => {
  await assert.rejects(verified(snapshot({r:receipt({mint:pub(22)})})), /Mint mismatch/);
  await assert.rejects(verified(snapshot({r:receipt({scope:Buffer.alloc(32,3)})})), /scope mismatch/);
  await assert.rejects(verified(snapshot({v:vault({authority:pub(29)})})), /Vault authority/);
  await assert.rejects(verified(snapshot({vaultOwner:pub(30)})), /not a classic SPL Token/);
  await assert.rejects(verified(snapshot({mintOwner:pub(31)})), /Mint is not owned/);
});

test('rejects insolvency, delegate, close, native, frozen vault or bad mint state', async () => {
  await assert.rejects(verified(snapshot({v:vault({amount:99n})})), /liabilities exceed/);
  await assert.rejects(verified(snapshot({v:vault({delegate:true})})), /unapproved SPL/);
  await assert.rejects(verified(snapshot({v:vault({close:true})})), /unapproved SPL/);
  await assert.rejects(verified(snapshot({v:vault({native:true})})), /unapproved SPL/);
  await assert.rejects(verified(snapshot({v:vault({frozen:true})})), /frozen or uninitialized/);
  await assert.rejects(verified(snapshot({m:mint({freeze:true})})), /freezable/);
  await assert.rejects(verified(snapshot({m:mint({initialized:false})})), /uninitialized/);
  await assert.rejects(verified(snapshot({m:mint({supply:0n})})), /mint total supply/);
});

test('rejects malformed account lengths, discriminators, booleans and options', async () => {
  const r = receipt(); r[0] ^= 42;
  await assert.rejects(verified(snapshot({r})), /discriminator mismatch/);
  const invalid = receipt(); invalid[216] = 3;
  await assert.rejects(verified(snapshot({r:invalid})), /Noncanonical serialized boolean/);
  const badToken = vault(); badToken.writeUInt32LE(2, 72);
  await assert.rejects(verified(snapshot({v:badToken})), /Noncanonical delegate/);
  const badMint = mint(); badMint.writeUInt32LE(2, 46);
  await assert.rejects(verified(snapshot({m:badMint})), /Noncanonical freeze/);
  await assert.rejects(verified(snapshot({r:receipt().subarray(0,217)})), /account length/);
  await assert.rejects(verified(snapshot({m:Buffer.alloc(81)})), /classic SPL mint/);
  await assert.rejects(verified(snapshot({slot:0})), /No finalized snapshot slot/);
});

test('batch rejects a duplicate receipt identity, even if receipt bytes match', async () => {
  const x = await verified();
  assert.equal(assertUniqueObservations([x]).length,1);
  assert.throws(() => assertUniqueObservations([x,x]), /Duplicated receipt/);
  assert.throws(() => assertUniqueObservations([x,{...x,creditEligible:true}]), /Invalid observation/);
});

test('two-RPC reconciliation rejects refunded/replayed and contradictory same-slot snapshots', async () => {
  const active = await verified();
  const refunded = await verified(snapshot({r:receipt({refunded:true}),c:config({active:0n}),v:vault({amount:0n}),slot:5001}));
  assert.throws(() => reconcileObservations(active,refunded), /disagree/);
  const contradictory = await verified(snapshot({c:config({active:200n}),v:vault({amount:200n})}));
  assert.throws(() => reconcileObservations(active,contradictory), /same slot/);
  assert.throws(() => reconcileObservations(active,{...active,creditEligible:true}), /Invalid untrusted observation/);
});

test('two-RPC reconciliation permits different finalized slots with identical receipt bytes', async () => {
  const x = await verified();
  const y = await verifySnapshot({snapshot:snapshot({slot:5010,c:config({active:200n}),v:vault({amount:200n})}), expected, genesisHash:a.genesis,source:'other'});
  const joined = reconcileObservations(x,y);
  assert.equal(joined.creditEligible,false); assert.equal(joined.agreement,'receipt_bytes_only');
  assert.deepEqual(joined.providerFinalizedSlots,[5000,5010]);
});

test('RPC reader requests four accounts at finalized and validates chain identity', async () => {
  const {fakeFetch,calls} = fakeRpc();
  const got = await observeRpc({rpcUrl:'http://127.0.0.1:8899',expected,genesisHash:a.genesis,fetchFn:fakeFetch});
  assert.equal(got.creditEligible,false); assert.equal(calls[1].params[1].commitment,'finalized');
  assert.deepEqual(calls[1].params[0],[p.receipt,p.config,p.vault,a.mint]);
  const wrong = fakeRpc(snapshot(), (env,body)=> { if(body.method==='getGenesisHash') env.result=pub(99); });
  await assert.rejects(observeRpc({rpcUrl:'http://127.0.0.1:8899',expected,genesisHash:a.genesis,fetchFn:wrong.fakeFetch}),/genesis hash mismatch/);
  assert.equal(wrong.calls.length,1);
});

test('RPC reader rejects missing/null accounts, malformed base64, executable and mismatched space', async () => {
  for (const [label, mutate] of [
    ['null', e => e.result.value[0]=null],
    ['base64', e => e.result.value[0].data[0]='AAAA!!!'],
    ['executable', e => e.result.value[0].executable=true],
    ['space', e => e.result.value[0].space=0],
  ]) {
    const {fakeFetch} = fakeRpc(snapshot(), (e,b)=>{if(b.method==='getMultipleAccounts') mutate(e);});
    await assert.rejects(observeRpc({rpcUrl:'http://127.0.0.1:8899',expected,genesisHash:a.genesis,fetchFn:fakeFetch}),undefined,label);
  }
});
