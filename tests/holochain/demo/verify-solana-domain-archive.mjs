#!/usr/bin/env node
/**
 * Agent 4 read-only, archive-only source provenance checker. Validates the
 * original localnet account evidence, but NEVER authorizes a new DNA build,
 * credits, withdrawals or a signed Holochain write.
 *
 * Usage: node verify-solana-domain-archive.mjs <evidence-dir> <IDL> <ELF> <expected-git-SHA>
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const fail = code => { throw new Error('A4_SOURCE_ARCHIVE_REFUSED:' + code); };
const hash = b => createHash('sha256').update(b).digest('hex');
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '00')), out = '';
  while (n > 0n) {
    const rem = Number(n % 58n);
    n /= 58n;
    out = alphabet[rem] + out;
  }
  for (const byte of bytes) { if (byte !== 0) break; out = '1' + out; }
  return out || '1';
}
function need(x,code) { if (!x) fail(code); }
function json(file,code) {
  try { return JSON.parse(readFileSync(file,'utf8')); } catch { fail(code); }
}
function main() {
  const [directory,idlPath,elfPath,expectedSha] = process.argv.slice(2);
  need(directory && idlPath && elfPath &&
    /^[a-f0-9]{40}$/.test(expectedSha || ''),'ARGUMENTS');
  const dir=realpathSync(resolve(directory));
  const lines=readFileSync(join(dir,'evidence-manifest.sha256'),'utf8')
    .trimEnd().split('\n');
  const seen=new Set();
  need(lines.length > 0,'EMPTY_MANIFEST');
  for (const line of lines) {
    const m=/^([a-f0-9]{64})  \.\/([a-zA-Z0-9_.-]+)$/.exec(line);
    need(m,'MANIFEST_FORMAT');
    const name=m[2];
    need(!seen.has(name),'MANIFEST_DUPLICATE');
    seen.add(name);
    const path=realpathSync(join(dir,name));
    need(path.startsWith(dir+sep),'MANIFEST_ESCAPE');
    need(hash(readFileSync(path))===m[1],'MANIFEST_DIGEST:'+name);
  }
  for (const required of ['active-receipt.json','source-commit.txt',
    'lifecycle-getMultipleAccounts-active-receipt.rpc.json']) {
    need(seen.has(required),'MISSING_ARCHIVED_SOURCE');
  }
  const sha=readFileSync(join(dir,'source-commit.txt'),'utf8').trim();
  need(sha===expectedSha,'SOURCE_COMMIT_MISMATCH');
  const snapshot=json(join(dir,'active-receipt.json'),'SNAPSHOT_JSON');
  need(snapshot.kind==='localnet-finalized-rpc-account-snapshot-not-consensus-proof' &&
    snapshot.label==='active-receipt' && snapshot.sourceCommitSha===sha,
    'SNAPSHOT_PROVENANCE');

  const idl=readFileSync(resolve(idlPath)),elf=readFileSync(resolve(elfPath));
  need(hash(idl)===snapshot.idlSha256,'IDL_HASH');
  need(hash(elf)===snapshot.elfSha256,'ELF_HASH');
  const parsed=JSON.parse(idl.toString('utf8'));
  need(parsed.address===snapshot.programId,'PROGRAM_IDL');
  const type=parsed.types?.find(x=>x.name==='DepositReceipt')?.type;
  const expected=['depositor','mint','vault','config','recipient_core',
    'scope','nonce','amount','refunded','bump'];
  need(type?.kind==='struct' &&
    JSON.stringify(type.fields?.map(x=>x.name))===JSON.stringify(expected),
    'RECEIPT_LAYOUT');
  need(type.fields[4].type.array?.[1]===32 &&
    type.fields[5].type.array?.[1]===32,'RECEIPT_SCOPE_LAYOUT');
  const discriminator=parsed.accounts?.find(x=>x.name==='DepositReceipt')?.discriminator;
  need(Array.isArray(discriminator)&&discriminator.length===8,
    'RECEIPT_DISCRIMINATOR');

  const accounts=snapshot.accounts;
  need(Array.isArray(accounts)&&accounts.length===4,'SNAPSHOT_FOUR_ACCOUNTS');
  const rpc=json(join(dir,snapshot.getMultipleAccountsRawFile),'RPC_JSON');
  need(rpc.result?.context?.slot===snapshot.slot && rpc.result.value?.length===4,
    'RPC_SLOT_OR_CARDINALITY');
  for(let i=0;i<4;i++) {
    const a=accounts[i],v=rpc.result.value[i];
    need(a.owner===v.owner&&a.lamports===v.lamports&&
      a.executable===v.executable&&v.data?.[1]==='base64' &&
      a.dataBase64===v.data[0],'RPC_ACCOUNT_CONTRADICTION');
  }
  need(accounts[0].owner===snapshot.programId,'RECEIPT_OWNER');
  const receipt=Buffer.from(accounts[0].dataBase64,'base64');
  need(receipt.length===218 &&
    receipt.subarray(0,8).equals(Buffer.from(discriminator)),'RECEIPT_BYTES');
  const grab=i=>receipt.subarray(8+32*i,8+32*(i+1));
  const [depositor,mint,vault,config]=[0,1,2,3].map(i=>base58(grab(i)));
  need(vault===accounts[2].address && config===accounts[1].address &&
    mint===accounts[3].address,'RECEIPT_ACCOUNT_LINKS');
  const tokenProgram='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  need(accounts[2].owner===tokenProgram && accounts[3].owner===tokenProgram,
    'NOT_CLASSIC_SPL');
  const scope=grab(5).toString('hex');
  const nonce=receipt.readBigUInt64LE(200).toString();
  const amount=receipt.readBigUInt64LE(208).toString();
  need(receipt[216]===0 && nonce==='42017' && amount==='250000',
    'ARCHIVED_LIFECYCLE_NOT_ACTIVE');
  const exampleScope=scope==='07'.repeat(32);
  console.log(JSON.stringify({
    kind:'A4_archived_disposable_source_scope_review',sourceSha:sha,
    evidenceManifestEntries:lines.length,archivedRpcSlot:snapshot.slot,
    genesisHash:snapshot.genesisHash,program:snapshot.programId,mint,scope,
    receipt:accounts[0].address,depositor,nonce,amountBaseUnits:amount,
    idlSha256:snapshot.idlSha256,elfSha256:snapshot.elfSha256,
    placeholderScopeDetected:exampleScope,deploymentAllowed:false,
    reason:exampleScope?'KNOWN_07_SCOPE_NOT_APPROVED_AND_ARCHIVED_VALIDATOR_STOPPED':
      'ARCHIVED_RPC_ONLY_NO_FRESH_CONTROLLED_SOURCE_ATTESTATION',
    historyComplete:false,creditEligible:false,independentConsensusVerified:false,
    spendableBaseUnits:'0',withdrawalAuthorized:false
  },null,2));
}
try { main(); } catch(e) {
  console.error(e.message?.startsWith('A4_SOURCE_ARCHIVE_REFUSED:')?
    e.message:'A4_SOURCE_ARCHIVE_REFUSED:READ_OR_PARSE_FAILURE');
  process.exitCode=1;
}
