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

#[cfg(test)]
mod published_parked_standing_types {
    use rave_engine::types::ParkedLinkStanding;

    #[test]
    fn non_parked_standings_cannot_satisfy_signer_precondition() {
        fn is_parked(value: &ParkedLinkStanding) -> bool {
            matches!(value, ParkedLinkStanding::Parked(_))
        }
        for value in [
            ParkedLinkStanding::NotHeld,
            ParkedLinkStanding::NotAParkedLink,
            ParkedLinkStanding::Unparked,
        ] {
            assert!(!is_parked(&value));
        }
    }
}


#[cfg(test)]
mod sprint1_published_crate_adversarial {
    use rave_engine::reserve::ReserveUnits;
    use rave_engine::types::UnitMap;
    use rave_engine::prelude::RhaiEngine;
    use serde_json::{json, Value};

    fn accepts_shape(input: Value) -> bool {
        let Ok(amounts) = UnitMap::try_from(input) else { return false; };
        ReserveUnits {
            debit_unit_index: "1".to_string(),
            credit_unit_index: "0".to_string(),
        }.accepts(&amounts)
    }

    #[test]
    fn exact_reserve_over_javascript_safe_integer_limit() {
        // Real published ReserveUnits amount-shape check, not bridge solvency.
        assert!(accepts_shape(json!({
            "1": "-9007199254740993",
            "0": "9007199254740993"
        })));
    }

    #[test]
    fn malformed_or_nonconserving_unit_maps_never_pass_shape_validation() {
        // Treat both conversion failures and ReserveUnits refusal as denial.
        for amount in [
            json!({ "1": "-5.01", "0": "5.00" }),
            json!({ "1": "-5", "0": "5", "2": "1" }),
            json!({ "1": "0", "0": "0" }),
            json!({ "1": "5", "0": "-5" }),
            json!({ "1": "not-a-number", "0": "5" }),
            json!({ "1": "-2", "0": null }),
        ] {
            assert!(!accepts_shape(amount.clone()), "must refuse {amount}");
        }
    }

    #[test]
    fn malformed_messagepack_code_fails_published_rhai_engine() {
        // MessagePack reserves 0xc1; this cannot encode the required Rhai string.
        let result = RhaiEngine::new().execute(&json!({}), vec![0xc1], None);
        assert!(result.is_err(), "invalid code must fail closed");
    }
}
