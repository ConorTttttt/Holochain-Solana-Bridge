//! Holochain 0.7.1 / HDI 0.8.1 audit-only integrity model.
//! The integrity callback checks *shape and local DNA scope*, NOT Solana consensus.
use hdi::prelude::*;
use serde::{Deserialize, Serialize};

pub const KIND: &str = "solana-observation-demo-v1";
pub const SCHEMA: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub id: String,
    pub occurrence_id: String,
    pub genesis_hash: String,
    pub program: String,
    pub mint: String,
    pub holochain_scope: String,
    pub receipt_address: String,
    pub depositor: String,
    pub signature: String,
    pub finalized_slot: u64,
    pub instruction_index: u32,
    pub amount_base_units: String,
    pub source_event_type: String,
    pub witness_digest: String,
    pub code_version: String,
    pub schema_version: String,
    pub credit_eligible: bool,
    pub independent_consensus_verified: bool,
    pub spendable_base_units: String,
    pub withdrawal_authorized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProofLabel {
    pub evidence_kind: String,
    pub evidence_origin: String,
    pub verified_by_rpc_claim: bool,
    pub transaction_verified: bool,
    pub history_complete: bool,
    pub credit_eligible: bool,
    pub independent_consensus_verified: bool,
    pub spendable_base_units: String,
    pub withdrawal_authorized: bool,
}

#[hdk_entry_helper]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuditObservation {
    pub kind: String,
    pub schema_version: String,
    pub source: Source,
    pub proof: ProofLabel,
    pub credit_eligible: bool,
    pub independent_consensus_verified: bool,
    pub spendable_base_units: String,
    pub withdrawal_authorized: bool,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    AuditObservation(AuditObservation),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Domain {
    genesis_hash: String,
    program: String,
    mint: String,
    holochain_scope: String,
    demo_only: bool,
}

fn valid_denials(credit: bool, consensus: bool, units: &str, withdraw: bool) -> bool {
    !credit && !consensus && units == "0" && !withdraw
}

fn pubkey(value: &str, len: usize) -> bool {
    bs58::decode(value).into_vec().map(|x| x.len() == len).unwrap_or(false)
}

fn lowercase_hex_64(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|x| x.is_ascii_hexdigit() && !x.is_ascii_uppercase())
}

fn canonical_positive_u64(value: &str) -> bool {
    !value.starts_with('0') && !value.is_empty() && value.bytes().all(|x| x.is_ascii_digit())
        && value.parse::<u64>().ok().is_some_and(|n| n > 0)
}

fn scoped_domain() -> Result<Domain, String> {
    let info = dna_info().map_err(|_| "DNA info unavailable".to_string())?;
    let domain: Domain = rmp_serde::from_slice(info.modifiers.properties.bytes())
        .map_err(|_| "DNA scope properties invalid".to_string())?;
    if !domain.demo_only || !pubkey(&domain.genesis_hash, 32)
        || !pubkey(&domain.program, 32) || !pubkey(&domain.mint, 32)
        || !lowercase_hex_64(&domain.holochain_scope)
    {
        return Err("DNA must contain concrete disposable Solana scope".to_string());
    }
    Ok(domain)
}

/// The same validator runs before a coordinator create and on DHT validation.
/// All values are claims from an untrusted remote system until verified externally.
pub fn check(item: &AuditObservation) -> Result<(), String> {
    let s = &item.source;
    let p = &item.proof;
    let domain = scoped_domain()?;
    if item.kind != KIND || item.schema_version != SCHEMA || s.schema_version != SCHEMA {
        return Err("unsupported observation schema".into());
    }
    if !valid_denials(item.credit_eligible, item.independent_consensus_verified,
            &item.spendable_base_units, item.withdrawal_authorized)
        || !valid_denials(s.credit_eligible, s.independent_consensus_verified,
            &s.spendable_base_units, s.withdrawal_authorized)
        || !valid_denials(p.credit_eligible, p.independent_consensus_verified,
            &p.spendable_base_units, p.withdrawal_authorized) {
        return Err("missing or escalated economic denial fields".into());
    }
    if s.genesis_hash != domain.genesis_hash || s.program != domain.program
        || s.mint != domain.mint || s.holochain_scope != domain.holochain_scope {
        return Err("wrong DNA source scope".into());
    }
    if s.source_event_type != "deposit" || s.finalized_slot == 0
        || s.code_version.is_empty() || s.code_version.len() > 96
        || !pubkey(&s.receipt_address, 32) || !pubkey(&s.depositor, 32)
        || !pubkey(&s.signature, 64)
        || !canonical_positive_u64(&s.amount_base_units)
        || !lowercase_hex_64(&s.witness_digest)
        || p.evidence_kind != "solana-deposit-evidence-v1"
        || (p.evidence_origin != "test_only_fixture"
            && p.evidence_origin != "observer_reviewed_outbox")
        || !p.transaction_verified || !p.verified_by_rpc_claim || p.history_complete {
        return Err("invalid deposit event / witness / coverage claim".into());
    }
    // OBS source identity format and compiled instruction occurrence, not an arbitrary name.
    if s.id != format!("{}:{}:{}", s.genesis_hash, s.program, s.receipt_address)
        || s.occurrence_id != format!("{}:{}:{}:outer:{}",
            s.genesis_hash, s.program, s.signature, s.instruction_index) {
        return Err("source ID / occurrence mismatch".into());
    }
    Ok(())
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    if matches!(&op, Op::RegisterUpdate(_) | Op::RegisterDelete(_)
        | Op::RegisterCreateLink(_) | Op::RegisterDeleteLink(_)) {
        return Ok(ValidateCallbackResult::Invalid("audit DNA is append-only".into()));
    }
    match op.flattened()? {
        FlatOp::StoreEntry(OpEntry::CreateEntry { app_entry: EntryTypes::AuditObservation(item), .. }) => {
            Ok(match check(&item) {
                Ok(()) => ValidateCallbackResult::Valid,
                Err(reason) => ValidateCallbackResult::Invalid(reason),
            })
        }
        _ => Ok(ValidateCallbackResult::Valid),
    }
}
