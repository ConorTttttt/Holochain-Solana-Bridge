//! A minimal signed audit statement store for ONE local Holochain agent.
//! No credit, balance, spend, grant, withdrawal, remote call or RAVE operations.
use hdk::prelude::*;
use serde::{Deserialize, Serialize};
use solana_audit_integrity::{check, AuditObservation, EntryTypes, KIND, SCHEMA};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditRecord {
    pub action_hash: ActionHash,
    pub observation: AuditObservation,
    pub credit_eligible: bool,
    pub independent_consensus_verified: bool,
    pub spendable_base_units: String,
    pub withdrawal_authorized: bool,
}
fn audit_record(action_hash: ActionHash, observation: AuditObservation) -> AuditRecord {
    AuditRecord { action_hash, observation,
        credit_eligible: false, independent_consensus_verified: false,
        spendable_base_units: "0".into(), withdrawal_authorized: false }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemoContract {
    pub kind: String,
    pub schema_version: String,
    pub functions: Vec<String>,
    pub audit_only: bool,
    pub credit_eligible: bool,
    pub independent_consensus_verified: bool,
    pub spendable_base_units: String,
    pub withdrawal_authorized: bool,
}

#[hdk_extern]
pub fn get_contract(_: ()) -> ExternResult<DemoContract> {
    Ok(DemoContract {
        kind: KIND.into(), schema_version: SCHEMA.into(),
        functions: vec!["get_contract".into(), "record_observation".into(),
            "get_observation".into(), "list_observations".into()],
        audit_only: true, credit_eligible: false,
        independent_consensus_verified: false, spendable_base_units: "0".into(),
        withdrawal_authorized: false,
    })
}

fn local_records() -> ExternResult<Vec<AuditRecord>> {
    let records = query(ChainQueryFilter::new()
        .entry_type(EntryType::App(solana_audit_integrity::UnitEntryTypes::AuditObservation.into()))
        .include_entries(true))?;
    let mut out = Vec::new();
    for record in records {
        if let Some(observation) = record.entry().to_app_option::<AuditObservation>()? {
            out.push(audit_record(record.action_address().clone(), observation));
        }
    }
    Ok(out)
}

#[hdk_extern]
pub fn get_observation(source_id: String) -> ExternResult<Option<AuditRecord>> {
    let found = local_records()?.into_iter().find(|r| r.observation.source.id == source_id);
    Ok(found)
}

#[hdk_extern]
pub fn list_observations(_: ()) -> ExternResult<Vec<AuditRecord>> {
    local_records()
}

#[hdk_extern]
pub fn record_observation(item: AuditObservation) -> ExternResult<AuditRecord> {
    check(&item).map_err(|reason| wasm_error!(WasmErrorInner::Guest(reason)))?;
    // Local-author idempotence only, not a global exactly-once guarantee.
    if let Some(previous) = get_observation(item.source.id.clone())? {
        if previous.observation == item {
            return Ok(previous);
        }
        return Err(wasm_error!(WasmErrorInner::Guest(
            "conflicting observation bytes for source ID".into())));
    }
    let action_hash = create_entry(&EntryTypes::AuditObservation(item.clone()))?;
    Ok(audit_record(action_hash, item))
}
