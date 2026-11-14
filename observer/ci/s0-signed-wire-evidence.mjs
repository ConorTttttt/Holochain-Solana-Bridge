/**
 * CI-only replay of ORIGINAL finalized Solana local-validator JSON-RPC responses.
 * Requires genuine base64 signed transaction AND complete base64 containing block.
 * Unlike synthetic signed-message tests, the wire bytes originate in the real
 * local validator; unlike consensus proof, a single localhost RPC is not independent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { getTransactionDecoder, getCompiledTransactionMessageDecoder, getBase64Encoder } from '@solana/kit';
import { encode58, decodeReceipt } from '../src/decode.mjs';
import { fetchFinalizedTransaction } from '../src/indexer.mjs';
import { sameSolanaExecutionMeta } from '../../scripts/ci/s0-solana-execution-meta.mjs';
import { verifyWireSignatures, verifyDepositCandidates, attachReceiptObservation } from '../src/transaction.mjs';
import { DepositLedger } from '../src/ledger.mjs';
import { makeAuditOnlyEnvelope } from '../../demo/observation-contract.mjs';
import { verifySnapshot } from '../src/verify.mjs';
import { reviewShadow } from '../../holochain/shadow-review.mjs';
import { issueHolochainCredit, authorizeSolanaWithdrawal } from '../../holochain/evidence-gate.mjs';

const root='target/localnet-evidence/';
function load(name) {
  assert.match(name,/^[a-zA-Z0-9-]+(?:\.rpc)?\.json$/,'unsafe witness filename');
  return JSON.parse(readFileSync(root+name,'utf8'));
}
function checkSigned(raw, signature) {
  assert.ok(Array.isArray(raw) && raw.length===2 && raw[1]==='base64');
  const bytes=Buffer.from(raw[0], 'base64');
  assert.ok(bytes.length>0 && bytes.toString('base64')===raw[0],'noncanonical wire');
  const signed=getTransactionDecoder().decode(getBase64Encoder().encode(raw[0]));
  const compiled=getCompiledTransactionMessageDecoder().decode(signed.messageBytes);
  const first=compiled.staticAccounts[0];
  assert.ok(first && signed.signatures[first] instanceof Uint8Array,'first signature missing');
  assert.equal(encode58(signed.signatures[first]),signature,'RPC signature/wire mismatch');
  return { signed, compiled };
}
for (const mode of ['lifecycle','init-capture','u64-max','demo-domain']) {
  test('genuine finalized signed wire and block replay: '+mode,async()=>{
    const index=load('sprint1-'+mode+'-transactions.json');
    assert.equal(index.mode,mode);
    // A historical valid signed-wire artifact from another source SHA is
    // valuable, but is NOT an accepted same-SHA integration result.
    const checkoutSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const archiveSha=readFileSync(root+'source-commit.txt','utf8').trim();
    assert.match(checkoutSha,/^[0-9a-f]{40}$/);
    assert.equal(archiveSha,checkoutSha,'SAME_SHA_SOURCE_PRODUCER_REQUIRED');
    assert.equal(index.sourceCommitSha,checkoutSha,'SAME_SHA_INDEX_REQUIRED');
    assert.ok(index.genesisHash && index.programId);
    assert.ok(index.finalized.length>0,'empty real validator witness');
    let verified=0, authenticated=0, depositCount=0;
    const signed=new Set(index.transactions.filter(x=>x.signature).map(x=>x.signature));
    assert.equal(index.finalized.length,signed.size,'missing transaction witness');
    for (const item of index.finalized) {
      assert.ok(signed.has(item.signature),'unlisted signature');
      assert.ok(item.getTransactionBase64RawFile && item.getBlockBase64RawFile,
        'signed-wire RPC files missing: SOL source backport or live validator capture required');
      const txEnvelope=load(item.getTransactionBase64RawFile);
      const blockEnvelope=load(item.getBlockBase64RawFile);
      assert.equal(txEnvelope.error,undefined);
      assert.equal(blockEnvelope.error,undefined);
      const tx=txEnvelope.result, block=blockEnvelope.result;
      assert.ok(tx && block);
      assert.equal(tx.slot,item.slot);
      assert.equal(block.blockhash,item.blockhash);
      assert.equal(block.parentSlot,item.parentSlot);
      assert.equal(block.previousBlockhash,item.previousBlockhash);
      assert.deepEqual(tx.meta?.err,item.meta.err);
      const decoded=checkSigned(tx.transaction,item.signature);
      assert.equal(decoded.compiled.version,tx.version);
      await verifyWireSignatures({signedTransaction:decoded.signed,compiledMessage:decoded.compiled});
      authenticated++;
      let occurrences=0;
      for (const candidate of block.transactions) {
        const temp=getTransactionDecoder().decode(getBase64Encoder().encode(candidate.transaction?.[0] || ''));
        const cm=getCompiledTransactionMessageDecoder().decode(temp.messageBytes);
        const sig=encode58(temp.signatures[cm.staticAccounts[0]]);
        if(sig===item.signature) {
          occurrences++;
          assert.deepEqual(candidate.transaction,tx.transaction,'block wire contradicts transaction');
          assert.equal(sameSolanaExecutionMeta(candidate.meta,tx.meta),true,
            'block meta contradicts transaction (all fields except empty rewards null/[])');
        }
      }
      assert.equal(occurrences,1,'signed transaction not unique in finalized block');
      // The actual OBS indexer validates *all* signatures in the containing
      // block and makes an independent getTransaction/getBlock comparison.
      if(tx.meta.err===null) {
        const mockRpc=async (_url, options)=>{
          const req=JSON.parse(options.body);
          assert.equal(req.jsonrpc,'2.0');
          let result;
          if(req.method==='getGenesisHash')result=index.genesisHash;
          else if(req.method==='getTransaction'){
            assert.equal(req.params[0],item.signature);
            assert.equal(req.params[1].encoding,'base64');
            assert.equal(req.params[1].commitment,'finalized');
            result=tx;
          } else if(req.method==='getBlock'){
            assert.equal(req.params[0],item.slot);
            assert.equal(req.params[1].encoding,'base64');
            assert.equal(req.params[1].commitment,'finalized');
            result=block;
          } else throw new Error('unexpected RPC method '+req.method);
          return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result})};
        };
        const result=await fetchFinalizedTransaction({
          rpcUrl:'http://127.0.0.1:8899',signature:item.signature,
          genesisHash:index.genesisHash,fetchFn:mockRpc,
        });
        assert.equal(result.creditEligible,false);
        assert.equal(result.rpcTransaction.slot,item.slot);
        verified++;
        if(mode==='lifecycle'||mode==='demo-domain'){
          const fixture=load(mode==='demo-domain'?'demo-domain-active-receipt.json':'active-receipt.json');
          if(item.signature===fixture.signatures.deposit){
            const [receipt,config,vault,mint]=fixture.accounts;
            const expected={program:index.programId,mint:mint.address,
              config:config.address,vault:vault.address,
              scope:decodeReceipt(Buffer.from(receipt.dataBase64,'base64')).scope};
            if(mode==='demo-domain'){
              // A2 #55's disposable source domain is derived from the executed
              // genesis, deployed program and genuinely minted SPL address.
              // Never admit the old all-07 or attacker all-2a test scopes.
              const domain=load('demo-source-domain.json');
              assert.equal(domain.sourceCommitSha,checkoutSha,'DEMO_DOMAIN_SOURCE_SHA');
              assert.equal(domain.genesisHash,index.genesisHash,'DEMO_DOMAIN_GENESIS');
              assert.equal(domain.programId,index.programId,'DEMO_DOMAIN_PROGRAM');
              assert.equal(domain.mint,expected.mint,'DEMO_DOMAIN_MINT');
              assert.equal(domain.receipt,fixture.accounts[0].address,'DEMO_DOMAIN_RECEIPT');
              assert.equal(domain.scopeHex,expected.scope,'DEMO_DOMAIN_RECEIPT_SCOPE');
              assert.equal(domain.initializedScopeHex,domain.scopeHex,'DEMO_DOMAIN_INITIALIZED_SCOPE');
              assert.equal(domain.transactions.deposit.signature,item.signature,'DEMO_DOMAIN_DEPOSIT_SIGNATURE');
              assert.equal(domain.transactions.deposit.slot,item.slot,'DEMO_DOMAIN_DEPOSIT_SLOT');
              assert.equal(domain.historyComplete,false,'DEMO_DOMAIN_CANNOT_ASSERT_FULL_HISTORY');
              for(const [k,v] of Object.entries({creditEligible:false,
                independentConsensusVerified:false,spendableBaseUnits:'0',
                withdrawalAuthorized:false}))assert.equal(domain[k],v,'DEMO_DOMAIN_ECONOMIC_DENIAL_'+k);
              const domainBytes=Buffer.concat([
                Buffer.from('HSC/demo-localnet-source-scope/v1'),Buffer.from([0]),
                Buffer.from(index.genesisHash),Buffer.from([0]),
                Buffer.from(index.programId),Buffer.from([0]),Buffer.from(expected.mint),
              ]);
              assert.equal(createHash('sha256').update(domainBytes).digest('hex'),domain.scopeHex,
                'DEMO_DOMAIN_DERIVED_SCOPE');
              assert.equal(domain.amountBaseUnits,'250000');
              assert.equal(domain.nonce,'42017');
            }
            const idl=JSON.parse(readFileSync('target/idl/deposit_prototype.json','utf8'));
            if(mode==='demo-domain'){
              const domain=load('demo-source-domain.json');
              assert.equal(createHash('sha256').update(readFileSync('target/idl/deposit_prototype.json')).digest('hex'),
                domain.idlSha256,'DEMO_DOMAIN_PINNED_GENERATED_IDL');
            }
            const candidates=await verifyDepositCandidates({
              rpcTransaction:result.rpcTransaction,signature:item.signature,expected,
              genesisHash:index.genesisHash,idl,finalizedClaim:true,
              blockhash:result.blockhash,source:'replayed-original-finalized-localnet-RPC',
            });
            assert.ok(candidates.length>0,'deposit was not cryptographically attributed');
            assert.ok(candidates.some(x=>x.receiptAddress===receipt.address),'wrong receipt');
            assert.ok(candidates.every(x=>x.creditEligible===false &&
              x.independentConsensusVerified===false),'economic/consensus gate violated');

            // Full real-witness handoff: signed localnet deposit -> OBS verified
            // receipt snapshot -> crash-consistent evidence ledger -> inert shadow.
            // Only the SOL local-validator generated these bytes; no fixture
            // constructs or signs a transaction in this test.
            const sourceSnapshot = label => {
              const raw=load(label+'.json');
              assert.equal(raw.genesisHash,index.genesisHash,'snapshot genesis mismatch');
              assert.equal(raw.programId,index.programId,'snapshot program mismatch');
              assert.equal(raw.accounts.length,4,'four-account receipt snapshot required');
              const [rec,cfg,vlt,mnt]=raw.accounts;
              const expectedKeys={...expected,receipt:rec.address,
                config:cfg.address,vault:vlt.address,mint:mnt.address};
              return {raw,expected:expectedKeys,
                snapshot:{slot:raw.slot,accounts:raw.accounts.map(account=>({
                  owner:account.owner,raw:Buffer.from(account.dataBase64,'base64')}))}};
            };
            const active=sourceSnapshot(mode==='demo-domain'?'demo-domain-active-receipt':'active-receipt');
            const live=await verifySnapshot({
              snapshot:active.snapshot,expected:active.expected,
              genesisHash:index.genesisHash,source:'original-finalized-localnet-archive',
            });
            assert.equal(live.transactionVerified,false,'account snapshot is not signed history');
            const candidate=candidates.find(x=>x.receiptAddress===receipt.address);
            const evidence=attachReceiptObservation(candidate,live);
            assert.equal(evidence.kind,'solana-deposit-evidence-v1');
            assert.equal(evidence.transactionVerified,true);
            assert.equal(evidence.creditEligible,false);
            assert.equal(evidence.independentConsensusVerified,false);
            // Genuine signed-wire OBS evidence -> SOURCE-ONLY audit envelope.
            // This is not a signed Holochain write; Agent 4 must supply and
            // independently test own-DNA Lair record_observation/readback.
            const prepared=makeAuditOnlyEnvelope({
              evidence,rpcTransaction:result.rpcTransaction,
              expected:{genesisHash:index.genesisHash,program:index.programId,
                mint:expected.mint,holochainScope:expected.scope},
            });
            assert.equal(prepared.kind,'solana-observation-demo-v1');
            assert.equal(prepared.historyIndexed,false);
            assert.equal(prepared.destination.state,'not_bound_or_written');
            assert.equal(prepared.destination.actionHash,null);
            for(const part of [prepared,prepared.source,prepared.witness,prepared.destination]){
              assert.equal(part.creditEligible,false);
              assert.equal(part.independentConsensusVerified,false);
              assert.equal(part.spendableBaseUnits,'0');
              assert.equal(part.withdrawalAuthorized,false);
            }
            mkdirSync('ci-artifacts',{recursive:true});
            writeFileSync('ci-artifacts/demo-source-only-observation.json',
              JSON.stringify(prepared,null,2)+'\n',{flag:'w',mode:0o600});
            console.log('SOURCE_ONLY_DEMO_PREPARED_NO_HOLOCHAIN_WRITE',
              prepared.id,prepared.source.signature);
            const dir=mkdtempSync(join(tmpdir(),'real-localnet-shadow-'));
            const ledgerPath=join(dir,'finalized-ledger.json');
            const ledgerOptions={genesisHash:index.genesisHash,program:index.programId,
              trustedDeploymentSlot:item.slot};
            const binding=Object.freeze({
              genesisHash:index.genesisHash,program:index.programId,mint:expected.mint,
              holochainScope:live.holochainScope,dnaHash:'NOT_DEPLOYED_S0',
              agreementHash:'SHADOW_ONLY_NO_ECONOMICS',deploymentEpoch:'real-localnet-s0',
            });
            const shadowJournal=new Map();
            try {
              const first=new DepositLedger(ledgerPath,ledgerOptions);
              try {
                const committed=first.commit({checkpoint:item.slot,
                  block:{slot:item.slot,blockhash:item.blockhash},evidence:[evidence]});
                assert.equal(committed.processed,1);
                assert.equal(committed.checkpoint,item.slot);
              } finally { first.close(); }
              const restart=new DepositLedger(ledgerPath,ledgerOptions);
              try {
                assert.equal(restart.checkpoint,item.slot,'durable restart lost checkpoint');
                assert.equal(Object.keys(restart.processed).length,1,'restart lost real evidence');
                restart.commit({checkpoint:item.slot,
                  block:{slot:item.slot,blockhash:item.blockhash},evidence:[evidence]});
                assert.equal(Object.keys(restart.processed).length,1,'duplicate added liability');
                assert.throws(()=>restart.commit({checkpoint:item.slot,
                  evidence:[{...evidence,amountBaseUnits:'1'}]}),
                  /conflicting duplicate receipt identity/);
                assert.throws(()=>restart.commit({checkpoint:item.slot,
                  block:{slot:item.slot,blockhash:'contradictory-blockhash'}}),
                  /conflicting finalized blockhash/);
                assert.equal(restart.checkpoint,item.slot);

                // ORIGINAL Kit-backed outbox admission, not an invented signed
                // transaction and NOT a Holochain ACK. Both endpoint names
                // replay the same retained validator RPC bytes; they are not
                // independent historical consensus providers.
                const {DemoOutbox}=await import('../src/demo-outbox.mjs');
                const {verifyReviewedWitnessV2,REVIEWED_V2_DOMAIN}=await import('../src/demo-witness-v2.mjs');
                const {canonicalJSON,domainDigest}=await import('../src/demo-outbox.mjs');
                const ciIdlText=readFileSync('target/idl/deposit_prototype.json','utf8');
                const sourcePins={
                  genesisHash:index.genesisHash,program:index.programId,
                  mint:expected.mint,holochainScope:expected.scope,
                  idlSha256:(await import('node:crypto')).createHash('sha256')
                    .update(ciIdlText).digest('hex'),
                  sourceCommitSha:index.sourceCommitSha,
                };
                const target={dnaHash:'NOT_DEPLOYED_DEMO_DNA',
                  agentKey:'NOT_DEPLOYED_DEMO_AGENT',
                  appId:'observer-owned-localnet-audit-proposal',
                  role:'audit',zome:'solana_audit'};
                const candidateV2Outbox=new DemoOutbox(join(dir,'reviewed-outbox.json'),
                  {expected:sourcePins,destination:target});
                const archivedRpc=async (_rpcUrl,options)=>{
                  const req=JSON.parse(options.body);
                  let value;
                  if(req.method==='getGenesisHash')value=index.genesisHash;
                  else if(req.method==='getTransaction'){
                    assert.equal(req.params[0],item.signature);
                    value=tx;
                  }else if(req.method==='getBlock'){
                    assert.equal(req.params[0],item.slot);
                    value=block;
                  }else if(req.method==='getMultipleAccounts'){
                    assert.deepEqual(req.params[0],[
                      receipt.address,expected.config,expected.vault,expected.mint]);
                    value={context:{slot:active.raw.slot},value:active.raw.accounts.map(a=>({
                      owner:a.owner,executable:false,lamports:a.lamports,
                      space:Buffer.from(a.dataBase64,'base64').length,
                      data:[a.dataBase64,'base64'],
                    }))};
                  }else throw Error('UNEXPECTED_ORIGINAL_RPC_METHOD:'+req.method);
                  return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:value})};
                };
                const queueArgs={ledger:restart,rpcUrls:[
                  'http://127.0.0.1:8899','http://127.0.0.1:9900'],
                  signature:item.signature,receiptAddress:receipt.address,
                  expected,idlText:ciIdlText,codeVersion:index.sourceCommitSha,
                  fetchFn:archivedRpc};
                const savedOptIn=process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
                process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY='1';
                try{
                  assert.equal(await candidateV2Outbox.queueVerified(queueArgs),'pending');
                  assert.equal(await candidateV2Outbox.queueVerified(queueArgs),'pending');
                  const row=candidateV2Outbox.state.rows[evidence.id];
                  assert.equal(row.observation.proof.evidenceOrigin,
                    'observer_reviewed_outbox');
                  assert.equal(row.reviewedWitnessV2.source.depositNonce,'42017');
                  assert.equal(row.reviewedWitnessV2.source.recipientCore,evidence.recipientCore);
                  assert.equal(row.reviewedWitnessV2.source.blockhash,item.blockhash);
                  assert.equal(row.reviewedWitnessV2.proof.historyComplete,false);
                  assert.ok(verifyReviewedWitnessV2(row.reviewedWitnessV2));
                  const originalV2File='ci-artifacts/observer-reviewed-v2-original-signed-localnet.json';
                  mkdirSync('ci-artifacts',{recursive:true});
                  const originalV2Bytes=Buffer.from(JSON.stringify({
                    immutableSourceCommitSha:index.sourceCommitSha,
                    originalLocalnetSource:'real SOL local-validator signed wire archived by same CI run',
                    witness:row.reviewedWitnessV2,
                    // No signed Holochain record exists at this stage.
                    destinationReadback:{state:'not_approved_or_written',actionHash:null},
                  },null,2)+'\n');
                  writeFileSync(originalV2File,originalV2Bytes,{mode:0o600});
                  const originalV2Sha=createHash('sha256')
                    .update(originalV2Bytes).digest('hex');
                  // Portable, byte-exact canonical test vector for independent A4/A5
                  // implementations. It excludes only the terminal witnessDigest.
                  const {witnessDigest:expectedV2Digest,...unsignedV2}=row.reviewedWitnessV2;
                  const canonicalBytes=Buffer.from(canonicalJSON(unsignedV2),'utf8');
                  const independentDigest=createHash('sha256').update(Buffer.concat([
                    Buffer.from(REVIEWED_V2_DOMAIN,'utf8'),Buffer.from([0]),canonicalBytes,
                  ])).digest('hex');
                  assert.equal(independentDigest,expectedV2Digest);
                  assert.equal(domainDigest(REVIEWED_V2_DOMAIN,unsignedV2),expectedV2Digest);
                  const canonFile='ci-artifacts/observer-reviewed-v2-original-signed-localnet.canonical.json';
                  writeFileSync(canonFile,canonicalBytes,{mode:0o600});
                  const digestFile='ci-artifacts/observer-reviewed-v2-original-signed-localnet.witness-digest.txt';
                  writeFileSync(digestFile,expectedV2Digest+'\n',{mode:0o600});
                  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
                  writeFileSync(originalV2File+'.sha256',[
                    originalV2Sha+'  observer-reviewed-v2-original-signed-localnet.json',
                    hash(canonicalBytes)+'  observer-reviewed-v2-original-signed-localnet.canonical.json',
                    hash(Buffer.from(expectedV2Digest+'\n'))+
                      '  observer-reviewed-v2-original-signed-localnet.witness-digest.txt',
                    '',
                  ].join('\n'));
                  console.log('ORIGINAL_KIT_V2_SOURCE_ARTIFACT_SHA256',originalV2Sha);
                  console.log('ORIGINAL_KIT_V2_CANONICAL_WITNESS_DIGEST',expectedV2Digest);
                  await assert.rejects(
                    candidateV2Outbox.queueVerified({...queueArgs,idlText:ciIdlText+' '}),
                    /PINNED_IDL_BYTES_REQUIRED/);
                  await assert.rejects(
                    candidateV2Outbox.queueVerified({...queueArgs,codeVersion:'0'.repeat(40)}),
                    /SOURCE_COMMIT_BINDING/);
                  await assert.rejects(
                    candidateV2Outbox.queueVerified({...queueArgs,expected:{
                      ...expected,program:'11111111111111111111111111111111',
                    }}),/PINNED_DEPLOYMENT_MISMATCH/);
                  await assert.rejects(
                    candidateV2Outbox.queueVerified({...queueArgs,expected:{
                      ...expected,scope:'f'.repeat(64),
                    }}),/PINNED_DEPLOYMENT_MISMATCH/);
                  // Even a fully recomputed unkeyed hash cannot mask changed
                  // source, occurrence, containing block or future receipt.
                  const structuralMutants=[
                    w=>{w.source.depositNonce='9999'},
                    w=>{w.source.occurrenceId+=':other'},
                    w=>{w.source.blockhash='altered-blockhash'},
                    w=>{w.proof.containingBlock.blockhash='altered-blockhash'},
                    w=>{w.proof.rpcTransaction.meta.fee+=1},
                    w=>{w.proof.latestReconciledReceiptSnapshot.refunded=true},
                    // Changing to another *valid* SHA-40 only becomes a
                    // refusal at queueVerified's out-of-band commit pin.
                    w=>{w.source.codeVersion='not-an-immutable-sha'},
                    w=>{w.destination.appId='published-Unyt-app'},
                  ];
                  for(const mutate of structuralMutants){
                    const w=structuredClone(row.reviewedWitnessV2);
                    mutate(w);
                    const {witnessDigest:removed,...payload}=w;
                    w.witnessDigest=domainDigest(REVIEWED_V2_DOMAIN,payload);
                    assert.throws(()=>verifyReviewedWitnessV2(w),/OBS_V2_REFUSED:/);
                  }
                  const adversarialRpcCases=[
                    {
                      label:'signed-wire-message-tamper',
                      mutate:(url,method,json)=>{
                        if(method==='getTransaction'){
                          const b=Buffer.from(json.result.transaction[0],'base64');
                          b[b.length-2]^=1;
                          json.result.transaction[0]=b.toString('base64');
                        }
                      },
                    },
                    {
                      label:'execution-fee-metadata-tamper',
                      mutate:(url,method,json)=>{
                        if(method==='getTransaction')json.result.meta.fee+=1;
                      },
                    },
                    {
                      label:'second-endpoint-genesis-mismatch',
                      mutate:(url,method,json)=>{
                        if(url.includes('9900')&&method==='getGenesisHash')
                          json.result='different-reported-genesis';
                      },
                    },
                    {
                      label:'later-receipt-account-owner-substitution',
                      mutate:(url,method,json)=>{
                        if(url.includes('9900')&&method==='getMultipleAccounts')
                          json.result.value[0].owner='11111111111111111111111111111111';
                      },
                    },
                  ];
                  for(const item of adversarialRpcCases){
                    let modified=false;
                    const negativeRpc=async(url,init)=>{
                      const original=await archivedRpc(url,init);
                      const body=structuredClone(await original.json());
                      const method=JSON.parse(init.body).method;
                      const previous=JSON.stringify(body);
                      item.mutate(url,method,body);
                      modified ||= previous!==JSON.stringify(body);
                      return {ok:true,json:async()=>body};
                    };
                    await assert.rejects(candidateV2Outbox.queueVerified({
                      ...queueArgs,fetchFn:negativeRpc}),
                      /contradicts|mismatch|noncanonical|invalid|signature|owner|genesis|receipt/i,
                      item.label);
                    assert.equal(modified,true,'negative must mutate original '+item.label);
                  }
                  assert.equal(candidateV2Outbox.status.rows[evidence.id].state,'pending');
                  for(const shortcut of ['transactionVerified','historyComplete',
                    'historyCoveredByTwoRpcClaims','witnessDigest']){
                    await assert.rejects(
                      candidateV2Outbox.queueVerified({...queueArgs,[shortcut]:true}),
                      /UNTRUSTED_AUTH_SHORTCUT/);
                  }
                  await assert.rejects(candidateV2Outbox.deliver(evidence.id,{
                    preflight:async()=>target,read:async()=>null,
                    write:async()=>{throw Error('MUST_NEVER_WRITE_UNAPPROVED_V1')},
                  }),/REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED/);
                  assert.equal(candidateV2Outbox.status.rows[evidence.id].state,'pending');
                }finally{
                  if(savedOptIn===undefined)delete process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY;
                  else process.env.OBS_ALLOW_ARCHIVED_RPC_REPLAY=savedOptIn;
                  candidateV2Outbox.close();
                }
                const reopenedOutbox=new DemoOutbox(join(dir,'reviewed-outbox.json'),
                  {expected:sourcePins,destination:target});
                assert.equal(reopenedOutbox.status.rows[evidence.id].state,'pending');
                reopenedOutbox.close();
                console.log('REAL_SIGNED_KIT_OUTBOX_QUEUED_V2_NOT_DELIVERED',
                  evidence.id,item.signature);
              } finally { restart.close(); }
              const shadowActive=reviewShadow(live,binding,shadowJournal);
              assert.equal(shadowActive.verdict,'quarantined');
              assert.equal(shadowActive.creditEligible,false);
              assert.equal(shadowActive.withdrawalAuthorized,false);
              const duplicateShadow=reviewShadow(live,binding,shadowJournal);
              assert.equal(duplicateShadow.verdict,'quarantined');
              assert.equal(shadowJournal.size,1,'shadow duplicate created extra receipt');
              const conflicting=reviewShadow({...live,receiptDigest:'f'.repeat(64)},
                binding,shadowJournal);
              assert.equal(conflicting.verdict,'rejected','same-slot contradiction accepted');
              const refunded=sourceSnapshot(mode==='demo-domain'?'demo-domain-refunded-receipt':'refunded-receipt');
              const refundObservation=await verifySnapshot({
                snapshot:refunded.snapshot,expected:refunded.expected,
                genesisHash:index.genesisHash,source:'original-finalized-localnet-archive',
              });
              assert.equal(refundObservation.refunded,true);
              assert.equal(refundObservation.id,live.id,'refund changed receipt identity');
              const shadowRefund=reviewShadow(refundObservation,binding,shadowJournal);
              assert.equal(shadowRefund.verdict,'quarantined','refund shadow not quarantined');
              assert.ok(shadowRefund.findings.includes('REFUND_TRANSITION'));
              assert.equal(shadowRefund.spendableBaseUnits,'0');
              assert.equal(shadowRefund.withdrawalAuthorized,false);
              assert.equal(shadowJournal.size,1);
              assert.throws(()=>issueHolochainCredit(evidence),/CREDITING_DISABLED/);
              assert.throws(()=>authorizeSolanaWithdrawal(evidence),/WITHDRAWALS_DISABLED/);
            } finally { rmSync(dir,{recursive:true,force:true}); }
            depositCount+=candidates.length;
          }
        }
      } else {
        // Failed on-chain transactions cannot be candidates but their signatures
        // still must authenticate. The full block is validated for each success.
        assert.notEqual(tx.meta.err,null);
      }
    }
    assert.equal(authenticated,index.finalized.length);
    assert.ok(verified>0,'no successful finalized transaction passed OBS inclusion verification');
    if(mode==='lifecycle'||mode==='demo-domain')assert.ok(depositCount>0,'no real deposited receipt attributed by OBS');
  });
}

// CI-owned pinned copies of OBS #36's two boundary tests; real signed-wire
// positive cases above still require exact transaction bytes and signatures.
// Real getBlock({rewards:false}) reports rewards:null while matching getTransaction
// reports rewards:[]; preserve byte-level wire equality separately.
const baseline = Object.freeze({
  err:null, fee:5000, preBalances:[10000,0], postBalances:[5000,5000],
  preTokenBalances:[],postTokenBalances:[],innerInstructions:[],
  logMessages:['Program log: verify'], computeUnitsConsumed:100,
  loadedAddresses:{writable:[],readonly:[]}, status:{Ok:null}, rewards:null,
});
test('RPC rewards null versus empty list is the only accepted normalization',()=>{
  assert.equal(sameSolanaExecutionMeta(baseline,{...baseline,rewards:[]}),true);
  assert.equal(sameSolanaExecutionMeta({...baseline,rewards:[]},baseline),true);
  assert.equal(sameSolanaExecutionMeta(baseline,{...baseline,rewards:null}),true);
  assert.equal(sameSolanaExecutionMeta(baseline,{...baseline,rewards:[{pubkey:'attacker'}]}),false);
  const {rewards,...missing}=baseline;
  assert.equal(sameSolanaExecutionMeta(baseline,missing),false);
});
test('RPC execution, logs, token deltas and loaded ALT addresses remain strict',()=>{
  for(const field of ['err','fee','preBalances','postBalances','preTokenBalances',
    'postTokenBalances','innerInstructions','logMessages','loadedAddresses',
    'computeUnitsConsumed','status']) {
    const other={...baseline,[field]:field === 'fee' ? 1 : ['tampered']};
    assert.equal(sameSolanaExecutionMeta(baseline,other),false,field);
  }
});
