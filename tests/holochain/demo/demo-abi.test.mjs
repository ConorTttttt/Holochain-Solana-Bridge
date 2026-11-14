import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDemoObservation, ECONOMIC_DENIALS} from '../../../holochain/demo/abi/solana-observation-demo-v1.mjs';
const genesisHash='Ay3GSFNuCwTjMzLSyotzzsYcbdQfVAqrZwkdeHFN4wDK';
const program='EHT4VAKN1p1XMVkANkMunF8T6Hv3ASskRNDiEPQZ8nYh';
const mint='HbyzbpqUCx6A9g7xzau81eNvtJ6Ak4dTBaN1dHGxzyBc';
const holochainScope='07'.repeat(32);
const receiptAddress='1'.repeat(32); // synthetic, 32 zero bytes (NOT real receipt)
const depositor='1'.repeat(32);
const signature='1'.repeat(64); // synthetic, 64 zero bytes (NOT signed evidence)
const domain={genesisHash,program,mint,holochainScope};
function fixture(){return {kind:'solana-observation-demo-v1',schemaVersion:'1',
  ...ECONOMIC_DENIALS, source:{...ECONOMIC_DENIALS,
    id:`${genesisHash}:${program}:${receiptAddress}`,
    occurrenceId:`${genesisHash}:${program}:${signature}:outer:0`,
    genesisHash,program,mint,holochainScope,receiptAddress,depositor,signature,
    finalizedSlot:17,instructionIndex:0,amountBaseUnits:'250000',sourceEventType:'deposit',
    witnessDigest:'ab'.repeat(32),codeVersion:'test-only-obs-2931c5f',schemaVersion:'1'},
  proof:{...ECONOMIC_DENIALS,evidenceKind:'solana-deposit-evidence-v1',
    evidenceOrigin:'test_only_fixture',verifiedByRpcClaim:true, transactionVerified:true,
    historyComplete:false}}; }
test('positive is a SCHEMA fixture only; not genuine Solana verification',()=>assert.equal(validateDemoObservation(fixture(),domain),true));
function bad(name,change){test('reject '+name,()=>{const f=fixture();change(f);assert.throws(()=>validateDemoObservation(f,domain),/AUDIT_ONLY_SCHEMA_REFUSAL/);});}
bad('root credit',f=>f.creditEligible=true);
bad('nested source consensus flag',f=>f.source.independentConsensusVerified=true);
bad('proof spendable units',f=>f.proof.spendableBaseUnits='1');
bad('source withdrawal',f=>f.source.withdrawalAuthorized=true);
bad('missing nested denial',f=>delete f.proof.creditEligible);
bad('extra economic field',f=>f.balance='100');
bad('wrong source scope',f=>f.source.holochainScope='00'.repeat(32));
bad('wrong DNA genesis',f=>f.source.genesisHash='1'.repeat(32));
bad('overflow amount',f=>f.source.amountBaseUnits='18446744073709551616');
bad('leading zero amount',f=>f.source.amountBaseUnits='0001');
bad('negative amount',f=>f.source.amountBaseUnits='-1');
bad('zero amount',f=>f.source.amountBaseUnits='0');
bad('bad source ID',f=>f.source.id+=':second');
bad('bad occurrence',f=>f.source.occurrenceId+=':extra');
bad('bad witness digest',f=>f.source.witnessDigest='z'.repeat(64));
bad('refund transition not approved',f=>f.source.sourceEventType='refund');
bad('unsupported schema',f=>f.schemaVersion='2');
bad('independent history cover claim',f=>f.proof.historyComplete=true);
bad('invented provenance',f=>f.proof.evidenceOrigin='trusted_finality');
bad('unsigned source shape',f=>f.source.signature='abc');

// The target boundary must not accept a crafted 'reviewed' label on arbitrary JSON.
// Real OBS delivery needs independently reviewed authenticated source-owned code.
bad('unapproved observer_reviewed_outbox origin',f=>f.proof.evidenceOrigin='observer_reviewed_outbox');
bad('no source witness digest',f=>f.source.witnessDigest='');
bad('claim of missing transaction verification',f=>f.proof.transactionVerified=false);
bad('claim of missing RPC verification',f=>f.proof.verifiedByRpcClaim=false);
bad('unsupported empty finalized slot',f=>f.source.finalizedSlot=0);
bad('unsafe JSON number for finalized slot',f=>f.source.finalizedSlot=9007199254740992);
bad('negative instruction index',f=>f.source.instructionIndex=-1);
bad('instruction index overflow',f=>f.source.instructionIndex=4294967296);
bad('trailing extra proof field',f=>f.proof.evidenceAuth='trusted');
bad('wrong mint',f=>f.source.mint='1'.repeat(32));
bad('wrong program',f=>f.source.program='1'.repeat(32));
bad('wrong evidence kind',f=>f.proof.evidenceKind='solana-refund-evidence-v1');
bad('malformed depositor',f=>f.source.depositor='abc');
bad('extra source proof field',f=>f.source.ledgerReceipt='self_signed');
bad('numeric amount instead of exact decimal string',f=>f.source.amountBaseUnits=250000);
