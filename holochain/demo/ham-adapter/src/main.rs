//! Agent-authored, signed, deny-by-default HAM adapter. Never calls published Unyt.
//! All stdout is public metadata only; raw HAM errors may contain a Lair URL token,
//! so failures emit a fixed class instead of the error debug/display string.
use anyhow::{anyhow, Result};
use ham::{CapGrantOptIn, Ham, HamConfig, LairCredentials};
use holochain_client::CellInfo;
use holo_hash::ActionHash;
use serde::{Deserialize, Serialize};
use std::{env, fs, path::PathBuf};

const ROLE: &str = "audit";
const ZOME: &str = "solana_audit";
const KIND: &str = "solana-observation-demo-v1";
const SCHEMA: &str = "1";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Source {
    id: String, occurrence_id: String, genesis_hash: String,
    program: String, mint: String, holochain_scope: String,
    receipt_address: String, depositor: String, signature: String,
    finalized_slot: u64, instruction_index: u32,
    amount_base_units: String, source_event_type: String,
    witness_digest: String, code_version: String, schema_version: String,
    credit_eligible: bool, independent_consensus_verified: bool,
    spendable_base_units: String, withdrawal_authorized: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Proof {
    evidence_kind: String, evidence_origin: String,
    verified_by_rpc_claim: bool, transaction_verified: bool,
    history_complete: bool,
    credit_eligible: bool, independent_consensus_verified: bool,
    spendable_base_units: String, withdrawal_authorized: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Observation {
    kind: String, schema_version: String, source: Source, proof: Proof,
    credit_eligible: bool, independent_consensus_verified: bool,
    spendable_base_units: String, withdrawal_authorized: bool,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Contract {
    kind: String, schema_version: String, functions: Vec<String>, audit_only: bool,
    credit_eligible: bool, independent_consensus_verified: bool,
    spendable_base_units: String, withdrawal_authorized: bool,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Record {
    action_hash: ActionHash, observation: Observation,
}

fn mandatory(name: &str) -> Result<String> {
    let v = env::var(name).map_err(|_| anyhow!("missing mandatory config: {name}"))?;
    if v.is_empty() { return Err(anyhow!("empty mandatory config: {name}")); }
    Ok(v)
}
fn env_port(name: &str) -> Result<u16> { Ok(mandatory(name)?.parse()?) }
fn denials(a: bool, b: bool, units: &str, c: bool) -> bool {
    !a && !b && units == "0" && !c
}
fn check_observation(o: &Observation) -> Result<()> {
    if o.kind != KIND || o.schema_version != SCHEMA || o.source.schema_version != SCHEMA
        || !denials(o.credit_eligible,o.independent_consensus_verified,&o.spendable_base_units,o.withdrawal_authorized)
        || !denials(o.source.credit_eligible,o.source.independent_consensus_verified,&o.source.spendable_base_units,o.source.withdrawal_authorized)
        || !denials(o.proof.credit_eligible,o.proof.independent_consensus_verified,&o.proof.spendable_base_units,o.proof.withdrawal_authorized)
        || o.source.source_event_type != "deposit"
        || o.proof.evidence_kind != "solana-deposit-evidence-v1"
        || !o.proof.transaction_verified || !o.proof.verified_by_rpc_claim || o.proof.history_complete {
        return Err(anyhow!("OBS_SCHEMA_OR_DENIAL_REFUSED"));
    }
    for (actual, name) in [(&o.source.genesis_hash,"SOLANA_GENESIS"),
        (&o.source.program,"SOLANA_PROGRAM"), (&o.source.mint,"SOLANA_MINT"),
        (&o.source.holochain_scope,"SOLANA_SCOPE")] {
        if actual != &mandatory(name)? { return Err(anyhow!("OBS_SCOPE_REFUSED")); }
    }
    if o.source.id != format!("{}:{}:{}", o.source.genesis_hash,o.source.program,o.source.receipt_address)
        || o.source.occurrence_id != format!("{}:{}:{}:outer:{}",
            o.source.genesis_hash,o.source.program,o.source.signature,o.source.instruction_index) {
        return Err(anyhow!("OBS_SOURCE_ID_REFUSED"));
    }
    // Until Agent 3 exports an approved authenticated outbox format, only
    // explicitly marked schema/test fixtures may be passed to the demo DNA.
    if o.proof.evidence_origin != "test_only_fixture"
        || env::var("DEMO_ALLOW_TEST_ONLY_FIXTURE").as_deref() != Ok("1") {
        return Err(anyhow!("OBS_OUTBOX_NOT_YET_APPROVED"));
    }
    Ok(())
}

async fn connect_preflight() -> Result<Ham> {
    let app_id = mandatory("DEMO_APP_ID")?;
    if app_id.contains("unyt") || app_id.contains("Unyt") {
        return Err(anyhow!("PUBLISHED_UNYT_APP_REFUSED"));
    }
    let config = HamConfig::new(env_port("DEMO_ADMIN_PORT")?, env_port("DEMO_APP_PORT")?, app_id.clone())
        .with_request_timeout_secs(30)
        .with_signing(LairCredentials::Node {
            conductor_config: PathBuf::from(mandatory("DEMO_CONDUCTOR_CONFIG")?),
            passphrase_file: PathBuf::from(mandatory("DEMO_LAIR_PASSPHRASE_FILE")?),
        }, CapGrantOptIn::Withheld)
        .map_err(|_| anyhow!("LAIR_REQUIRED_OR_INVALID"))?;
    let ham = Ham::connect(config).await.map_err(|_| anyhow!("HAM_LAIR_OR_WEBSOCKET_UNAVAILABLE"))?;
    ham.ping().await.map_err(|_| anyhow!("DEMO_APP_UNAVAILABLE"))?;
    let info = ham.app_info().await.map_err(|_| anyhow!("DEMO_APP_IDENTITY_FAILED"))?
        .ok_or_else(|| anyhow!("DEMO_APP_NOT_INSTALLED"))?;
    if info.installed_app_id != app_id { return Err(anyhow!("DEMO_APP_ID_MISMATCH")); }
    let cells = info.cell_info.get(ROLE).ok_or_else(|| anyhow!("DEMO_ROLE_MISMATCH"))?;
    if cells.len() != 1 { return Err(anyhow!("DEMO_ROLE_CARDINALITY")); }
    let cell = match &cells[0] {
        CellInfo::Provisioned(c) => &c.cell_id,
        _ => return Err(anyhow!("DEMO_PROVISIONED_CELL_REQUIRED")),
    };
    if cell != ham.cell_id()
        || cell.dna_hash().to_string() != mandatory("DEMO_EXPECTED_DNA_HASH")?
        || cell.agent_pubkey().to_string() != mandatory("DEMO_EXPECTED_AGENT")? {
        return Err(anyhow!("DEMO_DNA_OR_SIGNER_MISMATCH"));
    }
    // The only ABI preflight call is OUR disposable demo zome's get_contract.
    let contract: Contract = ham.call_zome(ROLE, ZOME, "get_contract", ()).await
        .map_err(|_| anyhow!("DEMO_ABI_UNAVAILABLE"))?;
    if contract.kind != KIND || contract.schema_version != SCHEMA || !contract.audit_only
        || contract.functions != ["get_contract", "record_observation", "get_observation", "list_observations"]
        || !denials(contract.credit_eligible,contract.independent_consensus_verified,
            &contract.spendable_base_units,contract.withdrawal_authorized) {
        return Err(anyhow!("DEMO_ABI_MISMATCH"));
    }
    Ok(ham)
}

#[tokio::main]
async fn main() {
    if let Err(e) = execute().await {
        // All errors raised in this file have fixed and non-sensitive messages;
        // never serialize nested source chains or HAM errors into logs.
        eprintln!("REFUSED: {}", e);
        std::process::exit(1);
    }
}
async fn execute() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    let command = args.get(1).map(String::as_str).ok_or_else(|| anyhow!("USAGE preflight|deliver <json>|read <id>"))?;
    if !["preflight", "deliver", "read"].contains(&command) {
        return Err(anyhow!("FUNCTION_NOT_ALLOWLISTED"));
    }
    // Validate input before any socket/write. No calls to published Unyt apps.
    let observation = if command == "deliver" {
        let path = args.get(2).ok_or_else(|| anyhow!("MISSING_INPUT_PATH"))?;
        let data = fs::read(path).map_err(|_| anyhow!("INPUT_READ_REFUSED"))?;
        if data.len() > 32 * 1024 { return Err(anyhow!("INPUT_TOO_LARGE")); }
        let item: Observation = serde_json::from_slice(&data)
            .map_err(|_| anyhow!("INPUT_SCHEMA_REFUSED"))?;
        check_observation(&item)?;
        Some(item)
    } else { None };
    let ham = connect_preflight().await?;
    match command {
        "preflight" => println!("DEMO_HAM_PREFLIGHT_OK (signed demo agent; no Unyt call)"),
        "deliver" => {
            let item = observation.ok_or_else(|| anyhow!("MISSING_ITEM"))?;
            let prior: Option<Record> = ham.call_zome(ROLE, ZOME, "get_observation", item.source.id.clone())
                .await.map_err(|_| anyhow!("DEMO_READ_BEFORE_WRITE_FAILED"))?;
            if let Some(prior) = &prior {
                if prior.observation != item { return Err(anyhow!("DEMO_DUPLICATE_CONFLICT")); }
            }
            let saved: Record = match prior {
                Some(prior) => prior,
                None => ham.call_zome(ROLE,ZOME,"record_observation",item.clone()).await
                    .map_err(|_| anyhow!("DEMO_SIGNED_WRITE_FAILED"))?,
            };
            let read: Option<Record> = ham.call_zome(ROLE,ZOME,"get_observation",item.source.id.clone())
                .await.map_err(|_| anyhow!("DEMO_READBACK_FAILED"))?;
            let read = read.ok_or_else(|| anyhow!("DEMO_MISSING_READBACK"))?;
            if read.action_hash != saved.action_hash || read.observation != item {
                return Err(anyhow!("DEMO_CONTRADICTORY_READBACK"));
            }
            println!("{}",serde_json::json!({
                "status":"test_only_delivered_to_demo_dna", "actionHash":saved.action_hash.to_string(),
                "sourceId":item.source.id,"creditEligible":false,
                "independentConsensusVerified":false,"spendableBaseUnits":"0",
                "withdrawalAuthorized":false,"independentFinalityProof":false,
            }));
        },
        "read" => {
            let id = args.get(2).ok_or_else(||anyhow!("MISSING_SOURCE_ID"))?;
            let saved: Option<Record> = ham.call_zome(ROLE,ZOME,"get_observation",id.clone())
                .await.map_err(|_| anyhow!("DEMO_READ_FAILED"))?;
            let saved = saved.ok_or_else(||anyhow!("DEMO_OBSERVATION_NOT_FOUND"))?;
            println!("{}",serde_json::to_string(&saved)
                .map_err(|_| anyhow!("OUTPUT_ENCODING_FAILED"))?);
        },
        _ => unreachable!(),
    }
    Ok(())
}
