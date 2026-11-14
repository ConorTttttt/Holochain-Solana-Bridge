# Installation milestone and audit demo runbook

This is preparation, not permission to install. Baseline is PR #66 commit
`03b567a992bcd31930b49d08f594a4ef7ff58680`; Holochain 0.7.1,
HDK 0.7.1 / HDI 0.8.1. No installation, genesis, external-Lair setup,
capability grant or signed zome call was performed for this milestone.
Do not use Agent 4's different archived SOL55 DNA/CellId as this baseline's identity.

## Evidence already established

Original run [43648980986](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648980986)
passed 4/4 jobs; shared [43648981038](https://github.com/ConorTttttt/Holochain-Solana-Bridge/actions/runs/43648981038)
passed 6/6. Their API head SHA and run attempt 1 were rechecked.
PR #65's exact coordinator and Holonix compiler fixes are present in baseline.
`baseline.json` freezes ORIGINAL artifact IDs and ZIP SHA256s: no rebuilt,
repacked or newer-run substitute is accepted.

The read-only `installation-preparation.yml` workflow downloads those three
original ZIPs, hashes their actual bytes before extraction, rejects traversal,
symlinks and duplicate entries, checks executable/WASM headers, compares embedded
hApp DNA and DNA WASMs byte-for-byte, checks actual source/OBS sidecar digests,
original signed-wire identity, initialized properties and network seed, and
requires both compiler completion markers. It runs pinned `hc dna hash` against
the ORIGINAL DNA and compares that result with the original report; no conductor
is started. It hashes and versions hc, holochain and lair-keystore separately.
`evidence/` records actual public inventory and the current seven-stage state.
Original source binding was emitted before compilation; its `dnaBuilt:false`
is preserved as historical data, not rewritten into installation proof.

The local workspace cannot download Azure artifact redirects even with granted
network permission. Verification ran inside GitHub Actions against original
archive bytes. Its notices and immutable report artifacts provide the inventory;
local rehash of those ZIPs is not claimed. For independent reproduction:

```sh
python3 scripts/installation/fetch-originals.py
node demo/installation/verify-originals.mjs
nix develop github:holochain/holonix/a6cdfbd31afd2094b7ccc9b3bd7cf9442ec055da \
  --command bash scripts/installation/runtime-inventory.sh
node scripts/installation/prepare-request.mjs
node --test demo/installation/*.test.mjs
```

These commands fetch/read/hash and prepare files only. They do not invoke an
installer, a conductor, a keystore server or a zome. Archive checks and markers
are not an independent supply-chain audit of every crate/compiler.

## Installation request: freeze before approving

CI emits `authorization-request.json`, a canonical JSON document containing:
original source SHA/artifact ID/ZIP digest, inventory digest, real DNA hash,
all runtime/input/code SHA256s, exact arguments, exact app ID and deterministic
private attempt path, external-Lair-only policy and explicit prohibited calls.
The runtime tools are pinned Nix binaries; preserve their Nix closure, not just
standalone ELF copies. No economic or Observer trust rule changes.

The request's initial state is `CODE_AND_ARGUMENTS_PREPARED_HOST_POLICY_REQUIRED`.
It intentionally has `hostFingerprint:null`, `futureAgentPubKey:null` and
`futureCellId:null`. It is not an executable approval. The target operator must
first inspect the exact files and prepare a target host binding (READ ONLY with
respect to Holochain):

```sh
node scripts/installation/prepare-request.mjs freeze-host \
  authorization-request.json frozen-install-request.json
```

This reads `/etc/machine-id` and records only its SHA256. It neither provisions
keys nor signs anything. Changing ANY field changes the approval digest. A new
executor source commit requires a new code-path/hash review. The older compiled
baseline remains unchanged; executor source and DNA build source are separate.

An independent administrator, outside the agent/caller's control, must provision:

- reviewed executor Node/runtime and the two code files at the request's exact
  `/opt/hsc-audit-installation/<executor-source-sha>/...` paths; clean launcher
  environment with no NODE_OPTIONS, preload or user-controlled PATH;
- original hApp/DNA bytes at the request's exact input paths; all input/code/tool
  paths and ancestors root-owned, non-symlink, and not group/world writable;
- an unprivileged dedicated executor UID and private writable `attempts/` parent;
  isolate it on a disposable host/job with cgroup-wide child cleanup, including
  external Lair, on timeout/failure; no general interactive executor shell;
- `/etc/hsc-audit-installation/authority.json`, root-owned and not caller writable,
  containing the schema below, actual target host fingerprint/UID, exact frozen
  request digest, independently established approver key(s), and independent
  redemption service public key/HTTPS endpoint.

No trust keys, grants, endpoint or administrative allowlist have been supplied
here. The implementation cannot execute from an example or caller approval flag.
Root/host administration is trusted; this client is not a sandbox preventing a
host owner from running unrelated tools. This administrative approval scheme
never substitutes for the bridge's unchanged source/witness signature model.

Required policy fields (placeholders are deliberately unusable):

```json
{"schema":"hsc-install-authority-v1","executorId":"hsc-disposable-installation-v1",
 "executorUid":null,"hostFingerprint":null,"approvedRequestDigest":null,
 "approverKeys":{},"brokerPublicKey":null,"brokerUrl":null}
```

## Independently authenticated authorization

No `approved:true`, environment flag, supplied public key, GitHub green status,
local file existence or author-generated key is authority. An independently
provisioned trusted approver must sign a grant whose exact payload keys are:

```text
schema = hsc-install-grant-v1
keyId = independently provisioned approver key ID
nonce = 64 lowercase hex characters, unique at the independent broker
notBefore, expiresAt = integer Unix milliseconds, maximum 15-minute window
requestDigest = SHA256("HSC/installation-request/v1\\0" + canonical(request))
executorId = hsc-disposable-installation-v1
operation = install-only
```

The Ed25519 signature covers UTF-8 `HSC/install-approval/v1` + NUL + canonical
payload JSON. Envelope keys are exactly `payload,signature`; signature is
canonical base64 of 64 bytes. On disk, grant/request files must contain sorted-key
compact canonical JSON plus one newline; duplicate keys, unsafe numbers,
unknown grant fields and alternate encodings are rejected. Canonical strings use
JSON escaping, no Unicode normalization. See `authorization.mjs` for the exact
encoder. Private approver/broker keys remain with the independent authority.

The executor also requires a LIVE redemption receipt. HTTPS POST goes only to
the root-provisioned broker; TLS certificate validation stays enabled and HTTP
redirects are refused. Body contains `approval,requestDigest,grantDigest,challenge,
executorId`; challenge is 32 fresh random bytes in hex. Grant digest is SHA256 of
canonical envelope JSON. The separately trusted broker must validate the grant
and atomically consume BOTH nonce and requestDigest in durable storage, across
process restart, concurrency, machine rollback and subsequent differently-nonced
grants. It must never reissue permission for a consumed request. Consumed then
lost response means HOLD, not retry. Broker availability/authentication is an
external prerequisite, not implemented or deployed by this PR.

A successful broker envelope is Ed25519-signed over `HSC/install-consumption/v1`
+ NUL + canonical payload with EXACT keys:

```text
schema = hsc-install-consumption-v1
nonce, requestDigest, grantDigest, challenge, executorId = exact request echoes
consumed = true
expiresAt = current valid time, no later than grant expiry
```

Client verifies both signatures, key identities, purpose, host/UID/code/input
bindings, request allowlist, expiry before AND after broker contact, exact
challenge/nonce/request and receipt expiry. Replayed receipts cannot match a new
challenge. Replayed grants require a new broker claim and must be rejected by its
independent durable state. Unit tests use ephemeral synthetic keys and an in-memory
broker model; they do not establish a real approval or production broker durability.
An independent reviewer must audit/provision that service and its retention and
revocation policy before using the path. No offline/local-journal fallback.

## Exact next installation operation — NOT EXECUTED

After independent review, host freeze, trust-root provisioning and receipt service
acceptance, a human operator may invoke the reviewed root-installed entrypoint
with the canonical request and separately supplied signed grant:

```sh
# NOT authorized to execute now; use actual reviewed absolute Node/code paths.
node /opt/hsc-audit-installation/<executor-source-sha>/scripts/installation/execute-approved.mjs \
  frozen-install-request.json independently-signed-install-grant.json
```

It accepts no trust-root/approval flags. It uses the fixed `/etc/.../authority.json`
and requires a non-root executor. It checks all protected hashes and actual DNA
hash before redemption. After one-use authorization it creates the private attempt
directory, fsyncs a consumed/UNCERTAIN journal, creates a 0600 disposable passphrase,
and executes ONLY the exact approved hc `sandbox --piped generate` argv. External
Lair is the pinned CLI default; there is no `--in-process-lair` option or fallback.
Allowed lifecycle: fresh private keystore/agent, hApp installation, genesis and
hc-generate startup/shutdown. No generic shell, zome, grant, RAVE or transport command.
No secret is put in argv/environment or public logs. Private raw logs remain on
operator host; never upload passphrases, sockets/tokens, keystore DBs or raw config.

Any timeout, nonzero exit, crash or missing receipt is UNCERTAIN. Independent
broker consumption precedes the first state mutation. Do not rerun a consumed
request, steal a lock or create a new nonce to bypass it. Inspect/reconcile with
independent operator; a new attempt requires a new reviewed request and approval.
The broker prevents reuse after local rollback; local fsync is only crash evidence.
The launcher must kill the entire child cgroup and preserve private state on failure.

## Authenticate values allocated only during installation

AgentPubKey, full ordered CellId, admin port, external-Lair server/socket identity,
actual private config and genesis actions cannot truthfully be specified now.
Their absence is not permission to accept arbitrary later values.

A separately reviewed lifecycle approval is required before restarting the
conductor after hc-generate exits. For an ALREADY authorized running process, an
independent operator records host/job identity, execution receipt and request digest,
PID/executable SHA, private config SHA, discovered loopback admin port, original
bundle hashes and installed app status. Match the process to the approved private
attempt directory and exact binary; do not trust an arbitrary port from JSON/env.
Then capture only Admin API `list-apps` and `list-cells` using the pinned hc binary:

```text
<verified-hc> client call --port <port-from-authorized-process> list-apps
<verified-hc> client call --port <same-port> list-cells
```

Require exactly one enabled `hsc-audit-demo-readonly`, exactly one provisioned
`audit` role, exact original DNA hash, matching app/CellId agent, and exactly that
CellId in list-cells. No clones, extra roles/cells or DNA modifiers. Do not infer
installed identity from the bundle alone. Record newly discovered agent and ordered
`[DNA,agent]` CellId, not a placeholder.

`compare-admin-snapshots.mjs` checks this consistency WITHOUT calling a conductor:

```sh
node scripts/installation/compare-admin-snapshots.mjs frozen-install-request.json \
  list-apps.json list-cells.json snapshot-consistency.json
```

Imported JSON is untrusted; that output explicitly remains UNAUTHENTICATED. An
independent operator must attest the authenticated capture and bind it to the exact
host, process, request and installation receipt before stage 3 is promoted.
Never promote stage 3 merely because someone supplied consistent JSON.

## External-Lair identity procedure — no signed call authorized

Inspect actual private config through pinned 0.7.1 types: require `LairServer`,
refuse in-process keystore. Match the separately running Lair PID, executable hash,
UID, private socket ownership/permissions and configuration connection to this
attempt. Publish redacted config fingerprint and process hashes only. Record actual
agent key returned by the authenticated conductor; compare with the full CellId.
This authenticates configuration/process association, NOT private-key possession.

Proving signer possession requires an explicitly approved signing challenge or
signed HAM call. **Every signed zome call, including get_contract, is a separate
approval.** A nominally read-only first call can trigger `init`; HAM connection
may attach an app interface. Audit/authorize that complete call graph and exact
canonical input, CellId/agent, signer, interface mutation and capability policy
first. No `HAM preflight` is executed by this PR. After that separate approval,
use the pinned original HAM with `LairCredentials::Node`, exact cell agent and
`CapGrantOptIn::Withheld`; never create a grant or silently use an in-process
fallback. Require signed get_contract's exact audit contract/denial fields and
independent signer/CellId match. Wrong DNA/agent/app, unavailable Lair and mismatched
config must refuse; run negative probes only under their own exact-call approvals.

## Later audit demo and evidence checklist

1. Retain all original archives, ZIP hashes, CI URLs, source/lock/tool/binary hashes,
   source properties, signed Solana wire and original block/snapshot proof.
2. Obtain frozen installation request, independent signed grant, authenticated
   broker receipt and independent review of the executor. Retain private crash state.
3. Execute installation only after authorization; attest actual Admin identity and
   external Lair association. Separate restart/signing approvals as above.
4. Agent 3, Agent 4 AND an independent security reviewer accept the exact lossless
   v2 ABI, canonical bytes/digests and admission path. v2 transport remains disabled.
5. Independently authorize the exact signed audit call using actual installed full
   CellId, agent/Lair signer, zome/function, source/binary hashes, payload, expiry and
   replay policy. Installation approval cannot authorize this step.
6. Execute that approved call; retain real signed audit ActionHash and typed
   byte-identical readback. No invented hash or fixture-only origin relabeling.
7. Separately authorize restart/replay operations; prove same-source replay produces
   no second audit action, conflicts and wrong domains refuse, preserve uncertain
   outbox behavior. Mark partial history explicitly. Preserve all raw/public evidence.

Current stage status is `evidence/seven-stage-status.json`: source and pending OBS
verified; installation, exact signed call, real action, readback and replay remain
unexecuted. All four denial fields remain literal false/zero throughout. No
published Unyt call, spendable credit or withdrawal. No DEMO READY until the real
signed audit action, readback, restart/replay and required CI evidence exist.
