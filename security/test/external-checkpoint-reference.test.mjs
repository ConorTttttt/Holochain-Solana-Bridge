/**
 * SEC-only reference threat model. NOT the bridge's deployed checkpoint protocol.
 * Ephemeral Ed25519 keypairs simulate independently held verifier keys.
 * No mainnet finality, threshold MPC, durable off-host service or issuance is proved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';

const PREFIX = Buffer.from('HOLOCHAIN-SOLANA-BRIDGE/SEC-CHECKPOINT/v1\0');
const h = value => createHash('sha256').update(value).digest('hex');
const hex64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fields = ['genesis','program','mint','scope','dna','agreement','epoch','sourceCommit',
  'idlSha256','elfSha256','sequence','fromSlot','toSlot','blockRoot','ledgerStateHash','parentDigest'];
function canonical(cp) {
  assert.deepEqual(Object.keys(cp).sort(), [...fields].sort(), 'unexpected/missing checkpoint fields');
  for (const name of ['genesis','program','mint','scope','dna','agreement','epoch','sourceCommit'])
    assert.equal(typeof cp[name] === 'string' && cp[name].length > 0, true, name);
  for (const name of ['idlSha256','elfSha256','blockRoot','ledgerStateHash'])
    assert.ok(hex64(cp[name]), name);
  assert.ok(hex64(cp.parentDigest) || cp.parentDigest === 'GENESIS', 'parent digest');
  for (const name of ['sequence','fromSlot','toSlot'])
    assert.ok(Number.isSafeInteger(cp[name]) && cp[name] >= 0, name);
  assert.ok(cp.sequence > 0 && cp.fromSlot <= cp.toSlot, 'range/sequence');
  return Buffer.concat([PREFIX, Buffer.from(JSON.stringify(fields.map(name => cp[name])))]);
}
const digest = cp => h(canonical(cp));
const stream = cp => JSON.stringify(['genesis','program','mint','scope','dna','agreement','epoch']
  .map(name => cp[name]));
function verifiers(n=5) {
  return Array.from({length:n}, (_,i)=>({id:'offhost-'+i,...generateKeyPairSync('ed25519')}));
}
function attest(cp, witnesses) {
  const message=Buffer.from(digest(cp),'hex');
  return witnesses.map(w => ({id:w.id,signature:sign(null,message,w.privateKey)}));
}
function requireQuorum(cp, votes, witnesses, quorum=3) {
  assert.ok(Array.isArray(votes), 'votes');
  const keys = new Map(witnesses.map(w => [w.id,w.publicKey]));
  const message=Buffer.from(digest(cp),'hex');
  const seen = new Set();
  let valid=0;
  for (const vote of votes) {
    assert.ok(typeof vote?.id === 'string' && Buffer.isBuffer(vote.signature), 'vote format');
    assert.ok(!seen.has(vote.id), 'duplicate signer');
    seen.add(vote.id);
    const key=keys.get(vote.id);
    assert.ok(key && verify(null,message,key,vote.signature), 'bad/unknown signature');
    valid++;
  }
  assert.ok(valid>=quorum,'insufficient independent approvals');
}
function checkpoint(overrides={}) {
  return {genesis:'localnet-genesis-A',program:'custody-program-A',mint:'mint-A',
    scope:'scope-A',dna:'dna-A',agreement:'agreement-A',epoch:'1',sourceCommit:'source-pin-A',
    idlSha256:h('idl'),elfSha256:h('elf'),sequence:1,fromSlot:5,toSlot:10,
    blockRoot:h('blocks-5-10'),ledgerStateHash:h('ledger-at-10'),parentDigest:'GENESIS',
    ...overrides};
}
/** This is a mock of external durable state, NOT the actual Observer ledger. */
class ExternalAnchor {
  constructor(){this.streams=new Map();this.frozen=new Set();}
  accept(cp,votes,witnesses) {
    requireQuorum(cp,votes,witnesses);
    const id=stream(cp), previous=this.streams.get(id), current=digest(cp);
    assert.ok(!this.frozen.has(id),'equivocation freeze');
    if(previous) {
      if(cp.sequence===previous.sequence && current!==previous.digest) {
        this.frozen.add(id);
        throw new Error('equivocation: signed alternate checkpoint');
      }
      assert.equal(cp.sequence,previous.sequence+1,'rollback/replay/sequence gap');
      assert.equal(cp.parentDigest,previous.digest,'incorrect checkpoint parent');
      assert.equal(cp.fromSlot,previous.toSlot+1,'history gap/overlap');
    } else {
      assert.equal(cp.sequence,1,'initial checkpoint sequence');
      assert.equal(cp.parentDigest,'GENESIS','initial checkpoint parent');
    }
    this.streams.set(id,{sequence:cp.sequence,toSlot:cp.toSlot,digest:current});
    return current;
  }
  assertHostView(cp){
    const at=this.streams.get(stream(cp));
    assert.ok(at && at.digest===digest(cp),'host rollback/rewritten local ledger');
  }
}
class GlobalReceiptRegistry {
  constructor(){this.consumed=new Map()}
  reserve(globalOccurrence, destination) {
    assert.ok(typeof globalOccurrence==='string' && globalOccurrence.length>0);
    assert.ok(!this.consumed.has(globalOccurrence),'cross-ledger double acceptance');
    this.consumed.set(globalOccurrence,destination);
  }
}

test('SEC-EXT-01 three distinct independent Ed25519 attestations and domain separation',()=>{
  const keys=verifiers(),cp=checkpoint(),votes=attest(cp,keys.slice(0,3));
  requireQuorum(cp,votes,keys);
  assert.notEqual(digest(cp),h(Buffer.from(JSON.stringify(fields.map(f=>cp[f])))));
  assert.throws(()=>requireQuorum(cp,votes.slice(0,2),keys),/insufficient/);
  assert.throws(()=>requireQuorum(cp,[votes[0],votes[0],votes[1]],keys),/duplicate signer/);
  assert.throws(()=>requireQuorum({...cp,ledgerStateHash:h('attacker')},votes,keys),/bad\/unknown signature/);
  assert.throws(()=>requireQuorum(cp,attest(cp,[verifiers(1)[0],keys[1],keys[2]]),keys),/bad\/unknown signature/);
});
test('SEC-EXT-02 checkpoint range continuity, rollback, parent forgery and equivocation freeze',()=>{
  const keys=verifiers(),anchor=new ExternalAnchor(),a=checkpoint();
  const da=anchor.accept(a,attest(a,keys.slice(0,3)),keys);
  const b=checkpoint({sequence:2,fromSlot:11,toSlot:20,parentDigest:da,
    blockRoot:h('blocks-11-20'),ledgerStateHash:h('ledger-at-20')});
  anchor.accept(b,attest(b,keys.slice(0,3)),keys);
  assert.throws(()=>anchor.accept(a,attest(a,keys.slice(0,3)),keys),/rollback\/replay/);
  const wrongParent=checkpoint({...b,sequence:3,fromSlot:21,toSlot:30,parentDigest:h('fake-parent')});
  assert.throws(()=>anchor.accept(wrongParent,attest(wrongParent,keys.slice(0,3)),keys),/incorrect checkpoint parent/);
  const gap=checkpoint({...b,sequence:3,fromSlot:22,toSlot:30,parentDigest:digest(b)});
  assert.throws(()=>anchor.accept(gap,attest(gap,keys.slice(0,3)),keys),/history gap/);
  const fork=checkpoint({...b,blockRoot:h('alternate-blocks')});
  assert.throws(()=>anchor.accept(fork,attest(fork,keys.slice(0,3)),keys),/equivocation/);
  assert.throws(()=>anchor.accept(checkpoint({...b,sequence:3,fromSlot:21,
    toSlot:30,parentDigest:digest(b)}),[],keys),/insufficient/);
});
test('SEC-EXT-03 host rewrite/rollback is visible only if off-host state survives',()=>{
  const keys=verifiers(),external=new ExternalAnchor(),cp=checkpoint();
  external.accept(cp,attest(cp,keys.slice(0,3)),keys);
  const compromised={...cp,ledgerStateHash:h('host-rewritten-local-ledger')};
  assert.throws(()=>external.assertHostView(compromised),/host rollback/);
  external.assertHostView(cp);
  const lostAnchor=new ExternalAnchor(); // No persistence => security property disappears.
  assert.throws(()=>lostAnchor.assertHostView(cp),/host rollback/);
});
test('SEC-EXT-04 signatures bind source, genesis, IDL/ELF, DNA/agreement and block root',()=>{
  const keys=verifiers(),cp=checkpoint(),votes=attest(cp,keys.slice(0,3));
  for(const field of ['genesis','program','mint','scope','dna','agreement','epoch',
    'sourceCommit','idlSha256','elfSha256','blockRoot','ledgerStateHash','toSlot']) {
    const variant={...cp,[field]:field.endsWith('Sha256') || field.endsWith('Hash') || field==='blockRoot'
      ? h(field+'-tampered') : field==='toSlot' ? 11 : 'forged-'+field};
    assert.throws(()=>requireQuorum(variant,votes,keys),/bad\/unknown signature/,field);
  }
});
test('SEC-EXT-05 two valid isolated ledgers can double-accept without shared global consumption',()=>{
  const occurrence='genesis-A/program-A/receipt-A/nonce-7/tx-A/ix-0';
  const isolatedA=new Set(),isolatedB=new Set();
  assert.equal(isolatedA.has(occurrence),false);isolatedA.add(occurrence);
  assert.equal(isolatedB.has(occurrence),false);isolatedB.add(occurrence);
  assert.equal(isolatedA.has(occurrence)&&isolatedB.has(occurrence),true);
  const offHost=new GlobalReceiptRegistry();
  offHost.reserve(occurrence,'dna-A/agreement-A');
  assert.throws(()=>offHost.reserve(occurrence,'dna-B/agreement-B'),/cross-ledger double acceptance/);
});
