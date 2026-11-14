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
        // ZFuel is signed i64 *micro-units* (six decimal places), not
        // unrestricted integer-valued whole units. This is 2^53 + 1
        // micro-units, carried as a decimal STRING at the JSON boundary.
        // Never round-trip through a JavaScript Number.
        let conserved = json!({
            "1": "-9007199254.740993",
            "0": "9007199254.740993"
        });
        assert!(accepts_shape(conserved.clone()));
        let bytes = rmp_serde::to_vec(&conserved).expect("MessagePack encode exact strings");
        let decoded: Value =
            rmp_serde::from_slice(&bytes).expect("MessagePack decode exact strings");
        assert_eq!(decoded, conserved, "decimal string must survive MessagePack");
        assert!(accepts_shape(decoded));
    }

    #[test]
    fn javascript_safe_integer_boundary_in_micro_units_is_exact() {
        for micro_amount in [
            "9007199254.740990", // 2^53 - 2
            "9007199254.740991", // Number.MAX_SAFE_INTEGER micro-units
            "9007199254.740992", // 2^53
            "9007199254.740993", // 2^53 + 1
        ] {
            let negative = format!("-{micro_amount}");
            assert!(accepts_shape(json!({"1": negative, "0": micro_amount})),
                    "must conserve the exact decimal string {micro_amount}");
        }
    }

    #[test]
    fn published_zfuel_domain_rejects_out_of_range_whole_units() {
        use std::str::FromStr;
        use zfuel::fuel::ZFuel;

        // The original failing fixture was ~9 quadrillion WHOLE units,
        // which is > ~9.223 trillion whole units of ZFuel signed-i64 capacity.
        assert!(ZFuel::from_str("9007199254740993").is_err());
        assert!(!accepts_shape(json!({
            "1": "-9007199254740993", "0": "9007199254740993"
        })));
        let max = ZFuel::from_str("9223372036854.775807").unwrap();
        let min = ZFuel::from_str("-9223372036854.775808").unwrap();
        assert_eq!(max.units, i64::MAX);
        assert_eq!(min.units, i64::MIN);
        assert!(ZFuel::from_str("9223372036854.775808").is_err());
        assert!(ZFuel::from_str("-9223372036854.775809").is_err());

        // Conservation cannot pair i64::MIN with its unrepresentable
        // positive counterpart, even though the debit alone is legal.
        assert!(!accepts_shape(json!({
            "1": "-9223372036854.775808",
            "0": "9223372036854.775808"
        })));
        assert!(accepts_shape(json!({
            "1": "-9223372036854.775807",
            "0": "9223372036854.775807"
        })));
    }

    #[test]
    fn no_zero_negative_credit_overflow_or_float_native_numbers() {
        for invalid in [
            json!({"1": "0", "0": "0"}),
            json!({"1": "1", "0": "-1"}),
            json!({"1": "-1", "0": "-1"}),
            json!({"1": "-1", "0": "0"}),
            json!({"1": "-9223372036854.775809", "0": "1"}),
            json!({"1": "-1", "0": "9223372036854.775808"}),
            json!({"1": "-5", "0": "5.000001"}),
            json!({"1": -5, "0": 5}),
            json!({"1": -5.0, "0": 5.0}),
            json!({"1": "-5", "0": "5", "2": "0"}),
            json!({"1": "-5"}),
            json!({"1": "-5", "0": "5", "unexpected": "1"}),
            json!({"1": [], "0": "5"}),
        ] {
            assert!(!accepts_shape(invalid.clone()), "must refuse {invalid}");
        }
    }

    // A serde_json::Value has *already lost* duplicate-key provenance.
    // This deliberately narrow, top-level duplicate-key detector tests the
    // security invariant required of a future bridge wire decoder, NOT a
    // production Holochain parser and NOT a feature of ReserveUnits itself.
    struct UniqueUnitMap(Value);
    impl<'de> serde::Deserialize<'de> for UniqueUnitMap {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: serde::Deserializer<'de>,
        {
            use serde::de::{Error, MapAccess, Visitor};
            use std::fmt;

            struct UniqueVisitor;
            impl<'de> Visitor<'de> for UniqueVisitor {
                type Value = UniqueUnitMap;
                fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                    write!(f, "an object with unique unit keys")
                }
                fn visit_map<A: MapAccess<'de>>(self, mut access: A)
                    -> Result<Self::Value, A::Error>
                {
                    let mut entries = serde_json::Map::new();
                    while let Some((key, value)) = access.next_entry::<String, Value>()? {
                        if entries.contains_key(&key) {
                            return Err(A::Error::custom("duplicate unit key"));
                        }
                        entries.insert(key, value);
                    }
                    Ok(UniqueUnitMap(Value::Object(entries)))
                }
            }
            deserializer.deserialize_map(UniqueVisitor)
        }
    }

    #[test]
    fn duplicate_serialized_unit_keys_are_not_a_safe_input() {
        let raw = r#"{"1":"not-a-number","1":"-5","0":"5"}"#;
        // Dangerous normalization: serde_json silently overwrites one key,
        // so RAVE cannot know the original raw document was ambiguous.
        let normalized: Value = serde_json::from_str(raw).unwrap();
        assert!(accepts_shape(normalized), "regression: normalized ambiguity is lost");
        assert!(serde_json::from_str::<UniqueUnitMap>(raw).is_err(),
                "bridge wire boundary must refuse duplicate unit keys");

        let unambiguous = r#"{"1":"-5","0":"5"}"#;
        let parsed = serde_json::from_str::<UniqueUnitMap>(unambiguous).unwrap().0;
        assert!(accepts_shape(parsed));
        for malformed in [
            r#"{"1":"-5","0":"5",}"#,
            r#"{"1":"-5","0":"5""#,
            r#"["1","0"]"#,
            r#"{"1":"-5","0":"5","0":"1"}"#,
        ] {
            assert!(serde_json::from_str::<UniqueUnitMap>(malformed).is_err(),
                    "strict wire decoder must refuse {malformed}");
        }
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
