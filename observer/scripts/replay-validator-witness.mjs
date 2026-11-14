/**
 * Read-only replay of SOL's genuinely captured local-validator RPC witness bundle.
 * This is NOT a gap-free historical indexer or an independent consensus proof.
 * Fail closed when the immutable public archive is incomplete. No signing/credit.
 *
 * Usage:
 * node observer/scripts/replay-validator-witness.mjs \
 *   <target/localnet-evidence> <lifecycle|init-capture|u64-max> \
 *   <trusted-deployment.json> <target/idl/deposit_prototype.json> \
 *   <target/deploy/deposit_prototype.so> <successful-deposit-signature>
 *
 * stdout: JSON array of solana-deposit-evidence-v1 for SHADOW handoff only.
 * The separate trusted manifest must be pinned by CI/operator, not copied from RPC.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function need(condition, text) {
  if (!condition) throw new Error('Validator witness replay failed: ' + text);
}
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function jsonFile(path) { return JSON.parse(readFileSync(path,'utf8')); }
function witnessFile(dir,name,pattern) {
  need(typeof name === 'string' && pattern.test(name), 'unsafe/missing archived filename');
  return jsonFile(join(dir,name));
}
function rpcResult(dir,name) {
  const response = witnessFile(dir,name,/^(getTransaction|getBlock|getMultipleAccounts)-[A-Za-z0-9-]+\.rpc\.json$/);
  need(response?.jsonrpc === '2.0' && response.error === undefined &&
    response.result !== null && response.result !== undefined,
    'incomplete RPC response in ' + name);
  return response.result;
}
function binding(object, trusted, label) {
  for (const key of ['genesisHash','programId','sourceCommitSha','idlSha256','elfSha256']) {
    need(object?.[key] === trusted[key], label + ': untrusted ' + key + ' binding');
  }
}
const requiredSnapshots = Object.freeze({
  lifecycle: ['active-receipt','refunded-receipt','two-active-receipts',
    'two-refunded-receipts','sprint1-two-wallets-live'],
  'init-capture': ['sprint1-initializer-capture'],
  'u64-max': ['sprint1-u64-refunded'],
});
/**
 * Inspects real RPC responses BEFORE importing Kit, so missing captures are
 * reported even on a host without the SDK. No fabricated wire is accepted.
 */
export function preflightValidatorWitness({dir,mode,trusted,idlPath,elfPath}) {
  need(Object.hasOwn(requiredSnapshots,mode), 'unknown validator scenario');
  need(trusted && typeof trusted === 'object' && trusted.expected &&
    trusted.expected.program === trusted.programId &&
    Number.isSafeInteger(trusted.trustedDeploymentSlot) &&
    trusted.trustedDeploymentSlot > 0, 'missing independent deployment manifest');
  need(/^[0-9a-f]{40}$/.test(trusted.sourceCommitSha || '') &&
    /^[0-9a-f]{64}$/.test(trusted.idlSha256 || '') &&
    /^[0-9a-f]{64}$/.test(trusted.elfSha256 || ''),
    'missing pinned source/IDL/ELF digest');
  need(sha256(readFileSync(idlPath)) === trusted.idlSha256 &&
    sha256(readFileSync(elfPath)) === trusted.elfSha256,
    'generated IDL/ELF bytes do not match independent binding');
  const idlText = readFileSync(idlPath,'utf8');
  need(JSON.parse(idlText).address === trusted.programId,
    'generated IDL program address differs from pinned deployment');
  const bundle = jsonFile(join(dir,'sprint1-' + mode + '-transactions.json'));
  need(bundle?.kind === 'localnet-rpc-finalized-transaction-and-block-evidence-NOT-consensus-proof' &&
    bundle.mode === mode && Array.isArray(bundle.finalized) &&
    bundle.finalized.length > 0, 'no complete validator transaction manifest');
  binding(bundle,trusted,'transaction manifest');
  const snapshots = requiredSnapshots[mode].map(label => {
    const snapshot = jsonFile(join(dir,label+'.json'));
    binding(snapshot,trusted,label);
    need(snapshot?.label === label && Number.isSafeInteger(snapshot.slot) &&
      snapshot.slot >= trusted.trustedDeploymentSlot &&
      Array.isArray(snapshot.accounts) && snapshot.accounts.length >= 3,
      label + ': invalid finalized account manifest');
    const raw = rpcResult(dir,snapshot.getMultipleAccountsRawFile);
    need(raw.context?.slot === snapshot.slot &&
      Array.isArray(raw.value) && raw.value.length === snapshot.accounts.length,
      label + ': inconsistent finalized account RPC');
    for(let i=0;i<raw.value.length;i++) {
      const account = snapshot.accounts[i], value = raw.value[i];
      need(value && typeof account.address === 'string' &&
        value.owner === account.owner && value.data?.[1] === 'base64' &&
        value.data[0] === account.dataBase64 &&
        value.lamports === account.lamports,
        label + ': RPC account bytes/owner/balance mismatch');
    }
    return {snapshot,raw};
  });
  let accepted = 0, rejected = 0;
  const signatures = new Set();
  const transactions = bundle.finalized.map(witness => {
    need(typeof witness.signature === 'string' &&
      /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(witness.signature) &&
      !signatures.has(witness.signature), 'missing/duplicate transaction signature');
    signatures.add(witness.signature);
    need(Number.isSafeInteger(witness.slot) &&
      witness.slot >= trusted.trustedDeploymentSlot, 'untrusted witness slot');
    const parsed = rpcResult(dir,witness.getTransactionRawFile);
    const signed = rpcResult(dir,witness.getTransactionBase64RawFile);
    const blockJson = rpcResult(dir,witness.getBlockRawFile);
    // SOL must capture a SECOND getBlock response with encoding=base64.
    // JSON-only blocks cannot pass OBS's every-entry Ed25519 policy.
    const blockBase64 = rpcResult(dir,witness.getBlockBase64RawFile);
    need(parsed.slot === witness.slot && signed.slot === witness.slot &&
      parsed.version === signed.version &&
      ['legacy',0,1].includes(signed.version) &&
      Array.isArray(signed.transaction) && signed.transaction[1] === 'base64',
      'missing/mismatched signed base64 getTransaction');
    const wire = signed.transaction[0];
    need(typeof wire === 'string' && wire.length > 0 &&
      Buffer.from(wire,'base64').toString('base64') === wire,
      'truncated/noncanonical signed transaction');
    need(same(signed.meta?.err,parsed.meta?.err) &&
      same(signed.meta?.err,witness.meta?.err) &&
      parsed.transaction?.signatures?.includes(witness.signature),
      'parsed/signed execution or signature disagreement');
    need(blockJson.blockhash === witness.blockhash &&
      blockBase64.blockhash === witness.blockhash &&
      blockJson.previousBlockhash === blockBase64.previousBlockhash &&
      blockJson.parentSlot === blockBase64.parentSlot &&
      blockJson.parentSlot === witness.parentSlot &&
      Number.isSafeInteger(blockJson.parentSlot) &&
      blockJson.parentSlot < witness.slot &&
      Array.isArray(blockJson.transactions) &&
      Array.isArray(blockBase64.transactions) &&
      blockJson.transactions.length === blockBase64.transactions.length,
      'missing/contradictory full containing block');
    need(blockBase64.transactions.every(tx =>
      Array.isArray(tx.transaction) && tx.transaction[1] === 'base64' &&
      ['legacy',0,1].includes(tx.version) &&
      tx.meta && Object.hasOwn(tx.meta,'err')),
      'JSON-only, missing or unsupported complete-block wire');
    for (let i=0;i<blockJson.transactions.length;i++) {
      need(blockJson.transactions[i].version === blockBase64.transactions[i].version,
        'JSON/base64 containing block order/version contradiction');
    }
    if (signed.meta.err === null) accepted++; else rejected++;
    return {witness,parsed,signed,blockJson,blockBase64};
  });
  need(accepted > 0 && rejected > 0,
    'genuine bundle must contain included successful AND rejected transactions');
  return {bundle,transactions,snapshots,idlText,accepted,rejected};
}
export async function replayValidatorWitness(options) {
  const archive = preflightValidatorWitness(options);
  const {signature, trusted} = options;
  need(typeof signature === 'string', 'explicit deposit signature required');
  // Reuse the same actual @solana/kit Ed25519 block-entry verifier as the indexer.
  const {signatureOf} = await import('../src/indexer.mjs');
  const {verifyDepositCandidates,attachReceiptObservation} =
    await import('../src/transaction.mjs');
  const {verifySnapshot} = await import('../src/verify.mjs');
  const {validateGeneratedIdl} = await import('./verify-idl.mjs');
  const idl = JSON.parse(archive.idlText);
  validateGeneratedIdl(idl,{expectedProgramId:trusted.programId});
  let selected = null;
  for (const item of archive.transactions) {
    const blockSigs = await Promise.all(item.blockBase64.transactions.map(signatureOf));
    need(new Set(blockSigs).size === blockSigs.length,
      'duplicate transaction signature in full block');
    need(blockSigs.length === item.blockJson.transactions.length &&
      blockSigs.every((sig,i) =>
        item.blockJson.transactions[i].transaction?.signatures?.[0] === sig),
      'JSON/base64 containing block signature disagreement');
    const offsets = blockSigs.map((sig,i)=>sig === item.witness.signature ? i : -1)
      .filter(i=>i !== -1);
    need(offsets.length === 1, 'claimed transaction absent/duplicated in finalized block');
    const entry = item.blockBase64.transactions[offsets[0]];
    need(same(entry.version,item.signed.version) &&
      same(entry.transaction,item.signed.transaction) &&
      same(entry.meta,item.signed.meta),
      'getTransaction contradicts containing base64 getBlock');
    if (item.witness.signature === signature) selected = item;
  }
  need(selected && selected.signed.meta.err === null,
    'requested signature must be a finalized successful deposit');
  const deposits = await verifyDepositCandidates({
    rpcTransaction:selected.signed, signature, expected:trusted.expected,
    genesisHash:trusted.genesisHash,idl,finalizedClaim:true,
    blockhash:selected.witness.blockhash,source:'archived_local_validator_rpc',
  });
  need(deposits.length > 0, 'requested transaction contains no verified deposit');
  const evidence = [];
  for (const candidate of deposits) {
    const matching = archive.snapshots.filter(({snapshot}) =>
      snapshot.slot >= candidate.finalizedSlot &&
      snapshot.accounts.length === 4 &&
      same(snapshot.accounts.map(x=>x.address),[
        candidate.receiptAddress,trusted.expected.config,
        trusted.expected.vault,trusted.expected.mint,
      ])).sort((a,b)=>a.snapshot.slot-b.snapshot.slot);
    need(matching.length > 0, 'no finalized receipt/config/vault/mint snapshot for deposit');
    const observation = await verifySnapshot({
      snapshot:{slot:matching[0].snapshot.slot,accounts:matching[0].raw.value.map(a=>({
        owner:a.owner,raw:Buffer.from(a.data[0],'base64'),
      }))},expected:{...trusted.expected,receipt:candidate.receiptAddress},
      genesisHash:trusted.genesisHash,source:'archived_local_validator_rpc',
    });
    evidence.push(attachReceiptObservation(candidate,observation));
  }
  need(evidence.every(x=>x.creditEligible === false &&
    x.independentConsensusVerified === false &&
    x.transactionVerified === true),
    'shadow boundary escalation');
  return {evidence,accepted:archive.accepted,rejected:archive.rejected,
    historyIndexed:false,independentConsensusVerified:false,creditEligible:false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [dir,mode,manifest,idlPath,elfPath,signature] = process.argv.slice(2);
    need([dir,mode,manifest,idlPath,elfPath,signature].every(Boolean),
      'usage: <evidence-dir> <mode> <trusted-manifest> <IDL> <ELF> <deposit-signature>');
    const result = await replayValidatorWitness({
      dir,mode,trusted:jsonFile(manifest),idlPath,elfPath,signature,
    });
    console.error('SHADOW ONLY: ' + result.accepted + ' successes, ' +
      result.rejected + ' included rejected, ' + result.evidence.length +
      ' deposit evidence; NO historical checkpoint or economic authorization');
    console.log(JSON.stringify(result.evidence,null,2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
