# Copilot repository instructions

Read [AGENTS.md](../AGENTS.md) and [docs/SPRINTS.md](../docs/SPRINTS.md) before editing. Select the matching custom profile from `.github/agents/` for the issue's lane.

This codebase is a localnet research prototype, NOT a bridge for real assets. The current Solana escrow is refundable and therefore **cannot** back any transferable Holochain token. Never enable `holochain/evidence-gate.mjs` issuance/withdrawal, change `creditEligible: false`, commit keys, deploy to mainnet, or present RPC state as independent consensus proof. Do not claim tests run when they were not run.

Each task needs a feature branch/PR, real test outputs, negative/adversarial tests, and a handoff note. Security-critical changes require independent human review. SOL owns Solana program, OBS owns observer/indexer, RAVE owns Holochain harness, SEC owns security review, CI owns workflow/integration tests.
