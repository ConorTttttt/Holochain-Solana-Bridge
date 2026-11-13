import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { DepositLedger } from '../src/ledger.mjs';

const chain='FcVMLgegDkZKX8ec4ELY41RwNDJFZE9nVfZvd9oSmQM8';
const program='FNXqx398dNAHfa6FGxyy8D6oM7wa1vxjpEB1uzJpWcNG';
const options={genesisHash:chain,program,trustedDeploymentSlot:20};
function fixture(receipt,outerIndex=0) {
  return {
    kind:'solana-deposit-evidence-v1',creditEligible:false,transactionVerified:true,
    independentConsensusVerified:false,
    id:chain+':'+program+':receipt'+receipt,
    occurrenceId:chain+':'+program+':signature:outer:'+outerIndex,
    transactionHash:'hash'+receipt,amountBaseUnits:'250000',
  };
}
function pathFor(t) {
  const directory=mkdtempSync(join(tmpdir(),'bridge-obs-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  return join(directory,'ledger.json');
}
test('durable checkpoint and receipt identity survive restart without double processing', t => {
  const filename=pathFor(t);
  const a=new DepositLedger(filename,options);
  assert.equal(a.checkpoint,19);
  assert.deepEqual(a.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},evidence:[fixture(1)]}),
    {checkpoint:21,processed:1});
  a.close();
  const b=new DepositLedger(filename,options);
  assert.equal(b.checkpoint,21);
  assert.equal(Object.keys(b.processed).length,1);
  b.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},evidence:[fixture(1)]});
  assert.equal(Object.keys(b.processed).length,1);
  b.commit({checkpoint:22,block:{slot:22,blockhash:'block-22'},evidence:[fixture(2,1)]});
  assert.equal(Object.keys(b.processed).length,2);
  b.close();
  const c=new DepositLedger(filename,options);
  assert.equal(c.checkpoint,22);
  assert.equal(Object.keys(c.processed).length,2);
  c.close();
});
test('rejects inconsistent duplicate and leaves durable bytes and cursor unchanged', t => {
  const filename=pathFor(t);
  const ledger=new DepositLedger(filename,options);
  ledger.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},evidence:[fixture(1)]});
  const before=readFileSync(filename,'utf8');
  assert.throws(()=>ledger.commit({checkpoint:22,evidence:[{...fixture(1),amountBaseUnits:'1'}]}),
    /conflicting duplicate receipt identity/);
  assert.throws(()=>ledger.commit({checkpoint:22,evidence:[{...fixture(1),recipientCore:'unexpected'}]}),
    /conflicting duplicate receipt identity or evidence bytes/);
  assert.throws(()=>ledger.commit({checkpoint:22,block:{slot:21,blockhash:'fork'}}),
    /conflicting finalized blockhash/);
  assert.equal(ledger.checkpoint,21);
  assert.equal(readFileSync(filename,'utf8'),before);
  ledger.close();
});
test('single writer lock prevents independent workers from racing', t => {
  const filename=pathFor(t);
  const a=new DepositLedger(filename,options);
  assert.throws(()=>new DepositLedger(filename,options),/EEXIST/);
  assert.ok(existsSync(filename+'.lock'));
  a.close();
  const b=new DepositLedger(filename,options);
  b.close();
});
test('rejects changing trusted genesis, program or deployment slot after restart', t => {
  const filename=pathFor(t);
  const a=new DepositLedger(filename,options);
  a.commit({checkpoint:20});a.close();
  for(const override of [{genesisHash:'other'},{program:'other'},{trustedDeploymentSlot:21}]) {
    assert.throws(()=>new DepositLedger(filename,{...options,...override}),/incompatible\/corrupt/);
    assert.equal(existsSync(filename+'.lock'),false);
  }
});
test('rejects malformed evidence, swapped occurrence and checkpoint regression', t => {
  const filename=pathFor(t);
  const a=new DepositLedger(filename,options);
  a.commit({checkpoint:23,evidence:[fixture(1)]});
  assert.throws(()=>a.commit({checkpoint:22}),/regression/);
  assert.throws(()=>a.commit({checkpoint:24,evidence:[{...fixture(2),creditEligible:true}]}),
    /invalid or authoritative/);
  assert.throws(()=>a.commit({checkpoint:24,evidence:[{...fixture(2),occurrenceId:fixture(1).occurrenceId}]}),
    /duplicated instruction occurrence/);
  a.close();
});

test('recovery rejects corrupted evidence, recomputed unauthorized claims, malformed blocks and invalid maps', t => {
  const filename=pathFor(t);
  const a=new DepositLedger(filename,options);
  a.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},evidence:[fixture(1)]});
  a.close();
  const clean=JSON.parse(readFileSync(filename,'utf8'));
  const id=fixture(1).id;
  const sha256=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
  const cases=[
    state=>{state.processed[id].evidence.amountBaseUnits='999';},
    state=>{state.processed[id].evidence.creditEligible=true;
      state.processed[id].fingerprint=sha256(state.processed[id].evidence);},
    state=>{state.blocks['not-a-slot']='forged-block';},
    state=>{state.processed=[];},
    state=>{state.processed[id].occurrenceId='swapped-occurrence';},
  ];
  for (const damage of cases) {
    const altered=structuredClone(clean);
    damage(altered);
    writeFileSync(filename,JSON.stringify(altered)+'\n');
    assert.throws(()=>new DepositLedger(filename,options),/corrupt|incompatible/);
    assert.equal(existsSync(filename+'.lock'),false,'failed startup must release its writer lock');
  }
  writeFileSync(filename,JSON.stringify(clean)+'\n');
  const recovered=new DepositLedger(filename,options);
  assert.equal(recovered.checkpoint,21);
  assert.equal(Object.keys(recovered.processed).length,1);
  recovered.close();
});

test('abrupt worker termination preserves fsynced cursor, evidence and exclusive-lock recovery',t=>{
  const filename=pathFor(t);
  const moduleUrl=new URL('../src/ledger.mjs',import.meta.url).href;
  const childCode=`
    import { DepositLedger } from ${JSON.stringify(moduleUrl)};
    const ledger=new DepositLedger(process.argv[1],${JSON.stringify(options)});
    ledger.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},
      evidence:[${JSON.stringify(fixture(1))}]});
    process.exit(0); // abrupt exit: deliberately no close() / no lock-file cleanup
  `;
  const child=spawnSync(process.execPath,['--input-type=module','-e',childCode,filename],
    {encoding:'utf8',timeout:10000});
  assert.equal(child.status,0,child.stderr);
  assert.equal(existsSync(filename+'.lock'),true);
  assert.throws(()=>new DepositLedger(filename,options),/EEXIST/,
    'a crashed worker must never auto-steal a potentially active lock');
  // A human/operator must first establish that the previous PID is gone.
  unlinkSync(filename+'.lock');
  const recovered=new DepositLedger(filename,options);
  assert.equal(recovered.checkpoint,21);
  assert.equal(Object.keys(recovered.processed).length,1);
  recovered.commit({checkpoint:21,block:{slot:21,blockhash:'block-21'},
    evidence:[fixture(1)]});
  assert.equal(Object.keys(recovered.processed).length,1,'replay after crash is idempotent');
  recovered.close();
});
