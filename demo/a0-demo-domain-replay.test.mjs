import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/ci/a0-demo-domain-kit-v2.mjs','utf8');
const wf=readFileSync('.github/workflows/integration-snapshot.yml','utf8');
test('genuine source-domain replay is required from exactly the same SHA producer',()=>{
 assert.match(wf,/genuine-fresh-solana-domain-obs-v2 node --test scripts\/ci\/a0-demo-domain-kit-v2\.mjs/);
 assert.match(wf,/observer-fresh-domain-reviewed-v2-original-signed-localnet\.json\.sha256/);
 // A3 #57 only permits archival fetch override in Node's test child process.
 assert.match(wf,/genuine-fresh-solana-domain-obs-v2 node --test/);
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
