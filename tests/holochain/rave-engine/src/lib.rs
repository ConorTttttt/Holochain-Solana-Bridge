//! Isolated tests of published crate APIs, not deployed DNA/zomes.
//! Run with: cargo test --manifest-path tests/holochain/rave-engine/Cargo.toml

#[cfg(test)]
mod tests {
    use rave_engine::reserve::ReserveUnits;
    use rave_engine::types::UnitMap;
    use serde_json::json;

    fn permitted(value: serde_json::Value) -> bool {
        let amount = UnitMap::try_from(value).expect("valid UnitMap fixture");
        ReserveUnits {
            debit_unit_index: "1".to_string(),
            credit_unit_index: "0".to_string(),
        }
        .accepts(&amount)
    }

    #[test]
    fn exact_conserved_reserve_is_accepted() {
        assert!(permitted(json!({ "1": "-5.00", "0": "5" })));
    }

    #[test]
    fn nonconservation_reverse_direction_extra_unit_and_zero_are_refused() {
        for amount in [
            json!({ "1": "-5", "0": "6" }),
            json!({ "1": "5", "0": "-5" }),
            json!({ "1": "-5", "0": "5", "2": "0" }),
            json!({ "1": "0", "0": "0" }),
        ] {
            assert!(!permitted(amount.clone()), "must reject {amount}");
        }
    }
}

#[cfg(test)]
mod published_execution_smoke {
    use rave_engine::prelude::RhaiEngine;
    use serde_json::json;

    // Uses the *published* rave_engine Rhai executor. This is not an Unyt RAVE
    // transaction, a validated agreement, or an external collateral proof.
    #[test]
    fn pure_rhai_engine_executes_an_empty_non_economic_result() {
        // 0.15.0 expects MessagePack-encoded Rust String for the execution code.
        let code = rmp_serde::to_vec(&"return #{};".to_string()).expect("encode Rhai source");
        let result = RhaiEngine::new().execute(&json!({}), code, None);
        assert!(result.is_ok(), "published engine should execute a pure script: {result:?}");
    }

    #[test]
    fn published_engine_rejects_an_undefined_expression() {
        let code = rmp_serde::to_vec(&"return missing_variable;".to_string()).expect("encode Rhai source");
        let result = RhaiEngine::new().execute(&json!({}), code, None);
        assert!(result.is_err(), "undefined Rhai variable must fail closed");
    }
}
