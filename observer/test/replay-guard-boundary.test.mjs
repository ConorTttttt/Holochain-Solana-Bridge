/**
 * PR #61 regression: only explicit archived replay inside the Node test runner
 * may supply a fetchFn to queueVerified. This is an internal test boundary,
 * NOT a public witness importer, authentication shortcut, or RPC quorum.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DemoOutbox} from '../src/demo-outbox.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const expected={
  genesisHash:'1'.repeat(32),program:'1'.repeat(32),
  mint:'1'.repeat(32),holochainScope:'07'.repeat(32),
  idlSha256:sha('{}'),sourceCommitSha:'f'.repeat(40),
};
const destination={
  dnaHash:'TEST_DNA_NOT_INSTALLED',agentKey:'TEST_AGENT_NOT_INSTALLED',
  appId:'ci-replay-guard-only',role:'audit',zome:'solana_audit',
};
const args={
  ledger:null,rpcUrls:['http://127.0.0.1:8899','http://127.0.0.1:9900'],
  signature:'1'.repeat(64),receiptAddress:'1'.repeat(32),
  expected:{program:expected.program,mint:expected.mint,
    config:'1'.repeat(32),vault:'1'.repeat(32),scope:expected.holochainScope},
  idlText:'{}',codeVersion:expected.sourceCommitSha,
  fetchFn:async()=>{throw Error('TEST_ONLY_ARCHIVED_FETCH_REACHED')},
};
async function withOutbox(t,fn){
  const dir=mkdtempSync(join(tmpdir(),'obs-replay-boundary-'));
  const outbox=new DemoOutbox(join(dir,'outbox.json'),{expected,destination});
  try{return await fn(outbox)}
  finally{outbox.close();rmSync(dir,{recursive:true,force:true})}
}
function withOptIn(value,fn){
  const old=process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
  if(value===undefined)delete process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
  else process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY=value;
  return Promise.resolve().then(fn).finally(()=>{
    if(old===undefined)delete process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
    else process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY=old;
  });
}

test('archived fetch injection is rejected without explicit opt-in in test child',async t=>{
  assert.equal(process.env.NODE_TEST_CONTEXT,'child-v8',
    'test must execute in Node --test child, not main production process');
  await withOutbox(t,async outbox=>
    withOptIn(undefined,async()=>
      assert.rejects(outbox.queueVerified(args),
        /OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN/)));
});
test('explicit replay opt-in reaches fetch only inside test runner; cannot admit unverified JSON',async t=>{
  assert.equal(process.env.NODE_TEST_CONTEXT,'child-v8');
  await withOutbox(t,async outbox=>
    withOptIn('1',async()=>{
      await assert.rejects(outbox.queueVerified(args),
        /TEST_ONLY_ARCHIVED_FETCH_REACHED/);
      assert.deepEqual(outbox.status.rows,{},
        'an injected archive fetch error must not produce durable source admission');
      await assert.rejects(outbox.queueVerified({
        ...args,transactionVerified:true,historyComplete:true,
      }),/OBS_DEMO_REFUSED:UNTRUSTED_AUTH_SHORTCUT/);
      assert.deepEqual(outbox.status.rows,{});
    }));
});
test('ordinary production Node invocation refuses injected fetch even with leaked opt-in',()=>{
  // A separate process cannot inherit the test runner child context. It must
  // use production queueVerified; opt-in alone cannot authorize an RPC override.
  const moduleUrl=new URL('../src/demo-outbox.mjs',import.meta.url).href;
  const source=`
import {DemoOutbox} from ${JSON.stringify(moduleUrl)};
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const expected={genesisHash:'1'.repeat(32),program:'1'.repeat(32),mint:'1'.repeat(32),
 holochainScope:'07'.repeat(32),idlSha256:createHash('sha256').update('{}').digest('hex'),
 sourceCommitSha:'f'.repeat(40)};
const destination={dnaHash:'TEST_DNA',agentKey:'TEST_AGENT',appId:'ci-test-only',
 role:'audit',zome:'solana_audit'};
const dir=mkdtempSync(join(tmpdir(),'obs-production-guard-'));
const outbox=new DemoOutbox(join(dir,'outbox.json'),{expected,destination});
try{
 await outbox.queueVerified({ledger:null,rpcUrls:['http://127.0.0.1:8899','http://127.0.0.1:9900'],
  signature:'1'.repeat(64),receiptAddress:'1'.repeat(32),
  expected:{program:expected.program,mint:expected.mint,config:'1'.repeat(32),
   vault:'1'.repeat(32),scope:expected.holochainScope},
  idlText:'{}',codeVersion:expected.sourceCommitSha,
  fetchFn:async()=>{throw Error('UNEXPECTED_PRODUCTION_FETCH')}});
 process.exitCode=5;
}catch(e){
 if(!String(e).includes('OBS_DEMO_REFUSED:RPC_FETCH_OVERRIDE_FORBIDDEN'))throw e;
 console.log('PRODUCTION_FETCH_OVERRIDE_REFUSED');
}finally{outbox.close();rmSync(dir,{recursive:true,force:true})}
`;
  const {NODE_TEST_CONTEXT:ignored,...env}=process.env;
  const output=execFileSync(process.execPath,['--input-type=module','-e',source],{
    env:{...env,OBS_ALLOW_ARCHIVED_RPC_REPLAY:'1'},
    encoding:'utf8',timeout:12000,
  });
  assert.match(output,/PRODUCTION_FETCH_OVERRIDE_REFUSED/);
  assert.doesNotMatch(output,/UNEXPECTED_PRODUCTION_FETCH/);
});
