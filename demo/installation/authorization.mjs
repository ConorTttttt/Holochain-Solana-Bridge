// Separate administrative trust domain; no environment/approval flags grant authority.
import assert from 'node:assert/strict';
import {createHash,createPublicKey,randomBytes,verify} from 'node:crypto';
export const digest=b=>createHash('sha256').update(b).digest('hex');
export function canonical(x){
 if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
 if(typeof x==='number'){assert.ok(Number.isSafeInteger(x),'UNSAFE_NUMBER');return String(x)}
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 assert.ok(x&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x)),'INVALID_OBJECT');
 const keys=Object.keys(x).sort();assert.ok(!keys.some(k=>['__proto__','constructor','prototype'].includes(k)),'UNSAFE_KEY');
 return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
export function parseCanonical(bytes){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const x=JSON.parse(text);assert.equal(text,canonical(x)+'\n','NONCANONICAL_OR_DUPLICATE_JSON');return x}
export const requestDigest=x=>digest(Buffer.from('HSC/installation-request/v1\0'+canonical(x)));
export const signedBytes=(purpose,payload)=>Buffer.from('HSC/'+purpose+'/v1\0'+canonical(payload));
function fields(x,keys){assert.ok(x&&typeof x==='object');assert.deepEqual(Object.keys(x).sort(),keys.slice().sort(),'UNEXPECTED_FIELDS')}
function signature(envelope,key,purpose){
 fields(envelope,['payload','signature']);const pub=createPublicKey(key);assert.equal(pub.asymmetricKeyType,'ed25519');
 assert.equal(typeof envelope.signature,'string');const b=Buffer.from(envelope.signature,'base64');
 assert.equal(b.length,64,'INVALID_SIGNATURE');assert.equal(b.toString('base64'),envelope.signature,'INVALID_SIGNATURE');
 assert.ok(verify(null,signedBytes(purpose,envelope.payload),pub,b),'UNAUTHORIZED_SIGNATURE');
}
export function verifyGrant(envelope,request,policy,now){
 assert.ok(envelope,'MISSING_APPROVAL');
 const p=envelope.payload;
 fields(p,['schema','keyId','nonce','notBefore','expiresAt','requestDigest','executorId','operation']);
 assert.equal(p.schema,'hsc-install-grant-v1');assert.equal(p.operation,'install-only','OPERATION_REFUSED');
 assert.match(p.nonce,/^[a-f0-9]{64}$/,'INVALID_NONCE');
 assert.ok(Number.isSafeInteger(now)&&Number.isSafeInteger(p.notBefore)&&Number.isSafeInteger(p.expiresAt));
 assert.ok(p.notBefore<=now&&now<p.expiresAt,'EXPIRED_OR_NOT_YET_VALID');
 assert.ok(p.expiresAt>p.notBefore&&p.expiresAt-p.notBefore<=15*60*1000,'APPROVAL_TTL_REFUSED');
 assert.equal(p.executorId,policy.executorId,'WRONG_EXECUTOR');
 assert.equal(p.requestDigest,requestDigest(request),'MISMATCHED_REQUEST');
 assert.equal(p.requestDigest,policy.approvedRequestDigest,'REQUEST_NOT_IN_ADMINISTRATIVE_ALLOWLIST');
 const key=Object.hasOwn(policy.approverKeys,p.keyId)?policy.approverKeys[p.keyId]:null;assert.ok(key,'UNAUTHORIZED_APPROVER');
 signature(envelope,key,'install-approval');return p;
}
// The external broker must atomically consume BOTH nonce and requestDigest and
// retain them durably across host rollback/restart. A local journal is not authority.
export async function authorizeOnce({envelope,request,policy,now,redeem,clock=()=>now}){
 const p=verifyGrant(envelope,request,policy,now);
 const challenge=randomBytes(32).toString('hex');
 const grantDigest=digest(Buffer.from(canonical(envelope)));
 const reply=await redeem({approval:envelope,requestDigest:p.requestDigest,grantDigest,challenge,executorId:policy.executorId});
 signature(reply,policy.brokerPublicKey,'install-consumption');
 verifyGrant(envelope,request,policy,clock());
 const r=reply.payload;fields(r,['schema','nonce','requestDigest','grantDigest','challenge','executorId','consumed','expiresAt']);
 assert.equal(r.schema,'hsc-install-consumption-v1');assert.equal(r.nonce,p.nonce);
 assert.equal(r.requestDigest,p.requestDigest);assert.equal(r.grantDigest,grantDigest);
 assert.equal(r.challenge,challenge,'REPLAYED_BROKER_RECEIPT');assert.equal(r.executorId,policy.executorId);
 assert.equal(r.consumed,true,'REPLAYED_OR_DENIED_APPROVAL');
 assert.ok(Number.isSafeInteger(r.expiresAt)&&clock()<r.expiresAt&&r.expiresAt<=p.expiresAt,'EXPIRED_BROKER_RECEIPT');
 return reply;
}
