# P0 pre-review SOL #38 integration trial — 14 Nov 2026

**STATUS: RED, DRAFT, UNAPPROVED, NO MAIN MERGE, NO ECONOMIC PERMISSIONS.**

Parent frozen candidate: `6a500811eb8b7b08865a4ae0acce327cbdbae002` (shared 6/6 PASS, RAVE 5/5 PASS, integrated SOL FAIL, insufficient signed-wire acceptance). New candidate uses exactly four SOL test/evidence files from [PR #38](https://github.com/ConorTttttt/Holochain-Solana-Bridge/pull/38) at `cca4e9a94b5147efa82ac0106f1f97f75a42251f`, **not** Claude's temporary branch-specific workflow trigger. Rust `programs/**` unchanged. SEC independent review and Agent 2 adoption to PR #35 are requested, **not completed**.

Source pins retained from prior frozen integration: OBS `94361778d08a3cfd5358d5d3de1af5a1c0318835`, RAVE `17a3623917311fd3ccbe338293f1cd8ce4cb3c7c`, SEC `a42096495934f42c86f09c36fa0bdc9b48f362e9`, CI `ce0fe43dbaab4c709a521197693e52b2ea7176ef`. Newer specialist heads are intentionally not silently treated as approved. SOL source PR #38 awaits SEC sign-off and Agent 2 source ownership.

Standalone SOL [run 43577100529](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43577100529) at `cca4e9a94b5147efa82ac0106f1f97f75a42251f` passed 54 real signed/finalized records (lifecycle 17 success/28 rejected, init-capture 2/2, u64 3/2) and 7/7 tamper denials in each mode with intact control accepted; [artifact 14106778660](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43577100529/artifacts/14106778660), SHA-256 `aa4cbdf19979816f48c1b2a2327bd09bc578953f5b5794bb8863672b41da7600`. **Not an integrated milestone.**

CI in this trial must produce the actual three-mode validator suite and retain public-only source SHA, files and hash manifest; independently replay the same-run original archive through real Observer signed-wire and ledger; repeat all 21 tamper rejections from downloaded witness; test active/refund/replay/contradiction/restart/quarantine-only shadow; and run shared CI plus five-job RAVE at exact same immutable integration SHA. Missing evidence and skips fail closed.

Workspace `Cargo.lock` (SHA256 `9700366dc3e0219ef167bf2a0669db87b32e0d2cbb259e1fa8661d24bf0a24f5`) and three other reviewed locks remain byte-identical. Both permanent CI workflows now pin the previously used `otter-sec/anchor` annotated `v1.2.2` tag to actual commit `8d9d1488d9b8af41b266d7513eea2e668adf15a2`, **without asserting this fork's provenance has been independently approved**.

Release gates: A BLOCKED pending exact-head shared/validator execution; B1 BLOCKED pending actual Observer replay and unforgeable durable history; B2 BLOCKED (historical real disposable conductor install/restart is not an economic zome call); Gate C NO-GO. First-initializer capture, upgrade authority and externally authenticated finality/ledger checkpoint remain open.
