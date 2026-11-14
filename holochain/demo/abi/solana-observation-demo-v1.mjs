/** Proposed Agent 3 -> Agent 4 ABI (NOT a verified signed OBS outbox yet).
 *  No network calls, trust escalation, token balances, or signing functions.
 */
const max = (1n << 64n) - 1n;
const common = ['creditEligible', 'independentConsensusVerified', 'spendableBaseUnits', 'withdrawalAuthorized'];
const sourceFields = ['id','occurrenceId','genesisHash','program','mint','holochainScope',
  'receiptAddress','depositor','signature','finalizedSlot','instructionIndex',
  'amountBaseUnits','sourceEventType','witnessDigest','codeVersion','schemaVersion',...common];
const proofFields = ['evidenceKind','evidenceOrigin','verifiedByRpcClaim','transactionVerified',
  'historyComplete',...common];
const rootFields = ['kind','schemaVersion','source','proof',...common];
const fail = (reason) => { throw new Error(`AUDIT_ONLY_SCHEMA_REFUSAL:${reason}`); };
function exact(o,keys,path) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) fail(`${path}:object`);
  const names = Object.keys(o);
  if (names.length !== keys.length || names.some(k=>!keys.includes(k))) fail(`${path}:unknown_or_missing_field`);
}
function deny(o,path) {
  if (o.creditEligible !== false || o.independentConsensusVerified !== false
      || o.spendableBaseUnits !== '0' || o.withdrawalAuthorized !== false) fail(`${path}:economic_escalation`);
}
function b58(value) { return typeof value==='string' && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value); }
function validB58Length(text,byteCount) {
  if (!b58(text)) return false;
  let n=0n;
  for(const ch of text) n=n*58n+BigInt('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.indexOf(ch));
  let len=n===0n?0:Math.ceil(n.toString(16).length/2);
  len+=(text.match(/^1+/)?.[0].length??0);
  return len===byteCount;
}
const hex64 = (v) => typeof v==='string' && /^[0-9a-f]{64}$/.test(v);
export function validateDemoObservation(item,expected) {
  exact(item,rootFields,'root'); exact(item.source,sourceFields,'source'); exact(item.proof,proofFields,'proof');
  deny(item,'root'); deny(item.source,'source'); deny(item.proof,'proof');
  const s=item.source,p=item.proof;
  if (item.kind!=='solana-observation-demo-v1' || item.schemaVersion!=='1' || s.schemaVersion!=='1') fail('version');
  for(const k of ['genesisHash','program','mint','holochainScope']) {
    if (s[k]!==expected?.[k]) fail(`scope:${k}`);
  }
  for(const k of ['genesisHash','program','mint','receiptAddress','depositor']) {
    if (!validB58Length(s[k],32)) fail(`pubkey:${k}`);
  }
  if (!validB58Length(s.signature,64)) fail('signature_shape');
  if (!hex64(s.holochainScope) || !hex64(s.witnessDigest)) fail('hex_digest_or_scope');
  if (!Number.isSafeInteger(s.finalizedSlot) || s.finalizedSlot<1 ||
      !Number.isInteger(s.instructionIndex) || s.instructionIndex<0 || s.instructionIndex>0xffffffff) fail('slot_or_instruction');
  if (typeof s.amountBaseUnits!=='string' || !/^[1-9][0-9]*$/.test(s.amountBaseUnits)
      || BigInt(s.amountBaseUnits)>max) fail('u64_amount');
  if (s.sourceEventType!=='deposit') fail('unsupported_transition');
  if (typeof s.codeVersion!=='string' || s.codeVersion.length===0 || s.codeVersion.length>96) fail('code_version');
  if (s.id!==`${s.genesisHash}:${s.program}:${s.receiptAddress}` ||
      s.occurrenceId!==`${s.genesisHash}:${s.program}:${s.signature}:outer:${s.instructionIndex}`) fail('source_identity');
  if (p.evidenceKind!=='solana-deposit-evidence-v1' || p.transactionVerified!==true ||
      p.verifiedByRpcClaim!==true || p.historyComplete!==false ||
      !['test_only_fixture','observer_reviewed_outbox'].includes(p.evidenceOrigin)) fail('evidence_provenance');
  return true;
}
export const ECONOMIC_DENIALS = Object.freeze({creditEligible:false,independentConsensusVerified:false,
  spendableBaseUnits:'0',withdrawalAuthorized:false});
