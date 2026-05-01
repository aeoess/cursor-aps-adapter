// Policy decision engine.
//
// The default policy passes everything through as "allow". Real deployments
// are expected to plug in a domain-specific PolicyFunction. The adapter is
// the bridge between Cursor's enforcement decision and APS's signed receipt;
// policy authorship lives with the deployer.

import type { CursorHookEvent, PolicyFunction } from './types.js'

export const defaultAllowAll: PolicyFunction = () => 'allow'

/**
 * Reference policy — denies any preToolUse / beforeShellExecution event whose
 * command or tool_input mentions destructive verbs against production paths.
 * Provided as a starting point. Tune the patterns to your environment.
 */
export const sampleRestrictivePolicy: PolicyFunction = (event) => {
  const productionMarker = /(\/prod\/|\/production\/|prod\.)/i
  const destructiveVerb = /\b(rm\s+-rf|drop\s+table|truncate|volumeDelete)\b/i

  if (event.hook_event_name === 'beforeShellExecution') {
    if (destructiveVerb.test(event.command)) return 'deny'
    if (productionMarker.test(event.cwd)) return 'ask'
  }

  if (event.hook_event_name === 'preToolUse') {
    const serialized = safeStringify(event.tool_input)
    if (destructiveVerb.test(serialized)) return 'deny'
    if (productionMarker.test(serialized)) return 'ask'
  }

  if (event.hook_event_name === 'beforeMCPExecution') {
    if (destructiveVerb.test(event.tool_input)) return 'deny'
  }

  return 'allow'
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

export type { PolicyFunction } from './types.js'
