# cursor-aps-adapter

[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

> Cursor enforces. APS attests. The adapter is the bridge.

Reference adapter that maps Cursor Hook events to signed APS attestation
receipts. Pair Cursor's permission decision (`allow` / `deny` / `ask`) with
APS's signed receipt layer and you get cryptographic proof of every governed
agent action: a verbal-confession-grade artifact that pins the decision, the
agent identity, the delegation chain, and the action shape into one Ed25519
signed envelope.

## What this is

Cursor Hooks ship structured event payloads and a permission decision per
event. They do not ship cryptographic receipts. This adapter takes a
`CursorHookEvent`, runs it through a pluggable policy function to produce a
decision, then emits a signed APS `ActionReceipt` (Wave 1 accountability
primitive) that records what the system observed.

The adapter is a small reference implementation. It is not a Cursor-shipped
product. Use it as a starting point for your own integration or as evidence
that the Cursor + APS pairing works.

## Why

Instructions are not enforcement. Recent advisories against agent IDEs
(prompt-class injection, MCP config drift, settings sandbox escapes) all
followed the same pattern: a valid signature was present at the start of the
session, the workspace state changed mid-session, and the agent acted under
instructions that were never part of the original authority context.

A signed receipt closes the gap on the read side. Even when an action slips
past the gateway, the receipt records what happened, by whom, under what
delegation, with a verifiable signature. That artifact is what regulators,
auditors, and incident responders actually need.

## Installation

```bash
npm install cursor-aps-adapter agent-passport-system
```

Requires Node.js 18+. The adapter pins `agent-passport-system@2.5.0-alpha`,
which ships the Wave 1 accountability primitives.

## Quick start

```typescript
import { CursorAPSAdapter } from 'cursor-aps-adapter'
import { generateKeyPair, verifyActionReceipt } from 'agent-passport-system'

const keys = generateKeyPair()
const adapter = new CursorAPSAdapter({
  agentPrivateKey: keys.privateKey,
  agentDid: keys.publicKey,
  delegationChainRoot: '0'.repeat(64), // sha256 hex of your delegation chain
})

// Inside your Cursor hook handler:
const result = await adapter.handle(cursorHookEvent)
console.log(result.decision)            // 'allow' | 'deny' | 'ask'
console.log(verifyActionReceipt(result.receipt)) // { valid: true }
```

## How it maps

| Cursor primitive | APS receipt field |
|---|---|
| `hook_event_name` | `action.kind` (prefixed `cursor.hook.`) |
| `tool_name` (MCP / preToolUse) | `action.target` |
| `command` (shell) | `action.target`, `action.parameters.command` |
| `tool_input` / `cwd` / `sandbox` | `action.parameters` |
| `conversation_id` / `generation_id` | `action.parameters` |
| permission decision | `scope_of_claim.asserts` |
| (configured) `agentDid` | `agent_did`, `signer_did` |
| (configured) `delegationChainRoot` | `delegation_chain_root` |

Every receipt declares an honest `scope_of_claim`: the `does_not_assert`
list explicitly disclaims agent intent, final user-visible outcome, and
unobserved side effects. APS calls this verbal-confession discipline.

## Policy customization

The default policy returns `allow` for every event. Plug in your own:

```typescript
import { CursorAPSAdapter, type PolicyFunction } from 'cursor-aps-adapter'

const policy: PolicyFunction = (event) => {
  if (event.hook_event_name === 'beforeShellExecution') {
    if (/rm\s+-rf/.test(event.command)) return 'deny'
  }
  return 'allow'
}

const adapter = new CursorAPSAdapter({
  agentPrivateKey, agentDid, delegationChainRoot,
  policy,
})
```

A `sampleRestrictivePolicy` ships in the package as a starting point. It
denies destructive verbs (`rm -rf`, `drop table`, `truncate`, `volumeDelete`)
and asks for human approval on `prod` paths. Tune to your environment.

## Cursor + Oasis + APS

Three layers, each owning one job. Cursor enforces inside the IDE: hooks
stop or step up actions before they happen. Oasis (or any policy
dashboarding layer) curates and audits the policy fleet across teams. APS
attests cryptographically: every decision becomes a signed receipt that an
auditor can verify offline against the agent's public key.

The adapter sits between Cursor and APS. It does not speak for Cursor or
Oasis. It implements the bridge.

## Receipt verification

Every receipt the adapter emits is an APS Wave 1 `AccountabilityActionReceipt`.
Verify with the SDK:

```typescript
import { verifyActionReceipt } from 'agent-passport-system'

const verdict = verifyActionReceipt(receipt)
// { valid: true } or { valid: false, reason: 'SIGNATURE_INVALID' | ... }
```

Receipt format spec: see `agent-passport-system` Wave 1 module. RFC 8785 JCS
canonicalized, content-addressed `receipt_id` (sha256 of the canonical form),
Ed25519 signature over the populated `receipt_id` form.

## Status

`0.1.0` reference implementation. Not a Cursor-shipped product. Apache 2.0.

The adapter's `AdapterDecision` union (`allow | deny | ask`) tracks Cursor's
documented permission surface as of `cursor.com/docs/hooks`. If Cursor
extends the permission set, extend the union.

## Links

- AEOESS: <https://aeoess.com>
- Agent Passport System SDK: <https://www.npmjs.com/package/agent-passport-system>
- Wave 1 spec: `specs/full-accountability-mvp.md` in the SDK repo
- Paper: *The Evidence-Safety Gap*, <https://doi.org/10.5281/zenodo.19914628>
- IETF: `draft-pidlisnyi-aps-00`

## License

Apache-2.0. See [LICENSE](LICENSE).
