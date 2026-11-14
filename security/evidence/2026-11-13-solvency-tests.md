# Sprint 0 SEC execution evidence — 2026-11-13

- Runner: isolated local tool environment; Node.js v22.16.0.
- Command: node --check security/test/solvency-model.test.mjs
- Syntax-check result: exit code 0 (no output).
- Command: node --test security/test/solvency-model.test.mjs
- Test result: exit code 0; **7 passed, 0 failed, 0 skipped**.
- Git blob SHA of executed file: 2ba403364899f6bc9c818dfbdf64919c937a8339; verified identical to uploaded GitHub blob SHA on SEC branch.
- SHA-256 of executed source: d2131984a5913931e20d667bbfff56905e33aa493fb2813bd0a48774f935e576.
- These cases are **REFERENCE MODEL ONLY**. They do not exercise the Solana validator, future payout code or RAVE; passing does **not** remove any P0 economic release gate.

## Actual TAP excerpt (as executed)

    TAP version 13
    # Subtest: positive: an uncredited refundable deposit is collateral-covered
    ok 1 - positive: an uncredited refundable deposit is collateral-covered
    # Subtest: adversarial: refund liability plus minted credit cannot share the same 100 units
    ok 2 - adversarial: refund liability plus minted credit cannot share the same 100 units
    # Subtest: adversarial: unpaid withdrawal must be reserved even after claim extinction
    ok 3 - adversarial: unpaid withdrawal must be reserved even after claim extinction
    # Subtest: positive: irrevocable burn moves live claims to unpaid, payout reduces collateral
    ok 4 - positive: irrevocable burn moves live claims to unpaid, payout reduces collateral
    # Subtest: adversarial: stale or fork-disputed parked link cannot release tokens
    ok 5 - adversarial: stale or fork-disputed parked link cannot release tokens
    # Subtest: adversarial: migration and restored backup must not replay an old global claim ID
    ok 6 - adversarial: migration and restored backup must not replay an old global claim ID
    # Subtest: adversarial: values beyond Number.MAX_SAFE_INTEGER remain exact
    ok 7 - adversarial: values beyond Number.MAX_SAFE_INTEGER remain exact
    1..7
    # tests 7
    # suites 0
    # pass 7
    # fail 0
    # cancelled 0
    # skipped 0
    # todo 0
    # duration_ms 115.208558

## NOT RUN and required independent follow-up

- security/test/adversarial.test.mjs: NOT RUN in this isolated environment (its imports require the repository checkout, unavailable locally). Run on a checkout/CI, record fresh logs and ensure its tests execute rather than merely parse.
- observer/test/verify.test.mjs: NOT RUN by SEC in this isolated environment; repository's previous historical log is not new SEC evidence.
- Anchor compiler / IDL: NOT RUN by SEC.
- Solana local validator, bridge end-to-end, Unyt/RAVE production source-equivalent fork/recovery tests: NOT RUN.

No claim is made that the repository has passed an audit or that on-chain collateral is safe.
