#!/usr/bin/env node
/**
 * Checks a *generated* Anchor IDL against the observer's fixed-width schema.
 * A passing check is an IDL/schema comparison, NOT proof of deployment, custody,
 * transaction origin, or agreement of live RPC account bytes.
 *
 * Default invocation from observer/: node scripts/verify-idl.mjs ../target/idl/deposit_prototype.json <trusted-program-id>
 * Missing/invalid artifacts are always errors; no source-derived fallback.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// The expected Rust-source layout below is PROVISIONAL until IDL is compiled.
const ACCOUNT_SCHEMAS = Object.freeze({
  BridgeConfig: [
    ['admin','pubkey',8], ['mint','pubkey',40], ['scope','bytes32',72],
    ['paused','bool',104], ['totalActive','u64',105], ['bump','u8',113],
  ],
  DepositReceipt: [
    ['depositor','pubkey',8], ['mint','pubkey',40], ['vault','pubkey',72],
    ['config','pubkey',104], ['recipientCore','bytes32',136],
    ['scope','bytes32',168], ['nonce','u64',200], ['amount','u64',208],
    ['refunded','bool',216], ['bump','u8',217],
  ],
});
const ACCOUNT_LENGTHS = Object.freeze({BridgeConfig:114, DepositReceipt:218});
const WIDTH = Object.freeze({pubkey:32, bytes32:32, bool:1, u64:8, u8:1});
const FIELD_NAME = s => typeof s === 'string' ? s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) : s;
function need(condition, message) { if (!condition) throw new Error(`IDL verification failed: ${message}`); }
function asHex(bytes) {
  need(Array.isArray(bytes) && bytes.length === 8 && bytes.every(x => Number.isInteger(x) && x>=0 && x<=255), 'invalid 8-byte discriminator in IDL');
  return Buffer.from(bytes).toString('hex');
}
function primitiveType(input) {
  if (input === 'publicKey' || input === 'pubkey') return 'pubkey';
  if (input === 'bool' || input === 'u64' || input === 'u8') return input;
  if (typeof input === 'object' && input !== null && Array.isArray(input.array) && input.array.length===2 && input.array[0] === 'u8' && input.array[1] === 32) return 'bytes32';
  throw new Error(`IDL verification failed: unknown/nonfixed-width field type ${JSON.stringify(input)}`);
}
function sortedFields(idl, name) {
  const type = idl.types?.find(x => FIELD_NAME(x.name) === FIELD_NAME(name));
  need(type && type.type?.kind === 'struct' && Array.isArray(type.type.fields), `missing struct type ${name}`);
  return type.type.fields;
}
function constUtf8(seed) {
  const input=seed.value;
  if(Array.isArray(input) && input.every(x=>Number.isInteger(x)&&x>=0&&x<256)) return Buffer.from(input).toString('utf8');
  if(typeof input === 'string') return input;
  return null;
}
function instructionAccount(idl, instructionName, accountName) {
  const instruction = idl.instructions?.find(x=> FIELD_NAME(x.name) === instructionName);
  need(instruction && Array.isArray(instruction.accounts), `missing ${instructionName} instruction account metadata`);
  const flattened = [];
  const walk = accounts => { for (const a of accounts) if(a.accounts) walk(a.accounts); else flattened.push(a); };
  walk(instruction.accounts);
  const account = flattened.find(x=>FIELD_NAME(x.name) === accountName);
  need(account, `${instructionName} missing ${accountName} account`);
  return account;
}
function checkPda(idl, instruction, account, required) {
  const entry = instructionAccount(idl, instruction, account);
  const seeds = entry.pda?.seeds;
  need(Array.isArray(seeds) && seeds.length === required.length, `${instruction}.${account} missing/incompatible generated PDA seeds`);
  for (let i=0;i<required.length;i++) {
    const [kind,value]=required[i];
    const got = seeds[i];
    need(got?.kind === kind, `${instruction}.${account} seed[${i}] kind != ${kind}`);
    if(kind==='const') need(constUtf8(got)===value, `${instruction}.${account} seed[${i}] const != ${value}`);
    else need(FIELD_NAME(got.path) === value, `${instruction}.${account} seed[${i}] path != ${value}`);
  }
}

/** Verifies account discriminator, order, offsets, lengths, and declared PDA seed paths. */
export function validateGeneratedIdl(idl, {expectedProgramId} = {}) {
  if (expectedProgramId !== undefined) {
    need(typeof expectedProgramId === 'string' && expectedProgramId.length > 0, 'invalid trusted program ID');
    need(idl?.address === expectedProgramId, 'IDL program address does not match trusted deployment');
  }
  need(idl && typeof idl === 'object' && Array.isArray(idl.accounts) && Array.isArray(idl.instructions), 'missing IDL accounts/instructions');
  const checks = [];
  for (const [name, fields] of Object.entries(ACCOUNT_SCHEMAS)) {
    const account = idl.accounts.find(x=>FIELD_NAME(x.name) === FIELD_NAME(name));
    need(account, `missing ${name} account`);
    const anchorDiscriminator = createHash('sha256').update(`account:${name}`).digest().subarray(0,8).toString('hex');
    need(asHex(account.discriminator) === anchorDiscriminator, `${name} discriminator differs from observer`);
    const actual = sortedFields(idl,name);
    need(actual.length===fields.length, `${name} field count mismatch`);
    let offset=8;
    for (let i=0; i<fields.length; i++) {
      const [fieldName, type, expectedOffset] = fields[i];
      const got=actual[i];
      need(FIELD_NAME(got.name)===fieldName, `${name} field ${i} name mismatch (expected ${fieldName}, got ${got.name})`);
      need(primitiveType(got.type)===type, `${name}.${fieldName} type mismatch`);
      need(offset===expectedOffset, `${name}.${fieldName} offset mismatch`);
      checks.push(`${name}.${fieldName}@${offset}:${type}`);
      offset+=WIDTH[type];
    }
    need(offset===ACCOUNT_LENGTHS[name], `${name} serialized length ${offset} differs from ${ACCOUNT_LENGTHS[name]}`);
  }
  checkPda(idl, 'initialize','config', [['const','config']]);
  checkPda(idl, 'initialize','vault', [['const','vault'],['account','mint']]);
  checkPda(idl, 'deposit','config', [['const','config']]);
  checkPda(idl, 'deposit','vault', [['const','vault'],['account','mint']]);
  checkPda(idl, 'deposit','receipt', [['const','deposit'],['account','depositor'],['arg','nonce']]);
  return Object.freeze({
    schema: 'observer-anchor-layout-source-contract-v1',
    verifiedAgainstGeneratedIdl: true,
    accountLengths: ACCOUNT_LENGTHS,
    fields: Object.freeze(checks),
    verifiedPdaSeeds: Object.freeze(['initialize.config','initialize.vault','deposit.config','deposit.vault','deposit.receipt']),
  });
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const file = resolve(process.argv[2] ?? '../target/idl/deposit_prototype.json');
    const expectedProgramId = process.argv[3];
    if (!expectedProgramId) throw new Error('missing trusted deployed program ID arg');
    const raw = readFileSync(file);
    const report=validateGeneratedIdl(JSON.parse(raw.toString('utf8')), {expectedProgramId});
    console.log(JSON.stringify({artifact:file,artifactSha256:createHash('sha256').update(raw).digest('hex'),...report,creditEligible:false,transactionVerified:false},null,2));
  } catch (e) {
    console.error(`FAIL CLOSED: ${e.message}`);
    process.exitCode=1;
  }
}
