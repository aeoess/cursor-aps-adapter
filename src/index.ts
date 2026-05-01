// Public surface for cursor-aps-adapter.
//
// Consumers should import from the package root. Internals (mapper, policy
// helpers) are exported as well to support custom integrations and testing.

export { CursorAPSAdapter } from './hook-handler.js'
export {
  defaultAllowAll,
  sampleRestrictivePolicy,
} from './policy-engine.js'
export { mapEventToReceiptInput } from './receipt-mapper.js'

export type {
  AdapterConfig,
  AdapterDecision,
  AdapterResult,
  CursorHookEvent,
  CursorHookEventBase,
  CursorHookName,
  OtherCursorHookEvent,
  SpecializedHookName,
  BeforeMCPExecutionEvent,
  BeforeShellExecutionEvent,
  PreToolUseEvent,
  PostToolUseEvent,
  PolicyFunction,
} from './types.js'

export type { MapInput, MappedReceiptInput } from './receipt-mapper.js'
