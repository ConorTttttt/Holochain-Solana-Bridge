import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveDemoScope,ECONOMIC_DENIAL,DEMO_SCOPE_TAG,DEMO_SCHEMA} from '../tests/solana/demo-scope.mjs';
import {renderBoundDna,confirmSourceAndWitness} from './a0-bind-same-run-dna.mjs';

const sha='2bc6887b1c373311f2fbddea530bd533067dad84';
const manifests={sourceManifestSha256:'e'.repeat(64),archiveManifestSha256:'f'.repeat(64)};
const b58='11111111111111111111111111111111';
const domain={genesisHash:b58,programId:'22222222222222222222222222222222',
  mint:'33333333333333333333333333333333'};
const scope=deriveDemoScope(domain).toString('hex');
const witness=(signature,slot)=>({signature,slot,getTransactionRawFile:'source-tx.rpc.json',
  getTransactionBase64RawFile:'source-tx64.rpc.json',getBlockRawFile:'source-block.rpc.json',
  getBlockBase64RawFile:'source-block64.rpc.json'});
const source={...domain,...ECONOMIC_DENIAL,schema:DEMO_SCHEMA,mode:'demo-domain',
  kind:'disposable-localnet-source-audit-NOT-consensus-proof',sourceCommitSha:sha,
  idlSha256:'a'.repeat(64),elfSha256:'b'.repeat(64),postSyncSourceSha256:'c'.repeat(64),
  config:b58,vault:b58,receipt:b58,depositor:b58,
  scopeHex:scope,initializedScopeHex:scope,recipientCoreHex:'d'.repeat(64),
  scopeDerivationTag:DEMO_SCOPE_TAG,nonce:'42017',amountBaseUnits:'250000',
  witnessBundle:'sprint1-demo-domain-transactions.json',
  snapshots:{active:'demo-domain-active-receipt.json',refunded:'demo-domain-refunded-receipt.json'},
  transactions:{initialize:witness('sig1',10),deposit:witness('sig2',42),refund:witness('sig3',75)},
  historyComplete:false,economicAuthorization:'DENIED'};
const template=[
 "manifest_version: '0'",
 "name: holochain_solana_audit_demo",
 "integrity:",
 "  network_seed: DEMO-ONLY-REPLACE-WITH-FRESH-RANDOM-SEED",
 "  properties:",
 "    demoOnly: true",
 "    genesisHash: OLD",
 "    program: OLD",
 "    mint: OLD",
 "    holochainScope: '0707070707070707070707070707070707070707070707070707070707070707'",
 "  zomes:",
 "    - name: solana_audit_integrity",
 "      hash: null",
 ""].join('\n');
test('synthetic same-source deterministic DNA properties without runtime claim',()=>{
 const a=renderBoundDna(template,source,manifests),b=renderBoundDna(template,source,manifests);
 assert.equal(a.staged,b.staged);
 assert.match(a.staged,new RegExp('genesisHash: '+domain.genesisHash));
 assert.match(a.staged,new RegExp('program: '+domain.programId));
 assert.match(a.staged,new RegExp('mint: '+domain.mint));
 assert.match(a.staged,new RegExp('holochainScope: '+scope));
 assert.equal(a.binding.state,'SOURCE_PROPERTIES_MATCH_ONLY_NO_RUNTIME_CLAIM');
 assert.doesNotMatch(a.staged,/DEMO-ONLY-REPLACE/);
});
test('duplicates and missing identity fields refuse before source binding',()=>{
 assert.throws(()=>renderBoundDna(template+'    program: DIFFERENT\n',source,manifests),/CARDINALITY:program/);
 assert.throws(()=>renderBoundDna(template.replace('    genesisHash: OLD','    genesis: OLD'),source,manifests),/CARDINALITY:genesisHash/);
 assert.throws(()=>renderBoundDna(template.replace('demoOnly: true','demoOnly: false'),source,manifests),/NOT_AUDIT_ONLY/);
});
test('substituted initialized scope and economic authorization refuse',()=>{
 assert.throws(()=>renderBoundDna(template,{...source,initializedScopeHex:'f'.repeat(64)},manifests),/executed config scope disagrees/);
 assert.throws(()=>renderBoundDna(template,{...source,withdrawalAuthorized:true},manifests),/economic denial changed/);
});
test('source/Kit original manifest mismatch is rejected, not re-labelled',()=>{
 const original={schema:'hsc-a1-same-sha-fresh-signed-source-v2-queued-not-delivered',
  immutableSourceCommitSha:sha,originalSolanaDomain:source,
  originalSignedTransactionSha256:'f'.repeat(64),originalContainingBlockhash:'blockhash',
  durableOutboxReopened:'pending',transportRefusal:'REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED',
  noHolochainAck:true,destinationReadback:{state:'not_approved_or_written',actionHash:null},
  refundHistoryComplete:false,independentRpcConsensusVerified:false,
  observerReviewedWitnessV2:{kind:'solana-observation-demo-v2',witnessDigest:'a'.repeat(64),
    source:{codeVersion:sha,signature:'sig2',depositNonce:'42017',recipientCore:'d'.repeat(64),
      holochainScope:scope,amountBaseUnits:'250000',...ECONOMIC_DENIAL},
    proof:{historyComplete:false,...ECONOMIC_DENIAL},...ECONOMIC_DENIAL},...ECONOMIC_DENIAL};
 const bytes=Buffer.from(JSON.stringify(original));
 const digest=createHash('sha256').update(bytes).digest('hex');
 assert.equal(confirmSourceAndWitness(source,original,bytes,digest,sha).program,domain.programId);
 assert.throws(()=>confirmSourceAndWitness({...source,mint:b58},original,bytes,digest,sha),/scope is not derived/);
 assert.throws(()=>confirmSourceAndWitness(source,{...original,originalSolanaDomain:{...source,programId:b58}},bytes,digest,sha),
   /ORIGINAL_SOL_MANIFEST_SUBSTITUTED/);
});

test('DNA network seed cryptographically separates original source SHA and both manifest digests',()=>{
 const first=renderBoundDna(template,source,manifests);
 const otherSource=renderBoundDna(template,{...source,sourceCommitSha:'0'.repeat(40)},manifests);
 const otherManifest=renderBoundDna(template,source,{...manifests,sourceManifestSha256:'a'.repeat(64)});
 const otherArchive=renderBoundDna(template,source,{...manifests,archiveManifestSha256:'b'.repeat(64)});
 for(const x of [otherSource,otherManifest,otherArchive])assert.notEqual(x.seed,first.seed);
 assert.throws(()=>renderBoundDna(template,source,{...manifests,archiveManifestSha256:'incorrect'}),
  /A0_ORIGINAL_MANIFEST_DIGEST_REQUIRED/);
});
