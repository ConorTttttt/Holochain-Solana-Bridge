# Exact Unyt Sandbox v0.117.0 WASM export surface — binary evidence, NOT zome authorization

**Date:** 2026-11-14 UTC. **Lane:** RAVE, issues #14/#18, draft PR #34. **Economic release gate:** BLOCKED.

## Provenance and reproducibility

The independently verified [five-job CI run 43536513700](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43536513700) at `b94774816a38c35805b835a4c1ef78ae4432d714` published inventory artifact **14090070860**, named `rave-unyt-hc-inventory-b94774816a38c35805b835a4c1ef78ae4432d714`. Artifact ZIP SHA-256 verified locally as:

```text
26796385a34f35b7d5f20f389b770d79b442178a3c314194ae061dac6e3cfe  inventory.zip
8337488fcff06e8d1b37f68bc8dc2a14a33492769bce1fdb183406ae032c770d  transactor.wasm
1bcbf9993e5695247d9c54c7b3ee1cbd825cf4167606ee6af3691a39d01a68ab  transactor_integrity.wasm
```

Source of these bytes: GitHub Actions artifact containing the WASMs unpacked from the previously cryptographically checked **public** `unytco/unyt-sandbox@v0.117.0` release. The hApp has role `alliance`, coordinator `transactor`, integrity `transactor_integrity`; its **local installed** Holochain 0.7.1 DNA hash, independently checked by conductor restart, is `uhC0k1RtXY23HgGGKZdpNkF9Q_w8jwv57nviRQISGc4Ykw5SKGTDZ`. This is not production-network equivalence.

Run without executing guest code (Node.js 22):

```sh
unzip -oq inventory.zip 'hc-inspection/dna-unpacked/*.wasm' -d extracted
node tests/holochain/sandbox/inventory-verified-unyt-wasm.mjs \
  extracted/hc-inspection/dna-unpacked/transactor.wasm \
  extracted/hc-inspection/dna-unpacked/transactor_integrity.wasm \
  > export-inventory.json
```

The checked-in inspector checks both exact SHA-256s **before** compiling WASM for metadata, uses `WebAssembly.Module.exports`, never instantiates either module, and emits machine-readable complete exported function names and explicit `sourceEquivalent:false`, `auditedReadOnlyCall:false`, `capabilityRulesVerified:false` flags.

**Executed independently on recovered exact artifact bytes:** coordinator **122 exports** (121 functions, one memory), integrity **9 exports** (8 functions, one memory). A deliberately modified integrity WASM (one byte changed) was rejected with exit **2** and `BLOCKED_UNYT_EXPORT_INVENTORY: transactor_integrity: untrusted WASM bytes (SHA-256 mismatch)`. This negative test did not run inside the old five-job workflow. No function was invoked, so this is **actual binary inspection**, not actual zome execution.

## Coordinator function exports (complete name inventory)

The module exposes **52** `get_*` names:

```text
get_actionable_transactions, get_actionable_transactions_for_agent,
get_agent_state, get_agent_summary, get_agreement_bundle, get_all_agents,
get_all_conversion_sheets, get_all_lane, get_all_my_data_blobs, get_all_my_doc_defs,
get_all_my_nameable_units, get_all_my_rated_units_links, get_all_my_smart_agreements,
get_all_notification_links, get_all_smart_agreements, get_alliance_snapshot,
get_chain_standing, get_code_template, get_code_template_all_versions,
get_code_template_for_smart_agreements, get_code_templates_by_folder,
get_code_templates_lib, get_code_templates_lib_all, get_current_global_definition,
get_data_blob, get_data_blobs_for_doc_def, get_doc_def, get_global_units_details,
get_history, get_incoming_raves, get_lane_definitions_in_force,
get_latest_conversion_sheet, get_latest_global_definition, get_ledger,
get_migration_close_state, get_my_code_templates, get_my_current_applied_credit_limit,
get_opened_agreement_state, get_parked_link_standing, get_parked_links_by_ea,
get_parked_spend, get_project_bundle, get_raves_for_smart_agreement,
get_recovered_commitments, get_requests_to_execute_agreements, get_smart_agreement,
get_smart_agreement_all_versions, get_smart_agreements_for_code_template,
get_smart_agreements_with_versions, get_sorted_requests_to_spend, get_status,
get_transaction
```

Other 69 function exports:

```text
accept_paying_parked_invoice, add_global_units, check_agent_exists,
check_validation_receipts, close_agent_chain,
create_accept, create_code_template, create_collect_from_rave,
create_commit_to_proposal, create_commitment, create_conversion_table,
create_counter_proposal, create_data_blob, create_doc_def, create_parked_link,
create_parked_spend, create_proposal, create_receipt_for_accept,
create_receipt_from_rave, create_reclaim_balance, create_reject_proposal,
create_smart_agreement, drop_off_fees, entry_defs, execute_rave,
genesis_self_check_2, hdk_get, hdk_get_details, hdk_must_get_action,
hdk_must_get_entry, hdk_must_get_valid_record, ignore_notification, init,
initialize_global_definition, initialize_lane, initiate_credit_check,
notary_attest_close, notary_check_closing_summary, post_commit,
prepare_closing_summary, preview_migration_state, read_close_stretch,
recv_remote_signal, request_close_check,
schedule_unyt_bridging_n1_collect_withdrawals, search_code_template,
search_data_blob, search_smart_agreement, sign, trigger_transfer_in_request,
unyt_bridging_n2_initiate_deposit, update_code_template, update_data_blob,
update_lane_basic_properties, update_lane_definition, update_smart_agreement,
update_unit_def, validate, verify_if_migrated, whoami,
__forward_transfer_in_request, __getrandom_v03_custom, __hc__allocate_1,
__hc__deallocate_1, __listening_for_transfer_in_request,
__notify_user_of_transfer_in_request, __num_entry_types, __num_link_types,
__unyt_bridging_n2_oracle_deposit
```

**Caution:** Holochain callbacks, allocator functions, host-wrapper names and application names are mixed in this raw WASM export surface. Listing a function **does not** classify it as externally callable, read-only or safe. `get_*`, `whoami`, `get_status` and `preview_migration_state` are only **names**, not an approved audit-only interface. In particular, `get_parked_link_standing` and `get_recovered_commitments` cannot establish any fork or replay safety by existing as exports.

## Integrity export names

```text
__getrandom_v03_custom, __hc__allocate_1, __hc__deallocate_1,
__num_entry_types, __num_link_types, entry_defs, genesis_self_check_2, validate
```

Presence of `entry_defs`, `__num_entry_types`, `__num_link_types`, `validate` and `genesis_self_check_2` confirms exports, **not** the concrete entry types, link types, validation logic, countersigning policy, warrants or ReviewZome behavior. Their specific definitions and semantics remain **unknown**. Never label a guessed entry/link schema production-equivalent.

## Exact-source, capability and execution gate

The [official v0.117.0 `.gitmodules`](https://github.com/unytco/unyt-sandbox/blob/v0.117.0/.gitmodules) points to `git@github.com:unytco/unyt-app.git`. The release's exact submodule gitlink is `unytco/unyt-app@d2fa9c58c51a6a5f4aac8e7c6986bc2cc1ea1fdf`. Connected GitHub credentials receive **404** for this source repository. No authenticated source revision, reproducible source-to-WASM build, actual function argument/return schema, code-level read-only guarantee or actual grant for the proposed caller was obtained.

Holochain **0.7.1** distinguishes `Capability::ZomeCall` from `Capability::DirectSignal` and constrains grants to explicitly authorized zome/functions/agents/secrets. An author-key grant is not a safety analysis. See [official Holochain 0.7 upgrade notes](https://developer.holochain.org/resources/upgrade/upgrade-holochain-0.7/) and [0.7.1 capability types](https://docs.rs/holochain_integrity_types/0.7.1/holochain_integrity_types/capability/). Do not attempt `hc client` zome calls based only on exported names or invent a capability grant.

**Therefore no Unyt coordinator zome call was attempted**, including `whoami`. Read-only conductor **Admin API** calls `list-apps` and `list-cells` remain the only executed post-restart queries. A legitimate next call requires (1) source or an authoritative source-equivalent audited interface, (2) exact safe input/output schema and side-effect analysis, (3) actual caller authentication/capability, (4) explicit approval of the harmless call, then (5) reproducible conductor execution and restart evidence.

## Network, multi-agent, RAVE and numeric boundaries

- The previously successful disposable real conductor run persisted the enabled `alliance` cell through restart. Its generated config still records public development bootstrap and Iroh relay endpoints despite `network mem`; there is **no packet-level isolation proof**. CI logs redact Lair socket authentication tokens and the artifact does **not** contain keystores or databases.
- **Genuine runtime:** single-conductor installation/restart and admin identity checks. **Not executed against real Unyt zomes:** two independent conductor keys, fork/partition/rejoin, duplicate source-chain commitments, parked/unparked standing, recovery reuse, agreement replacements, migration epochs, invalid previous execution IDs, forged observations, source-chain warrants or ReviewZome validation.
- **Published RAVE crate:** pinned `rave_engine=0.15.0` Rust host checks passed in previous CI; those cannot be promoted to Unyt WASM validation. **Synthetic adapter:** existing 39 Node shadow tests passed; they are explicitly in-memory, non-economic and do not prove cross-conductor uniqueness.
- **Numerics:** preserve Observer decimal-string `u64` SPL base units independently of RAVE `ZFuel` signed `i64` stored units with precision up to six. `2^53+1` is valid as a decimal `u64` string but unsafe as a JS numeric token; `u64::MAX` is not representable as a positive `i64`. No implicit scaling or coercion is authorized without explicit mint precision and source/target unit definitions. Existing Rust numeric regressions cover exact boundary strings. Observer claims remain **untrusted** until independently verified.
- **Economic gates unchanged:** `creditEligible:false`, `spendableBaseUnits:"0"`, `withdrawalAuthorized:false`. No spendable credit, economic finality, transfers or withdrawals.

## Handoff

**Unyt maintainer / RAVE:** provide access to the exact gitlink or a signed source-equivalence attestation, immutable function argument/return ABI, capability rules, and an expressly approved harmless function. **CI owner:** run the SHA-locked export inventory on the already-verified unpacked WASMs; do not weaken release signature, install/restart or redaction gates. **SEC:** independently review any function before granting call authorization and require genuine two-conductor validation before upgrading finality claims. **OBS:** only deliver actual signed local-validator transaction evidence as untrusted input; do not relabel mock fixtures as validator provenance.

**Status: static export discovery completed; source/semantics/capabilities and real-zome execution blocked. PR stays DRAFT; STOP SHIP.**
