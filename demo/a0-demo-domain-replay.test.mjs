import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/ci/a0-demo-domain-kit-v2.mjs','utf8');
const wf=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
const runner=readFileSync('demo/a0-preauthorization-runner.mjs','utf8');
const outbox=readFileSync('observer/src/demo-outbox.mjs','utf8');
test('genuine source-domain replay is required from exactly the same SHA producer',()=>{
 assert.match(wf,/genuine-fresh-solana-domain-obs-v2 node --test scripts\/ci\/a0-demo-domain-kit-v2\.mjs/);
 assert.match(wf,/observer-fresh-domain-reviewed-v2-original-signed-localnet\.json\.sha256/);
 assert.match(script,/assertDemoDomainShape\(d\)/);
 assert.match(script,/DEMO_DOMAIN_NOT_SAME_SHA/);
 assert.match(script,/SOL_PRODUCER_NOT_SAME_SHA/);
 assert.match(script,/archive\.transactions\.some/);
 assert.match(script,/signedWireBase64===tx\.transaction\[0\]/);
 assert.match(script,/new DemoOutbox\(/);
 assert.match(script,/\.queueVerified\(\{ledger,\.\.\.queueArgs\}\)/);
 assert.match(script,/\.deliver\(sourceId/);
 assert.match(script,/REVIEWED_V2_SIGNED_TRANSPORT_NOT_APPROVED/);
 assert.match(script,/NO_ACK|noHolochainAck:true/);
 assert.match(script,/refundHistoryComplete:false/);
 assert.doesNotMatch(script,/\.queueSyntheticFixture\(/);
});

test('production OBS override guard stays intact and both real replay paths use Node child-v8 test context',()=>{
 assert.match(outbox,/process\.env\.NODE_TEST_CONTEXT==='child-v8'/);
 assert.match(outbox,/process\.env\.OBS_ALLOW_ARCHIVED_RPC_REPLAY==='1'/);
 assert.match(script,/process\.env\.OBS_ALLOW_ARCHIVED_RPC_REPLAY='1'/);
 assert.match(runner,/spawnSync\(process\.execPath,\['--test',script\]/);
 assert.doesNotMatch(wf,/genuine-fresh-solana-domain-obs-v2 node scripts\/ci\/a0-demo-domain-kit-v2\.mjs/);
});
