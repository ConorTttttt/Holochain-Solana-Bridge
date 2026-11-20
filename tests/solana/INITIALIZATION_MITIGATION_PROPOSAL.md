# Proposal: prevent first-initializer capture on a public Solana deployment

**Status:** DESIGN ONLY — requires independent SEC review and explicit maintainer authorization.  
**Issue:** #19 (depends on #12); implementation is deliberately **not** included.  
**Scope:** Proposed future non-production hardening of the current classic SPL, refundable prototype. No Holochain issuance, mainnet deployment, production withdrawals or real-value collateral.

## Confirmed source-level threat and execution evidence still required

The current `Initialize` account constraints require `admin: Signer` and a
singleton `config = PDA(["config"], program_id)`, but do not authenticate
which identity may be the first signer. `initialize` persists that signer's
public key as `config.admin`, the chosen mint as `config.mint` and the
chosen nonzero `holochain_scope` as `config.scope`. There is no later
admin-recovery instruction. An arbitrary fee-funded actor may win the first
transaction and configure an attacker-owned administrator, mint and scope.
This is a **public-deployment configuration-capture vulnerability**.

The `init-capture` regression in `integration.test.mjs` sends an actual
attacker initialize transaction on an empty validator, checks the captured
configuration, then tests operator initialization/pause failures and
attacker pause success. **The expanded regression has not yet been executed
on the current branch.** Source-level exposure does not replace signed
localnet transaction results.

## Proposed security boundary and implementation contract

1. **Preauthorized deployment identity.** The built program must have a
   precommitted governance-root public key in reviewed source/build
   configuration. During `initialize`, require this *exact* key to sign.
   A caller-supplied `admin: Signer` by itself is insufficient. Merely
   checking `admin == admin_argument` or supplying an authority nonce does
   not fix first-caller capture.
2. **Precommitted economic configuration.** Verify the exact intended
   classic SPL mint, Holochain scope bytes and canonical vault/config PDAs
   against a reviewed, deployment-specific manifest. Prefer compile-time
   expected values or an independently authorized commitment, not mutable
   input from an arbitrary first transaction. Reject wrong mint/scope even
   if the transaction was assembled by a privileged but mistaken operator.
3. **Atomic bootstrap.** Create config and vault and persist admin/mint/scope
   in the same transaction. Do not expose an intermediate partially
   initialized account or an unprotected setter. Transaction replay must
   fail at the existing singleton PDA even after interruption.
4. **Authority lifecycle.** Split operational pause authority from program
   upgrade authority in an independently reviewed follow-up. Specify
   threshold control, key rotation, emergency recovery, upgrade monitoring,
   and delays before public deployment. A protected initializer cannot
   prevent an unrestricted upgrade authority from replacing the code.
5. **Chain/program binding.** Bind the external deployment manifest to the
   exact program ID, compiled ELF hash, generated IDL hash, genesis identity,
   selected mint and intended scope. Solana programs do **not** natively
   provide a trusted runtime getter for cluster genesis; do not claim an
   on-chain genesis check without a separately reviewed mechanism.
   Require independent off-chain verification that the deployed program and
   initialization transaction match the manifest.
6. **No backward-incompatible 'repair' in place.** An already captured
   config is permanently committed under the singleton PDA in this
   prototype. A public deployment that was initialized by an attacker
   must be treated as compromised, not merely unpaused or reassigned
   without a proven migration and newly reviewed trust boundary.

## Security tests required in a separate implementation PR

- Fresh validator: attacker-funded initialize with arbitrary admin/mint/scope
  must be **included and rejected on chain**, with signature,
  `getTransaction(...).meta.err`, logs and unchanged config/vault accounts.
- Authorized governance signer performs a successful atomic initialize with
  exact expected manifest fields; generated IDL and PDA bytes match.
- Authorized signer + substituted mint, wrong scope, token program
  substitution or wrong vault rejects with rolled-back data/lamports.
- Same-slot/racing initialization: an attacker cannot become admin even if
  their submitted transaction is executed first; exactly one authorized
  initialize can succeed; repeated init fails.
- Pause remains signed by the reviewed administrator; wrong signer cannot
  pause. Test failed upgrades/authority operations separately where supported.
- Re-run lifecycle, refund, max-u64, concurrent nonce, restart and OBS/SEC
  adversarial suites against the **new actual ELF/IDL**; publish program and
  loader ProgramData upgrade-authority evidence.

## Review gates and operational constraints

Implementation must be coordinated with SEC lane before changing Rust
economic semantics; OBS must update schema/program-ID manifests; CI must
archive the complete source/IDL/ELF/transaction chain for the tested SHA.
Keep `holochain/evidence-gate.mjs` `creditEligible: false` regardless
of initializer hardening. Refundability and external mint authority are
still separate **economic safety blockers** even if this proposal is accepted.

**Disposition:** No code mitigation or public deploy in this PR. Human
approval and an independently reviewed implementation PR are required.
