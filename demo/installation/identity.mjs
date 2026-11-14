// Untrusted Admin JSON consistency check, NOT a substitute for an authenticated
// on-host capture, operator attestation, external Lair proof or an approval.
import assert from 'node:assert/strict';
export function compareAdminSnapshots(request,apps,cells){
 assert.ok(Array.isArray(apps)&&apps.length===1,'EXPECTED_ONE_DISPOSABLE_APP');
 assert.ok(Array.isArray(cells)&&cells.length===1,'EXPECTED_ONE_CELL');
 const app=apps[0];assert.equal(app.installed_app_id,request.appId,'WRONG_APP');
 assert.equal(app.status?.type,'enabled','APP_NOT_ENABLED');
 assert.deepEqual(Object.keys(app.cell_info).sort(),['audit'],'WRONG_ROLES');
 assert.equal(app.cell_info.audit.length,1,'AMBIGUOUS_ROLE');
 const info=app.cell_info.audit[0];assert.equal(info.type,'provisioned','CLONED_OR_DISABLED_CELL');
 const cell=info.value.cell_id;
 assert.equal(cell.dna_hash,request.dnaHash,'WRONG_DNA');
 assert.match(app.agent_pub_key,/^uhCAk[A-Za-z0-9_-]{48}$/,'INVALID_AGENT');
 assert.equal(cell.agent_pub_key,app.agent_pub_key,'APP_AGENT_DIFFERS_FROM_CELL');
 assert.deepEqual(cells[0],cell,'ADMIN_CELL_LIST_DIFFERS');
 return {schema:'hsc-admin-snapshot-consistency-v1',
  evidenceGrade:'UNAUTHENTICATED_SNAPSHOTS_CONSISTENT_REQUIRES_OPERATOR_ATTESTATION',
  appId:request.appId,role:'audit',cellId:[cell.dna_hash,cell.agent_pub_key],
  agentPubKey:app.agent_pub_key,externalLairSignerPossessionVerified:false,
  installationAuthorizationSupplied:false,signedCallApproved:false,actionHash:null,
  creditEligible:false,independentConsensusVerified:false,spendableBaseUnits:'0',withdrawalAuthorized:false};
}
