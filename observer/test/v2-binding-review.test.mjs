/** Byte-exact A4 digest-primitive vectors; SYNTHETIC, NOT Kit admission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {A4_BINDING_DOMAIN,canonicalTypedV2,reviewBindingDigestPrimitive,
  verifyBindingDigestReviewOnly} from '../src/v2-binding-review.mjs';

const DENIALS={creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false};
const unsigned={
  ...DENIALS,kind:'solana-observation-demo-v2',schemaVersion:'2',
  status:'source_verified_rpc_claim',historyIndexed:false,deliveryAuthorized:false,
  source:{...DENIALS,sourceId:'g:p:r',occurrenceId:'g:p:s:outer:0',sourceEventType:'deposit',
    depositNonce:'42017',amountBaseUnits:'250000'},
  witness:{...DENIALS,sourceWitnessDigest:'a'.repeat(64),
    originalSignedWireSha256:'7dd4f34251059c1c13f01c29087ac1e619111a4bc65910de62210c9a77ba02bc',
    historyComplete:false},
  proof:{...DENIALS,sourceAuthNotConferredByPayload:true,historyComplete:false,
    originalObserverWitnessCanonicalJson:'{"kind":"SYNTHETIC_ONLY"}',
    originalFourAccountRpcUtf8:'{"jsonrpc":"2.0","result":{"rentEpoch":18446744073709551615}}'},
  destination:{...DENIALS,installedAppId:'TEST_ONLY',dnaHash:'TEST_DNA',
    cellAgentPubkey:'TEST_AGENT',cellId:['TEST_DNA','TEST_AGENT'],
    function:'record_observation_v2'},
};
const SHA=b=>createHash('sha256').update(b).digest('hex');
test('A4 primitive: independent canonical UTF-8 and domain-separated digest',()=>{
  assert.equal(A4_BINDING_DOMAIN,'HSC/solana-audit-demo-v2/source-to-dna');
  const bytes=Buffer.from(canonicalTypedV2(unsigned),'utf8');
  assert.equal(bytes.length,1484);
  assert.equal(SHA(bytes),'97c3f9f018b74d7f91c4c44e65d26d5c18697abc1172394eca1c8578033f68ec');
  const independent=SHA(Buffer.concat([Buffer.from(A4_BINDING_DOMAIN),Buffer.from([0]),bytes]));
  assert.equal(independent,'206c010fae05f66b0b3e807a39e97bc869a851e6e7799d2ab0962cadec42ca5e');
  assert.equal(reviewBindingDigestPrimitive(unsigned),independent);
  assert.equal(reviewBindingDigestPrimitive(structuredClone(unsigned)),independent);
});
test('A4 primitive: negative source, proof, destination and denial changes each change digest',()=>{
  const base=reviewBindingDigestPrimitive(unsigned);
  for(const mutate of [
    x=>{x.source.depositNonce='42018'},
    x=>{x.source.amountBaseUnits='250001'},
    x=>{x.witness.originalSignedWireSha256='f'.repeat(64)},
    x=>{x.proof.originalObserverWitnessCanonicalJson='{"kind":"FORGED"}'},
    x=>{x.proof.originalFourAccountRpcUtf8+=' '},
    x=>{x.destination.cellId[0]='OTHER_DNA'},
    x=>{x.creditEligible=true},
  ]){const x=structuredClone(unsigned);mutate(x);
    assert.notEqual(reviewBindingDigestPrimitive(x),base);
  }
});
test('A4 primitive: unsafe JS numbers, prototype fields and undefined reject',()=>{
  assert.throws(()=>canonicalTypedV2({value:18446744073709551615}),/NONCANONICAL_INTEGER/);
  assert.throws(()=>canonicalTypedV2({value:0.25}),/NONCANONICAL_INTEGER/);
  assert.throws(()=>canonicalTypedV2({value:-0}),/NONCANONICAL_INTEGER/);
  assert.throws(()=>canonicalTypedV2({value:undefined}),/NOT_PLAIN_JSON/);
  assert.throws(()=>canonicalTypedV2(JSON.parse('{"__proto__":1}')),/AMBIGUOUS_JSON_KEYS/);
  assert.throws(()=>canonicalTypedV2({value:BigInt(1)}),/NOT_PLAIN_JSON/);
});
test('A4 primitive is expressly not a typed or authenticated admission',()=>{
  assert.throws(()=>verifyBindingDigestReviewOnly({
    ...unsigned,bindingDigest:reviewBindingDigestPrimitive(unsigned),
  }),/OBS_V2_ABI_REVIEW_REFUSED:(SOURCE_SHAPE|WITNESS_SHAPE|PROOF_SHAPE)/);
});
