#!/usr/bin/env node
// NOT invoked by CI. Legacy a0-mutation-boundary and installer remain unchanged.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,constants} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {hostname} from 'node:os';
import {request as httpsRequest} from 'node:https';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {authorizeOnce,parseCanonical,canonical,digest,requestDigest} from '../../demo/installation/authorization.mjs';
const POLICY='/etc/hsc-audit-installation/authority.json';
function protectedPath(path){
 assert.equal(realpathSync(path),resolve(path),'SYMLINK_REFUSED');
 for(let p=resolve(path);;p=dirname(p)){
  const st=lstatSync(p);assert.equal(st.uid,0,'TRUST_ROOT_NOT_ADMIN_OWNED');assert.equal(st.mode&0o022,0,'TRUST_ROOT_WRITABLE');
  if(p==='/')break;
 }
}
function redeem(url,data){
 assert.equal(new URL(url).protocol,'https:','BROKER_REQUIRES_TLS');
 return new Promise((accept,reject)=>{
  const body=Buffer.from(canonical(data)+'\n');
  const req=httpsRequest(url,{method:'POST',timeout:10000,headers:{'content-type':'application/json','content-length':body.length}},res=>{
   if(res.statusCode!==200){res.resume();reject(Error('BROKER_DENIED_OR_UNAVAILABLE'));return}
   const chunks=[];let length=0;res.on('data',b=>{length+=b.length;if(length>65536){req.destroy(Error('BROKER_RESPONSE_TOO_LARGE'));return}chunks.push(b)});
   res.on('end',()=>{try{accept(parseCanonical(Buffer.concat(chunks)))}catch(e){reject(e)}});
  });req.on('timeout',()=>req.destroy(Error('BROKER_TIMEOUT_NO_RETRY')));req.on('error',()=>reject(Error('BROKER_UNAVAILABLE_NO_RETRY')));req.end(body);
 });
}
async function main(){
 assert.deepEqual(process.argv.slice(2).filter(x=>x.startsWith('--')),[],'NO_APPROVAL_FLAGS');
 assert.equal(process.argv.length,4,'Usage: execute-approved.mjs <canonical-request> <signed-grant>');
 assert.ok(process.getuid()>0,'ROOT_EXECUTION_REFUSED');
 protectedPath(POLICY);
 const policy=JSON.parse(readFileSync(POLICY));
 assert.equal(policy.schema,'hsc-install-authority-v1');assert.equal(policy.executorUid,process.getuid(),'WRONG_EXECUTOR_UID');
 assert.equal(policy.hostFingerprint,digest(readFileSync('/etc/machine-id')),'WRONG_HOST');
 const request=parseCanonical(readFileSync(process.argv[2]));
 assert.equal(request.schema,'hsc-exact-install-request-v1');assert.equal(request.requestState,'FROZEN_FOR_INDEPENDENT_REVIEW');
 assert.equal(request.baselineSourceCommit,'03b567a992bcd31930b49d08f594a4ef7ff58680');
 assert.equal(request.originalBuildArtifactId,14136370324);
 assert.equal(request.hostFingerprint,policy.hostFingerprint,'REQUEST_TARGET_HOST_MISMATCH');
 assert.equal(request.executorId,policy.executorId);assert.equal(requestDigest(request),policy.approvedRequestDigest);
 assert.equal(request.operation,'install-only');
 assert.equal(request.creditEligible,false);assert.equal(request.independentConsensusVerified,false);
 assert.equal(request.spendableBaseUnits,'0');assert.equal(request.withdrawalAuthorized,false);
 assert.equal(request.dnaHash,'uhC0kCn-ld2PREMKI6nDVq4XssTKHgs8QHOszCC3a32pXCZjowgXt');assert.deepEqual(request.allowSignedZomeCalls,false);
 assert.deepEqual(request.allowCapabilityGrants,false);assert.equal(request.v2TransportApproved,false);
 // Every executable/input/code path is independently provisioned read-only by
 // the administrator, not taken on trust from a signed JSON boolean.
 for(const [path,sha] of Object.entries(request.protectedFiles)){
  protectedPath(path);assert.equal(digest(readFileSync(path)),sha,'PROTECTED_INPUT_DRIFT');
 }
 for(const path of [realpathSync(process.argv[1]),realpathSync(new URL('../../demo/installation/authorization.mjs',import.meta.url))])
  assert.equal(request.protectedFiles[path],digest(readFileSync(path)),'EXECUTOR_CODE_NOT_BOUND');
 const tools=request.runtimeExecutables;
 assert.deepEqual(Object.keys(tools).sort(),['hc','holochain','lair-keystore']);
 for(const p of Object.values(tools))assert.ok(request.protectedFiles[p],'UNBOUND_RUNTIME_EXECUTABLE');
 assert.equal(realpathSync(process.execPath),request.nodeExecutable,'UNAPPROVED_NODE_EXECUTABLE');
 assert.equal(process.version,request.nodeVersion,'UNAPPROVED_NODE_VERSION');
 assert.ok(request.protectedFiles[request.nodeExecutable],'UNBOUND_NODE_EXECUTABLE');
 const hc=tools.hc;assert.ok(request.protectedFiles[hc],'UNBOUND_HC_BINARY');
 assert.equal(spawnSync(hc,['--version'],{encoding:'utf8'}).stdout.trim(),request.runtimeVersions.hc,'WRONG_HC_VERSION');
 assert.ok(request.protectedFiles[request.dnaPath],'UNBOUND_DNA');
 assert.equal(spawnSync(hc,['dna','hash',request.dnaPath],{encoding:'utf8'}).stdout.trim(),request.dnaHash,'ORIGINAL_DNA_ID_DRIFT');
 const root='/var/lib/hsc-audit-installation/attempts/'+request.installationId;
 assert.match(request.installationId,/^[a-f0-9]{32}$/);assert.equal(request.runtimeRoot,root);
 const happ=request.happPath;
 assert.equal(request.protectedFiles[happ],'a68826c9f5e6bc007c5e22cb34e4a856265ec07be78b624a26efd433e9d98050','ONLY_ORIGINAL_HAPP_ALLOWED');
 assert.equal(request.protectedFiles[request.dnaPath],'a9bc44fb3477ea4d056f420c821a34cb88a8b0517297da1b4570d02f75fec627','ONLY_ORIGINAL_DNA_ALLOWED');assert.ok(request.protectedFiles[happ],'UNBOUND_HAPP');
 assert.equal(request.appId,'hsc-audit-demo-readonly');
 const expected=['sandbox','--piped','generate','--app-id',request.appId,'--root',root,'--directories','agent-a',happ,'network','mem'];
 assert.deepEqual(request.argv,expected,'UNAPPROVED_COMMAND');
 assert.equal(request.keystorePolicy,'EXTERNAL_LAIR_GENERATED_BY_HC_NO_IN_PROCESS_FALLBACK');
 const envelope=parseCanonical(readFileSync(process.argv[3]));
 const receipt=await authorizeOnce({envelope,request,policy,now:Date.now(),clock:Date.now,redeem:data=>redeem(policy.brokerUrl,data)});
 // Fail closed after consumption. Never retry after crash or ambiguous result.
 mkdirSync(root,{mode:0o700});
 const journal=openSync(root+'/consumed.json',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);
 writeSync(journal,canonical({state:'CONSUMED_EXECUTION_UNCERTAIN',receipt,host:hostname()})+'\n');fsyncSync(journal);closeSync(journal);
 const dir=openSync(root,constants.O_RDONLY);fsyncSync(dir);closeSync(dir);
 const log=openSync(root+'/private-install.log',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);
 // Passphrase never appears in argv, environment, source or public evidence.
 const secret=randomBytes(32).toString('hex');
 const pass=openSync(root+'/lair-passphrase',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);writeSync(pass,secret);fsyncSync(pass);closeSync(pass);
 const result=spawnSync(hc,expected,{cwd:root,env:{PATH:[...new Set(Object.values(tools).map(dirname))].join(':')+':/usr/bin:/bin',LANG:'C.UTF-8'},input:secret,stdio:['pipe',log,log],timeout:300000,killSignal:'SIGINT'});
 closeSync(log);
 assert.equal(result.status,0,'INSTALLATION_UNCERTAIN_DO_NOT_RETRY');
 console.log('INSTALL_COMMAND_RETURNED_SUCCESS__ADMIN_IDENTITY_NOT_YET_AUTHENTICATED');
}
main().catch(()=>{console.error('INSTALLATION_REFUSED_OR_UNCERTAIN: inspect private operator journal; never retry blindly');process.exitCode=3});
