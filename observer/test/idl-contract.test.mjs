/** Synthetic fixtures exercise the checker; they do NOT substitute for an Anchor-generated IDL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateGeneratedIdl } from '../scripts/verify-idl.mjs';

const fields = {
  BridgeConfig: [
    ['admin','pubkey'],['mint','pubkey'],['scope',{array:['u8',32]}],
    ['paused','bool'],['totalActive','u64'],['bump','u8'],
  ],
  DepositReceipt: [
    ['depositor','pubkey'],['mint','pubkey'],['vault','pubkey'],['config','pubkey'],
    ['recipientCore',{array:['u8',32]}],['scope',{array:['u8',32]}],
    ['nonce','u64'],['amount','u64'],['refunded','bool'],['bump','u8'],
  ],
};
const constSeed = label => ({kind:'const', value:[...Buffer.from(label)]});
const accountSeed = path => ({kind:'account',path});
const argSeed = path => ({kind:'arg',path});
const pda = (name,seeds) => ({name,pda:{seeds}});
function fixture() {
  return {
    accounts: Object.keys(fields).map(name => ({name,discriminator:[...createHash('sha256').update('account:'+name).digest().subarray(0,8)]})),
    types: Object.entries(fields).map(([name,fields])=>({name,type:{kind:'struct',fields:fields.map(([name,type])=>({name,type}))}})),
    instructions: [
      {name:'initialize',accounts:[pda('config',[constSeed('config')]),pda('vault',[constSeed('vault'),accountSeed('mint')])]},
      {name:'deposit',accounts:[pda('config',[constSeed('config')]),pda('vault',[constSeed('vault'),accountSeed('mint')]),pda('receipt',[constSeed('deposit'),accountSeed('depositor'),argSeed('nonce')])]},
    ],
  };
}

test('synthetic fixture validates source-derived widths, offsets, discriminators, seed paths', () => {
  const report=validateGeneratedIdl(fixture());
  assert.equal(report.verifiedAgainstGeneratedIdl,true); // assertion about the *input IDL shape*, NOT its source
  assert.equal(report.fields.length,16);
  assert.equal(report.accountLengths.BridgeConfig,114);
  assert.equal(report.accountLengths.DepositReceipt,218);
});
test('fails closed when an IDL field shifts or swaps', () => {
  const f=fixture(); [f.types[1].type.fields[5],f.types[1].type.fields[6]]=[f.types[1].type.fields[6],f.types[1].type.fields[5]];
  assert.throws(()=>validateGeneratedIdl(f),/field 5 name mismatch/);
});
test('fails closed on incorrect IDL discriminator, field type, missing account', () => {
  const f=fixture(); f.accounts[0].discriminator[0]^=1;
  assert.throws(()=>validateGeneratedIdl(f),/discriminator/);
  const g=fixture();g.types[0].type.fields[4].type='u32';
  assert.throws(()=>validateGeneratedIdl(g),/unknown\/nonfixed-width/);
  const h=fixture();h.accounts.pop();
  assert.throws(()=>validateGeneratedIdl(h),/missing DepositReceipt account/);
});
test('fails closed on altered deposit PDA recipe or absent PDA metadata', () => {
  const f=fixture();f.instructions[1].accounts[2].pda.seeds[2].path='amount';
  assert.throws(()=>validateGeneratedIdl(f),/path != nonce/);
  const g=fixture();delete g.instructions[1].accounts[2].pda;
  assert.throws(()=>validateGeneratedIdl(g),/missing\/incompatible generated PDA seeds/);
});
test('fails closed when claimed deployed program ID differs from IDL address', () => {
  const f=fixture();f.address='11111111111111111111111111111111';
  assert.throws(()=>validateGeneratedIdl(f,{expectedProgramId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'}),/program address/);
  assert.equal(validateGeneratedIdl(f,{expectedProgramId:f.address}).verifiedAgainstGeneratedIdl,true);
});
