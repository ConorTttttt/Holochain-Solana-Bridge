/** Byte-exact A4 digest-primitive vectors; SYNTHETIC, NOT Kit admission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {A4_BINDING_DOMAIN,canonicalTypedV2,reviewBindingDigestPrimitive,
  verifyBindingDigestReviewOnly,assertUniqueRawJsonObjectMembers,
  MAX_RAW_RPC_OR_WITNESS_UTF8_BYTES,MAX_TYPED_BINDING_CANONICAL_UTF8_BYTES} from '../src/v2-binding-review.mjs';

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


test('v2 raw original sidecar: duplicate keys at any depth refuse before JSON.parse',()=>{
  const accepted='{"jsonrpc":"2.0","result":{"value":[{"owner":"x","data":["e30=","base64"]}]}}';
  assert.equal(assertUniqueRawJsonObjectMembers(accepted),true);
  assert.equal(assertUniqueRawJsonObjectMembers(
    '{"text":"{\\"owner\\":2}","result":[1,2]}'),true);
  const rejected=[
    '{"result":{"value":[{"owner":"x","owner":"y"}]}}',
    '{"result":{"value":[{"owner":"x","ow\\u006eer":"y"}]}}',
    '{"result":{"context":{"slot":42,"slot":43}}}',
    '{"result":1,"result":2}',
    '{"result":{"__proto__":1}}',
  ];
  for(const raw of rejected){
    assert.throws(()=>assertUniqueRawJsonObjectMembers(raw),
      /OBS_V2_ABI_REVIEW_REFUSED:RAW_JSON_(DUPLICATE_KEY|PROTOTYPE_KEY)/);
  }
  for(const malformed of ['{"result":}', '{"result":true} trailing']){
    assert.throws(()=>assertUniqueRawJsonObjectMembers(malformed),
      /OBS_V2_ABI_REVIEW_REFUSED:RAW_JSON_/);
  }
});


test('pinned independent v2 primitive canonical positive/negative digest vectors',()=>{
  // Synthetic primitive only: all six values are structurally incomplete and
  // NEVER an admitted source or a Holochain signing capability.
  const fixture=JSON.parse(readFileSync(new URL(
    '../fixtures/v2-binding-primitive-vectors.json',import.meta.url),'utf8'));
  assert.equal(fixture.realKitSourceWitness,false);
  assert.equal(fixture.signedHolochainTransportApproved,false);
  const mutations={
    positive_digest_primitive_not_admission:x=>x,
    negative_nonce_mutation:x=>{x.source.depositNonce='42018'},
    negative_wire_hash_mutation:x=>{x.witness.originalSignedWireSha256='f'.repeat(64)},
    negative_raw_sidecar_byte_change:x=>{x.proof.originalFourAccountRpcUtf8+=' '},
    negative_cellid_mutation:x=>{x.destination.cellId[0]='OTHER_DNA'},
    negative_credit_eligibility_escalation:x=>{x.creditEligible=true},
  };
  assert.deepEqual(fixture.vectors.map(v=>v.name),Object.keys(mutations));
  for(const vector of fixture.vectors){
    const changed=structuredClone(unsigned);
    mutations[vector.name](changed);
    const bytes=Buffer.from(canonicalTypedV2(changed),'utf8');
    assert.equal(bytes.length,vector.canonicalByteLength,vector.name);
    assert.equal(SHA(bytes),vector.canonicalUnsignedSha256,vector.name);
    assert.equal(reviewBindingDigestPrimitive(changed),vector.bindingDigest,vector.name);
    assert.equal(vector.expectedReviewOnlyAdmission,
      'REFUSED_INCOMPLETE_SYNTHETIC_RECORD');
    assert.throws(()=>verifyBindingDigestReviewOnly({
      ...changed,bindingDigest:vector.bindingDigest,
    }),/OBS_V2_ABI_REVIEW_REFUSED:/,vector.name);
  }
});

test('A3/A4 raw proof preimages are bounded by actual UTF-8 bytes, not JS code units',()=>{
  assert.equal(MAX_RAW_RPC_OR_WITNESS_UTF8_BYTES,32*1024*1024);
  assert.equal(MAX_TYPED_BINDING_CANONICAL_UTF8_BYTES,96*1024*1024);
  // A non-ASCII character uses more UTF-8 bytes than JS code units. Testing
  // against raw.length would accidentally accept this oversized sidecar.
  const overLimit='\u0800'.repeat(Math.floor(MAX_RAW_RPC_OR_WITNESS_UTF8_BYTES/3)+1);
  assert.ok(overLimit.length<MAX_RAW_RPC_OR_WITNESS_UTF8_BYTES);
  assert.ok(Buffer.byteLength(overLimit,'utf8')>MAX_RAW_RPC_OR_WITNESS_UTF8_BYTES);
  assert.throws(()=>assertUniqueRawJsonObjectMembers(overLimit),
    /OBS_V2_ABI_REVIEW_REFUSED:RAW_JSON_UNAVAILABLE_OR_TOO_LARGE/);
});
test('A4 review-only canonical binding changes for every source and destination authority field',()=>{
  // These are non-admitting digest *primitives*. The positive full record
  // must come from same-SHA Kit queueVerified + original raw RPC + real CellId;
  // no synthetic vector is allowed to become an authenticated source.
  const variants={
    source:x=>{x.source.genesisHash='DIFFERENT_GENESIS'},
    nonce:x=>{x.source.depositNonce='42018'},
    recipient:x=>{x.source.recipientCore='cd'.repeat(32)},
    amount:x=>{x.source.amountBaseUnits='250001'},
    originalSignedWire:x=>{x.proof.originalObserverWitnessCanonicalJson+=' '},
    containingBlock:x=>{x.witness.containingBlockSha256='b'.repeat(64)},
    rpcMetadata:x=>{x.witness.rpcExecutionMetadataSha256='c'.repeat(64)},
    deploymentEpoch:x=>{x.source.deploymentEpochId='DIFFERENT_VERIFIED_EPOCH'},
    fullCellId:x=>{x.destination.cellId[1]='DIFFERENT_AGENT'},
    signer:x=>{x.destination.cellAgentPubkey='DIFFERENT_SIGNER'},
  };
  const starting=reviewBindingDigestPrimitive(unsigned);
  for(const [name,mutate] of Object.entries(variants)){
    const changed=structuredClone(unsigned);
    mutate(changed);
    const rehashed=reviewBindingDigestPrimitive(changed);
    assert.notEqual(rehashed,starting,name);
    assert.throws(()=>verifyBindingDigestReviewOnly({...changed,bindingDigest:rehashed}),
      /OBS_V2_ABI_REVIEW_REFUSED:/,name);
  }
});
