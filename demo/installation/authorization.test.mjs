import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {authorizeOnce,verifyGrant,requestDigest,signedBytes,canonical,parseCanonical} from './authorization.mjs';
const now=Date.now();
function setup(){
 const approver=generateKeyPairSync('ed25519'),broker=generateKeyPairSync('ed25519');
 const request={schema:'TEST_ONLY_INSTALL_REQUEST',operation:'install-only',sourceCommit:'03b567a992bcd31930b49d08f594a4ef7ff58680'};
 const pem=k=>k.export({type:'spki',format:'pem'});
 const policy={executorId:'TEST_ONLY_EXECUTOR',approvedRequestDigest:requestDigest(request),approverKeys:{independent:pem(approver.publicKey)},brokerPublicKey:pem(broker.publicKey)};
 const pack=(payload,key,purpose)=>({payload,signature:sign(null,signedBytes(purpose,payload),key).toString('base64')});
 const payload={schema:'hsc-install-grant-v1',keyId:'independent',nonce:'a'.repeat(64),notBefore:now-1000,expiresAt:now+30000,requestDigest:requestDigest(request),executorId:policy.executorId,operation:'install-only'};
 const grant=pack(payload,approver.privateKey,'install-approval');
 let claims=0;const consumed=new Set();
 const redeem=async data=>{
  claims++;assert.ok(!consumed.has(data.requestDigest),'BROKER_REPLAY_REFUSED');consumed.add(data.requestDigest);
  return pack({schema:'hsc-install-consumption-v1',nonce:data.approval.payload.nonce,requestDigest:data.requestDigest,grantDigest:data.grantDigest,challenge:data.challenge,executorId:data.executorId,consumed:true,expiresAt:now+20000},broker.privateKey,'install-consumption');
 };
 return {request,policy,grant,redeem,pack,approver,broker,claims:()=>claims};
}
test('synthetic independently signed grant and live one-use receipt authenticate; replay denied externally',async()=>{
 const f=setup();await authorizeOnce({...f,envelope:f.grant,now});
 await assert.rejects(authorizeOnce({...f,envelope:f.grant,now}),/BROKER_REPLAY_REFUSED/);
 assert.equal(f.claims(),2);
});
for(const [name,change] of Object.entries({
 missing:f=>{f.grant=null},expired:f=>{f.grant.payload.expiresAt=now-1},future:f=>{f.grant.payload.notBefore=now+1},
 unauthorized:f=>{f.grant.payload.keyId='caller'},mismatched:f=>{f.request.sourceCommit='0'.repeat(40)},
 wrongExecutor:f=>{f.grant.payload.executorId='attacker'},wrongOperation:f=>{f.grant.payload.operation='signed-zome-call'},
 tampered:f=>{f.grant.signature=Buffer.alloc(64).toString('base64')},flag:f=>{f.grant={approved:true}},
 extraField:f=>{f.grant.payload.approved=true},tooLong:f=>{f.grant.payload.expiresAt=now+3600000}
}))test(name+' approval refuses before contacting broker',async()=>{
 const f=setup();change(f);await assert.rejects(authorizeOnce({...f,envelope:f.grant,now}));assert.equal(f.claims(),0);
});
test('a different signing key cannot impersonate a trusted approver',()=>{
 const f=setup(),attacker=generateKeyPairSync('ed25519');const forged=f.pack(f.grant.payload,attacker.privateKey,'install-approval');
 assert.throws(()=>verifyGrant(forged,f.request,f.policy,now),/UNAUTHORIZED_SIGNATURE/);
});
test('a broker timeout, unsigned receipt, stale challenge or refusal never authorizes execution',async()=>{
 for(const mode of ['timeout','unsigned','challenge','denied','expired']){
  const f=setup();const redeem=async data=>{
   if(mode==='timeout')throw Error('TIMEOUT');const r=await f.redeem(data);
   if(mode==='unsigned'){r.signature=Buffer.alloc(64).toString('base64');return r}
   if(mode==='challenge')r.payload.challenge='b'.repeat(64);
   if(mode==='denied')r.payload.consumed=false;if(mode==='expired')r.payload.expiresAt=now;
   return f.pack(r.payload,f.broker.privateKey,'install-consumption');
  };await assert.rejects(authorizeOnce({...f,envelope:f.grant,now,redeem}));
 }
});
test('expiration while broker responds refuses even after successful consumption',async()=>{
 const f=setup();await assert.rejects(authorizeOnce({...f,envelope:f.grant,now,clock:()=>now+60000}),/EXPIRED/);
});
test('raw duplicate-key and unknown approval format are rejected',()=>{
 assert.throws(()=>parseCanonical(Buffer.from('{"a":1,"a":2}\n')));assert.equal(parseCanonical(Buffer.from(canonical({a:1})+'\n')).a,1);
});
test('CLI ignores approval environment variables and cannot run without separately provisioned trust root',()=>{
 const p=spawnSync(process.execPath,['scripts/installation/execute-approved.mjs','absent-request','absent-grant'],{encoding:'utf8',env:{...process.env,A0_APPROVED:'true',INSTALL_APPROVED:'true'}});
 assert.equal(p.status,3);assert.match(p.stderr,/INSTALLATION_REFUSED_OR_UNCERTAIN/);
});
