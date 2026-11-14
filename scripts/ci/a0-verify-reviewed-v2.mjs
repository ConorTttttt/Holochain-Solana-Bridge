#!/usr/bin/env node
// CI-only acceptance of genuine archived OBS v2 QUEUE output, not a signed Holochain ACK.
// Consumes the source-owned Kit test's original SHA-bound artifact; cannot mint a witness.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyReviewedWitnessV2} from '../../observer/src/demo-witness-v2.mjs';
const checkout=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const evidence=JSON.parse(readFileSync('ci-artifacts/observer-reviewed-v2-original-signed-localnet.json'));
assert.equal(evidence.immutableSourceCommitSha,checkout,'SOURCE_SHA_DRIFT');
assert.equal(evidence.originalLocalnetSource,'real SOL local-validator signed wire archived by same CI run');
assert.deepEqual(evidence.destinationReadback,{state:'not_approved_or_written',actionHash:null});
assert.ok(verifyReviewedWitnessV2(evidence.witness),'SOURCE_RICH_V2_REFUSED');
const w=evidence.witness;
assert.equal(w.kind,'solana-observation-demo-v2');
assert.equal(w.proof.historyComplete,false,'HISTORY_FALSE_APPROVAL');
for(const part of [w,w.source,w.proof]){
 assert.equal(part.creditEligible,false);
 assert.equal(part.independentConsensusVerified,false);
 assert.equal(part.spendableBaseUnits,'0');
 assert.equal(part.withdrawalAuthorized,false);
}
const signedWire=w.proof.rpcTransaction?.transaction?.[0];
assert.equal(typeof signedWire,'string','NO_ORIGINAL_SIGNED_WIRE');
const raw=Buffer.from(signedWire,'base64');
assert.ok(raw.length>64 && raw.toString('base64')===signedWire,'INVALID_SIGNED_WIRE');
assert.ok(Array.isArray(w.proof.containingBlock?.transactions),'MISSING_ORIGINAL_BLOCK');
const summary={schema:'hsc-a0-obs-v2-admission-v1',sourceCommit:checkout,
 witnessDigest:w.witnessDigest,originalSignedWireSha256:createHash('sha256').update(raw).digest('hex'),
 state:'OBS_KIT_ARCHIVED_REPLAY_QUEUED_PENDING',
 durableOutboxReopenedBySourceTest:true,reviewedOriginTransport:'REFUSED_UNAPPROVED_V2',
 destinationDnaHash:null,installedCellId:null,actionHash:null,
 historyComplete:false,independentSecurityApproved:false,
 creditEligible:false,independentConsensusVerified:false,
 spendableBaseUnits:'0',withdrawalAuthorized:false};
mkdirSync('ci-artifacts',{recursive:true});
writeFileSync('ci-artifacts/a0-observer-v2-admission.json',JSON.stringify(summary,null,2)+'\n',{mode:0o600});
console.log('PASS: exact source-SHA and original signed Kit v2 admission, intentionally no Holochain ACK');
