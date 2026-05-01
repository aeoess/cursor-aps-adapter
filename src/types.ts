// Cursor Hooks → APS adapter types.
//
// Types are derived from cursor.com/docs/hooks. Decision values match
// Cursor's actual permission surface ("allow" | "deny" | "ask"), not the
// "allow | warn | step-up | deny" surface that has appeared in some marketing
// material. If Cursor extends the permission set in the future, add to the
// AdapterDecision union here.

import type {
  AccountabilityActionReceipt,
  ScopeOfClaim,
} from 'agent-passport-system'

/**
 * Common envelope shared by every Cursor hook event.
 * See https://cursor.com/docs/hooks for the source of truth.
 */
export interface CursorHookEventBase {
  conversation_id: string
  generation_id: string
  model: string
  hook_event_name: CursorHookName
  cursor_version: string
  workspace_roots: string[]
  user_email?: string | null
  transcript_path?: string | null
}

export type CursorHookName =
  | 'sessionStart'
  | 'sessionEnd'
  | 'preToolUse'
  | 'postToolUse'
  | 'postToolUseFailure'
  | 'subagentStart'
  | 'subagentStop'
  | 'beforeShellExecution'
  | 'afterShellExecution'
  | 'beforeMCPExecution'
  | 'afterMCPExecution'
  | 'beforeReadFile'
  | 'afterFileEdit'
  | 'beforeSubmitPrompt'
  | 'preCompact'
  | 'stop'
  | 'afterAgentResponse'
  | 'afterAgentThought'
  | 'beforeTabFileRead'
  | 'afterTabFileEdit'

export interface BeforeMCPExecutionEvent extends CursorHookEventBase {
  hook_event_name: 'beforeMCPExecution'
  tool_name: string
  /** JSON string of parameters passed to the MCP tool. */
  tool_input: string
  url?: string
  command?: string
}

export interface BeforeShellExecutionEvent extends CursorHookEventBase {
  hook_event_name: 'beforeShellExecution'
  command: string
  cwd: string
  sandbox: boolean
}

export interface PreToolUseEvent extends CursorHookEventBase {
  hook_event_name: 'preToolUse'
  tool_name: string
  /** Structured object; shape varies by tool_name. */
  tool_input: Record<string, unknown>
  tool_use_id: string
  cwd?: string
  agent_message?: string
}

export interface PostToolUseEvent extends CursorHookEventBase {
  hook_event_name: 'postToolUse'
  tool_name: string
  tool_input: Record<string, unknown>
  /** JSON-stringified result payload. */
  tool_output: string
  tool_use_id: string
  /** Execution time in milliseconds. */
  duration: number
}

/**
 * Names of hook events the adapter explicitly narrows. Other hook events
 * pass through the OtherCursorHookEvent fallback below.
 */
export type SpecializedHookName =
  | 'beforeMCPExecution'
  | 'beforeShellExecution'
  | 'preToolUse'
  | 'postToolUse'

/**
 * Catch-all for hook events the adapter does not explicitly narrow. Carries
 * only the common envelope; the discriminator is constrained to non-
 * specialized hook names so TypeScript can narrow CursorHookEvent cleanly.
 */
export interface OtherCursorHookEvent extends CursorHookEventBase {
  hook_event_name: Exclude<CursorHookName, SpecializedHookName>
}

/**
 * Discriminated union of the hook events the adapter handles. Specific event
 * shapes carry their tool-specific fields; everything else falls through the
 * OtherCursorHookEvent branch.
 */
export type CursorHookEvent =
  | BeforeMCPExecutionEvent
  | BeforeShellExecutionEvent
  | PreToolUseEvent
  | PostToolUseEvent
  | OtherCursorHookEvent

/**
 * Cursor's permission decision surface for permission-bearing hooks.
 * See https://cursor.com/docs/hooks#response-shapes.
 */
export type AdapterDecision = 'allow' | 'deny' | 'ask'

export interface AdapterResult {
  decision: AdapterDecision
  receipt: AccountabilityActionReceipt
  /** Optional human-readable rationale; passed through to receipt scope_of_claim. */
  reason?: string
}

/**
 * Adapter configuration. agentPrivateKey is the Ed25519 private key (hex)
 * that signs receipts; agentDid is the corresponding public key (hex) that
 * appears as `agent_did` on emitted receipts. delegationChainRoot is the
 * sha256 hex of the canonical delegation chain that authorized the agent.
 */
export interface AdapterConfig {
  agentPrivateKey: string
  agentDid: string
  delegationChainRoot: string
  policy?: PolicyFunction
  /** Override timestamp for determinism in tests. */
  clock?: () => string
  /** Override scope_of_claim shaping for advanced use. */
  scopeOverride?: (event: CursorHookEvent, decision: AdapterDecision) => ScopeOfClaim
}

export type PolicyFunction = (
  event: CursorHookEvent,
) => Promise<AdapterDecision> | AdapterDecision
