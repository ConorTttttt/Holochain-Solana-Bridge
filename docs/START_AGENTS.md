# Start the parallel coding agents

The GitHub issues and **custom agent profiles are prepared**. They do not self-run: installing a profile or creating an issue does NOT initiate a cloud session.

## What is ready

The `.github/agents/*.agent.md` files configure five GitHub Copilot coding agent profiles:
- `solana-engineer` → ready issue [#7](https://github.com/ConorTttttt/Holochain-Solana-Bridge/issues/7)
- `observer-engineer` → ready issue [#8](https://github.com/ConorTttttt/Holochain-Solana-Bridge/issues/8)
- `holochain-engineer` → ready issue [#9](https://github.com/ConorTttttt/Holochain-Solana-Bridge/issues/9)
- `security-reviewer` → ready issue [#10](https://github.com/ConorTttttt/Holochain-Solana-Bridge/issues/10)
- `ci-integrator` → ready issue [#11](https://github.com/ConorTttttt/Holochain-Solana-Bridge/issues/11)

## Launch process

GitHub Copilot cloud agent requires a paid GitHub Copilot plan and agent access enabled for this repository (this is distinct from a ChatGPT plan). See [GitHub official guide](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task).

1. Open issue #7, then click **Assignees → Copilot**.
2. Select the custom `solana-engineer` agent if GitHub offers its agent dropdown and add a prompt: `Follow AGENTS.md; implement this issue on a new PR; show actual build logs. Never deploy or issue credit.`
3. Repeat concurrently on #8 (observer-engineer), #9 (holochain-engineer), #10 (security-reviewer), and #11 (ci-integrator). Use different branches, never direct edits to main.
4. Inspect running sessions/PRs in the repository's **Agents** tab. Security reviews do **not** replace human sign-off.
5. Merge only after CI produces real outputs, acceptance criteria are met and cross-lane contract tests succeed.

Alternative if Copilot is unavailable: open each issue using Codex/other code agent or assign it to a human contributor. Repository-wide `AGENTS.md` works as task context in many coding harnesses; custom GitHub profiles target GitHub Copilot.

## Recommended safe parallel start

SOL and CI should begin immediately because compilation is currently unverified. OBS should audit the parser in parallel but wait for SOL's generated IDL before claiming compatibility. RAVE should inspect pinned source and run isolated sandbox tests; SEC should write P0 test cases without assuming production code is available.

**Do not start later conditional escrow, redemption or Holochain issuance issues yet** (S3/S4). Complete the prior security gates first.

## Agent selection and branch naming

| Lane | Custom agent file | First task | Branch prefix |
|---|---|---:|---|
| SOL | `.github/agents/solana-engineer.agent.md` | #7 | `agent/sol/` |
| OBS | `.github/agents/observer-engineer.agent.md` | #8 | `agent/obs/` |
| RAVE | `.github/agents/holochain-engineer.agent.md` | #9 | `agent/rave/` |
| SEC | `.github/agents/security-reviewer.agent.md` | #10 | `agent/sec/` |
| CI | `.github/agents/ci-integrator.agent.md` | #11 | `agent/ci/` |

If the desired agent profile is not selectable in the issue UI, start a session from the **Agents** tab and select the custom agent, supplying the issue URL and its explicit acceptance criteria. Do not invent a GitHub assignee named after the file.

Each ready task must result in a PR or a clearly documented blocker; merely starting an agent is not evidence of a working component.
