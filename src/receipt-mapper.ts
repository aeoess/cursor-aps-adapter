// CursorHookEvent → APS ActionReceipt input.
//
// Deterministic. Same event + same decision + same config → same canonical
// receipt bytes (up to the timestamp the caller provides). The adapter passes
// the timestamp through from event when available, otherwise from the
// configured clock, so the entire pipeline is reproducible for fixtures.

import type {
  ScopeOfClaim,
  SideEffectClass,
} from 'agent-passport-system'

import type {
  AdapterDecision,
  CursorHookEvent,
} from './types.js'

export interface MappedReceiptInput {
  scope_of_claim: ScopeOfClaim
  agent_did: string
  delegation_chain_root: string
  intent_ref?: string
  policy_ref?: string
  action: {
    kind: string
    target: string
    parameters?: Record<string, unknown>
  }
  side_effect_classes: SideEffectClass[]
  timestamp: string
}

export interface MapInput {
  event: CursorHookEvent
  decision: AdapterDecision
  agentDid: string
  delegationChainRoot: string
  timestamp: string
  reason?: string
  scopeOverride?: (event: CursorHookEvent, decision: AdapterDecision) => ScopeOfClaim
}

export function mapEventToReceiptInput(input: MapInput): MappedReceiptInput {
  const { event, decision, agentDid, delegationChainRoot, timestamp } = input

  const action = deriveAction(event)
  const scope_of_claim = input.scopeOverride
    ? input.scopeOverride(event, decision)
    : defaultScope(event, decision, input.reason)
  const side_effect_classes = deriveSideEffectClasses(event)

  return {
    scope_of_claim,
    agent_did: agentDid,
    delegation_chain_root: delegationChainRoot,
    action,
    side_effect_classes,
    timestamp,
  }
}

function deriveAction(event: CursorHookEvent): MappedReceiptInput['action'] {
  switch (event.hook_event_name) {
    case 'beforeMCPExecution': {
      const e = event as Extract<CursorHookEvent, { hook_event_name: 'beforeMCPExecution' }>
      return {
        kind: `cursor.hook.${e.hook_event_name}`,
        target: `mcp:${e.tool_name}`,
        parameters: {
          tool_input: e.tool_input,
          ...(e.url ? { url: e.url } : {}),
          ...(e.command ? { command: e.command } : {}),
          conversation_id: e.conversation_id,
          generation_id: e.generation_id,
        },
      }
    }
    case 'beforeShellExecution': {
      const e = event as Extract<CursorHookEvent, { hook_event_name: 'beforeShellExecution' }>
      return {
        kind: `cursor.hook.${e.hook_event_name}`,
        target: `shell:${truncate(e.command, 120)}`,
        parameters: {
          command: e.command,
          cwd: e.cwd,
          sandbox: e.sandbox,
          conversation_id: e.conversation_id,
          generation_id: e.generation_id,
        },
      }
    }
    case 'preToolUse':
    case 'postToolUse': {
      const e = event as Extract<CursorHookEvent, { hook_event_name: 'preToolUse' | 'postToolUse' }>
      return {
        kind: `cursor.hook.${e.hook_event_name}`,
        target: `tool:${e.tool_name}`,
        parameters: {
          tool_input: e.tool_input,
          tool_use_id: e.tool_use_id,
          conversation_id: e.conversation_id,
          generation_id: e.generation_id,
        },
      }
    }
    default:
      return {
        kind: `cursor.hook.${event.hook_event_name}`,
        target: `conversation:${event.conversation_id}`,
        parameters: {
          conversation_id: event.conversation_id,
          generation_id: event.generation_id,
        },
      }
  }
}

function deriveSideEffectClasses(event: CursorHookEvent): SideEffectClass[] {
  switch (event.hook_event_name) {
    case 'beforeShellExecution':
    case 'afterShellExecution':
      return ['external_message', 'data_modification']
    case 'beforeMCPExecution':
    case 'afterMCPExecution':
      return ['external_message']
    case 'preToolUse':
    case 'postToolUse':
      return ['external_message']
    case 'afterFileEdit':
    case 'afterTabFileEdit':
      return ['data_modification']
    case 'beforeReadFile':
    case 'beforeTabFileRead':
      return ['internal_only']
    default:
      return ['internal_only']
  }
}

function defaultScope(
  event: CursorHookEvent,
  decision: AdapterDecision,
  reason?: string,
): ScopeOfClaim {
  const asserts =
    `Cursor hook ${event.hook_event_name} produced decision "${decision}" for ` +
    `conversation ${event.conversation_id}, generation ${event.generation_id}.` +
    (reason ? ` Rationale: ${reason}` : '')

  return {
    asserts,
    does_not_assert: [
      'agent intent or comprehension at the time of the action',
      'final user-visible outcome of the action (only the gateway-observed event)',
      'absence of other unobserved side effects outside the Cursor process',
    ],
    capture_mode: 'gateway_observed',
    completeness: 'best_effort',
    self_attested: false,
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}
