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
