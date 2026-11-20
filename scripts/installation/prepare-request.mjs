#!/usr/bin/env node
// File preparation only: no signing keys, keystore, conductor or Holochain mutation.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {canonical,digest,requestDigest,parseCanonical} from '../../demo/installation/authorization.mjs';
const args=process.argv.slice(2);
if(args[0]==='freeze-host'){
 assert.equal(args.length,3);const r=parseCanonical(readFileSync(args[1]));
 assert.equal(r.requestState,'CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED');
 r.hostFingerprint=digest(readFileSync('/etc/machine-id'));r.requestState='FROZEN_FOR_INDEPENDENT_REVIEW';
 writeFileSync(args[2],canonical(r)+'\n',{mode:0o600,flag:'wx'});
 console.log('FROZEN_REQUEST_DIGEST '+requestDigest(r));
}else{
 assert.equal(args.length,0,'Use no arguments for CI preparation or freeze-host <draft> <new-output>');
 const root='work/installation-originals/';
 const inventory=JSON.parse(readFileSync(root+'verified-inventory.json'));
 const tools=JSON.parse(readFileSync(root+'runtime-inventory.json'));
 const executorSourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const baselineSourceCommit=inventory.sourceCommit;
 assert.equal(baselineSourceCommit,'03b567a992bcd31930b49d08f594a4ef7ff58680');
 const codeRoot='/opt/hsc-audit-installation/'+executorSourceCommit+'/';
 const input='/var/lib/hsc-audit-installation/inputs/'+baselineSourceCommit+'/';
 const protectedFiles={};
 const nodeExecutable=codeRoot+'runtime/node';
 protectedFiles[nodeExecutable]=digest(readFileSync(process.execPath));
 for(const file of ['scripts/installation/execute-approved.mjs','demo/installation/authorization.mjs'])
  protectedFiles[codeRoot+file]=digest(readFileSync(file));
 for(const tool of Object.values(tools))protectedFiles[tool.path]=tool.sha256;
 const happPath=input+'holochain_solana_audit_demo.happ',dnaPath=input+'holochain_solana_audit_demo.dna';
 for(const file of ['holochain_solana_audit_demo.happ','holochain_solana_audit_demo.dna'])
  protectedFiles[input+file]=inventory.artifacts['holochain/demo/'+file].sha256;
 const installationId=digest(Buffer.from(executorSourceCommit+baselineSourceCommit)).slice(0,32);
 const runtimeRoot='/var/lib/hsc-audit-installation/attempts/'+installationId;
 const request={schema:'hsc-exact-install-request-v1',requestState:'CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED',
  nodeExecutable,nodeVersion:process.version,
  operation:'install-only',executorId:'hsc-disposable-installation-v1',executorSourceCommit,baselineSourceCommit,
  originalBuildArtifactId:14136370324,originalBuildArchiveSha256:'5b28358b65c18eceda3f7162dae20d60c2c9f55b83f4dcbed7561d257a0c9f06',
  inventorySha256:digest(readFileSync(root+'verified-inventory.json')),dnaHash:inventory.dnaHash,
  appId:'hsc-audit-demo-readonly',installationId,runtimeRoot,happPath,dnaPath,hostFingerprint:null,
  protectedFiles,runtimeExecutables:Object.fromEntries(Object.entries(tools).map(([n,t])=>[n,t.path])),
  runtimeVersions:Object.fromEntries(Object.entries(tools).map(([n,t])=>[n,t.version])),
  keystorePolicy:'EXTERNAL_LAIR_GENERATED_BY_HC_NO_IN_PROCESS_FALLBACK',
  allowedMutations:['private passphrase creation after one-use authorization','external Lair/agent generation by hc','install exactly original hApp','cell genesis and hc generate lifecycle only'],
  argv:['sandbox','--piped','generate','--app-id','hsc-audit-demo-readonly','--root',runtimeRoot,'--directories','agent-a',happPath,'network','mem'],
  allowSignedZomeCalls:false,allowCapabilityGrants:false,v2TransportApproved:false,
  futureAgentPubKey:null,futureCellId:null,externalLairIdentityVerified:false,
  creditEligible:false,independentConsensusVerified:false,spendableBaseUnits:'0',withdrawalAuthorized:false};
 writeFileSync(root+'authorization-request.json',canonical(request)+'\n');
 console.log('::notice title=Installation request::'+canonical(request));
}
