#!/usr/bin/env node
/** A1 integration-only: derive a DNA BUILD INPUT from the executed SOL source.
 * NEVER change the tracked A4 YAML, grant capabilities, sign or call Holochain.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DENIAL,verifyExecutedSourceArtifact} from './a0-preauthorization-runner.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const hex40=/^[0-9a-f]{40}$/,hex64=/^[0-9a-f]{64}$/;
const keys=['genesisHash','program','mint','holochainScope'];
function denied(o,label){
  for(const [k,v] of Object.entries(DENIAL))
    assert.equal(o?.[k],v,'ECONOMIC_DENIAL_DRIFT:'+label+':'+k);
}
function yamlProps(yaml){
  const m=new Map();
  for(const line of yaml.split(/\r?\n/)){
    const hit=/^    (genesisHash|program|mint|holochainScope):\s*['"]?([^'"\s]+)['"]?\s*$/.exec(line);
    if(!hit)continue;
    assert.ok(!m.has(hit[1]),'DUPLICATE_DNA_PROPERTY:'+hit[1]);
    m.set(hit[1],hit[2]);
  }
  assert.deepEqual([...m.keys()].sort(),[...keys].sort(),'MISSING_DNA_PROPERTIES');
  return Object.fromEntries(m);
}
export function sourceBoundDna({template,domain,witness,producerSha,
  consumerSha,manifestSha256,replaySha256}){
  assert.match(producerSha??'',hex40,'PRODUCER_SHA_INVALID');
  assert.match(consumerSha??'',hex40,'CONSUMER_SHA_INVALID');
  assert.equal(producerSha,consumerSha,'FRESH_PRODUCER_CONSUMER_SHA_MISMATCH');
  assert.match(manifestSha256??'',hex64,'MANIFEST_HASH_INVALID');
  assert.match(replaySha256??'',hex64,'REPLAY_HASH_INVALID');
  assert.equal(domain?.sourceCommitSha,producerSha,'ORIGINAL_PRODUCER_SHA_MISMATCH');
  assert.equal(domain?.historyComplete,false,'ORIGINAL_HISTORY_FALSE_PROMOTION');
  assert.equal(domain?.initializedScopeHex,domain?.scopeHex,'INITIALIZED_SCOPE_MISMATCH');
  assert.match(domain?.scopeHex??'',hex64,'INVALID_SIGNED_SCOPE');
  for(const key of ['genesisHash','programId','mint'])
    assert.match(domain?.[key]??'',/^[1-9A-HJ-NP-Za-km-z]{32,64}$/,'INVALID_SOURCE_'+key);
  denied(domain,'original-source');
  denied(witness,'reviewed-witness');
  denied(witness?.source,'reviewed-source');
  denied(witness?.proof,'reviewed-proof');
  assert.equal(witness?.kind,'solana-observation-demo-v2','REVIEWED_KIND_MISMATCH');
  assert.equal(witness?.source?.codeVersion,consumerSha,'REVIEWED_CONSUMER_SHA_MISMATCH');
  assert.equal(witness?.source?.signature,domain?.transactions?.deposit?.signature,
    'ORIGINAL_DEPOSIT_SIGNATURE_MISMATCH');
  assert.equal(witness?.source?.holochainScope,domain.scopeHex,'SIGNED_SCOPE_MISMATCH');
  assert.equal(witness?.source?.recipientCore,domain.recipientCoreHex,'SIGNED_RECIPIENT_MISMATCH');
  assert.equal(witness?.source?.depositNonce,domain.nonce,'SIGNED_NONCE_MISMATCH');
  assert.equal(witness?.source?.amountBaseUnits,domain.amountBaseUnits,'SIGNED_AMOUNT_MISMATCH');
  assert.equal(witness?.proof?.historyComplete,false,'REVIEWED_HISTORY_FALSE_PROMOTION');
  assert.ok(domain?.transactions?.initialize?.signature,'ORIGINAL_INITIALIZE_MISSING');
  assert.ok(domain?.transactions?.refund?.signature,'ORIGINAL_REFUND_MISSING');
  assert.match(template,/^    demoOnly: true\s*$/m,'NOT_AUDIT_ONLY_DNA');
  assert.match(template,/^name: holochain_solana_audit_demo\s*$/m,'NOT_OWN_DNA');
  const recorded=yamlProps(template);
  const expected={genesisHash:domain.genesisHash,program:domain.programId,
    mint:domain.mint,holochainScope:domain.scopeHex};
  const prefixPos=template.indexOf('manifest_version:');
  assert.ok(prefixPos>=0 && /^(\s*#.*\n|\s*\n)*$/.test(template.slice(0,prefixPos)),
    'UNSAFE_TEMPLATE_PREFIX');
  let yaml=template.slice(prefixPos);
  for(const key of keys){
    const pattern=new RegExp('^    '+key+':[^\r\n]*$','gm');
    assert.equal((yaml.match(pattern)||[]).length,1,'NOT_ONE_SOURCE_PROPERTY:'+key);
    yaml=yaml.replace(pattern,'    '+key+': '+(key==='holochainScope'?"'"+expected[key]+"'":expected[key]));
  }
  assert.equal((yaml.match(/^  network_seed:[^\r\n]*$/gm)||[]).length,1,
    'NOT_ONE_NETWORK_SEED');
  const networkSeed='hsc-fresh-source-'+hash(Buffer.from([
    'HSC/A1/audit-only-source-domain/v1',producerSha,manifestSha256,
    domain.genesisHash,domain.programId,domain.mint,domain.scopeHex,
    domain.transactions.initialize.signature,domain.transactions.deposit.signature
  ].join('\0'),'utf8')).slice(0,32);
  yaml=yaml.replace(/^  network_seed:[^\r\n]*$/m,'  network_seed: '+networkSeed);
  yaml='# GENERATED CI BUILD INPUT only. Original A4 YAML remains untouched.\n'+
    '# Original disposable source SHA: '+producerSha+'\n'+
    '# Original SOL manifest SHA-256: '+manifestSha256+'\n'+
    '# No runtime, signing, finality, credit or withdrawal approval.\n'+yaml;
  assert.deepEqual(yamlProps(yaml),expected,'GENERATED_SOURCE_PROPERTY_DRIFT');
  return {yaml,report:{
    schema:'hsc-a1-execution-bound-dna-v1',
    policy:'EXECUTION_GENERATED_SOURCE_TO_NEW_DISPOSABLE_DNA',
    evidenceGrade:'ORIGINAL_SAME_SHA_REPLAY_POSTCONDITION_NOT_CONSENSUS',
    producerSourceCommitSha:producerSha,consumerCodeCommitSha:consumerSha,
    originalManifestSha256:manifestSha256,replayArtifactSha256:replaySha256,
    originalA4TemplateSha256:hash(template),
    originalA4Properties:recorded,generatedSourceProperties:expected,
    originalA4MismatchKeys:keys.filter(k=>recorded[k]!==expected[k]),
    networkSeed,generatedYamlSha256:hash(yaml),
    originalSignedInitializationSignature:domain.transactions.initialize.signature,
    originalSignedDepositSignature:domain.transactions.deposit.signature,
    originalSignedRefundSignature:domain.transactions.refund.signature,
    reviewedWitnessDigest:witness.witnessDigest,
    sourceAccountHistoryComplete:false,compiled:false,installed:false,
    independentApproval:false,actionHash:null,readbackVerified:false,
    transportRefusal:'REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED',
    decisions:{A0:'BLOCKED_NOT_ACCEPTED',B1:'BLOCKED_HISTORY_INCOMPLETE',
      B2:'BLOCKED_PUBLISHED_UNYT_UNAPPROVED',C:'NO_GO_ECONOMIC'},
    ...DENIAL
  }};
}
function main(){
  const i=process.argv.indexOf('--out');
  const out=i>=0?process.argv[i+1]:null;
  assert.ok(out?.endsWith('.yaml'),'OUTPUT_YAML_REQUIRED');
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  assert.equal(sha,process.env.A0_EXPECTED_SHA,'IMMUTABLE_CI_SOURCE_MISMATCH');
  const file='ci-artifacts/observer-fresh-domain-reviewed-v2-original-signed-localnet.json';
  const bytes=readFileSync(file);
  const line=readFileSync(file+'.sha256','utf8').trim();
  const check=/^([a-f0-9]{64})\s{2}(\S+)$/.exec(line);
  assert.equal(check?.[2],basename(file),'REPLAY_CHECKSUM_FILENAME');
  const item=JSON.parse(bytes);
  verifyExecutedSourceArtifact(item,sha,bytes,check[1]);
  const manifestBytes=readFileSync('target/localnet-evidence/demo-source-domain.json');
  const manifest=JSON.parse(manifestBytes),manifestSha256=hash(manifestBytes);
  const index=readFileSync('target/localnet-evidence/evidence-manifest.sha256','utf8');
  assert.ok(index.split(/\r?\n/).some(x=>{
    const row=/^([a-f0-9]{64})\s+\*?(?:\.\/)?demo-source-domain\.json$/.exec(x);
    return row?.[1]===manifestSha256;
  }),'SOURCE_MANIFEST_NOT_IN_ORIGINAL_ARCHIVE');
  assert.deepEqual(item.originalSolanaDomain,manifest,
    'REPLAY_ORIGINAL_SOURCE_MANIFEST_RELABELED');
  const path='holochain/demo/dna.yaml',template=readFileSync(path,'utf8');
  const provenance=JSON.parse(readFileSync('ci-integration-snapshot.json','utf8'));
  const gitBlob=execFileSync('git',['hash-object','--',path],{encoding:'utf8'}).trim();
  assert.equal(provenance.fileProvenance?.[path]?.sha,gitBlob,'UNREVIEWED_A4_TEMPLATE_BLOB');
  const {yaml,report}=sourceBoundDna({template,domain:manifest,
    witness:item.observerReviewedWitnessV2,producerSha:manifest.sourceCommitSha,
    consumerSha:sha,manifestSha256,replaySha256:check[1]});
  report.originalSignedDepositWireSha256=item.originalSignedTransactionSha256;
  report.originalA4TemplateGitBlob=gitBlob;
  const reportPath=out.replace(/\.yaml$/,'.report.json');
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,yaml,{mode:0o600});
  writeFileSync(out+'.sha256',report.generatedYamlSha256+'  '+basename(out)+'\n',{mode:0o600});
  const reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
  writeFileSync(reportPath,reportBytes,{mode:0o600});
  writeFileSync(reportPath+'.sha256',hash(reportBytes)+'  '+basename(reportPath)+'\n',{mode:0o600});
  console.log(JSON.stringify({policy:report.policy,producer:report.producerSourceCommitSha,
    consumer:report.consumerCodeCommitSha,dnaBuildInputSha256:report.generatedYamlSha256,
    originalA4MismatchKeys:report.originalA4MismatchKeys,
    compiled:false,installed:false,signed:false,report:reportPath,...DENIAL}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
