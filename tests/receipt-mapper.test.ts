import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { mapEventToReceiptInput } from '../src/receipt-mapper.js'
import type { CursorHookEvent } from '../src/types.js'

const here = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): CursorHookEvent {
  const raw = readFileSync(join(here, 'fixtures', name), 'utf8')
  return JSON.parse(raw) as CursorHookEvent
}

const FIXED = {
  agentDid: 'a'.repeat(64),
  delegationChainRoot: 'b'.repeat(64),
  timestamp: '2026-04-30T00:00:00.000Z',
}

describe('mapEventToReceiptInput', () => {
  it('maps a beforeMCPExecution event to a tool-targeted receipt input', () => {
    const event = loadFixture('cursor-hook-beforeMCPExecution.json')
    const out = mapEventToReceiptInput({
      event,
      decision: 'allow',
      agentDid: FIXED.agentDid,
      delegationChainRoot: FIXED.delegationChainRoot,
      timestamp: FIXED.timestamp,
    })

    expect(out.action.kind).toBe('cursor.hook.beforeMCPExecution')
    expect(out.action.target).toBe('mcp:search_files')
    expect(out.side_effect_classes).toContain('external_message')
    expect(out.scope_of_claim.capture_mode).toBe('gateway_observed')
    expect(out.scope_of_claim.self_attested).toBe(false)
    expect(out.timestamp).toBe(FIXED.timestamp)
  })

  it('maps a beforeShellExecution event to a shell-targeted receipt input', () => {
    const event = loadFixture('cursor-hook-afterCommand.json')
    const out = mapEventToReceiptInput({
      event,
      decision: 'allow',
      agentDid: FIXED.agentDid,
      delegationChainRoot: FIXED.delegationChainRoot,
      timestamp: FIXED.timestamp,
    })

    expect(out.action.kind).toBe('cursor.hook.beforeShellExecution')
    expect(out.action.target).toContain('shell:npm test')
    expect(out.side_effect_classes).toEqual(
      expect.arrayContaining(['external_message', 'data_modification']),
    )
  })

  it('maps a preToolUse event preserving tool name and use id', () => {
    const event = loadFixture('cursor-hook-toolCall.json')
    const out = mapEventToReceiptInput({
      event,
      decision: 'allow',
      agentDid: FIXED.agentDid,
      delegationChainRoot: FIXED.delegationChainRoot,
      timestamp: FIXED.timestamp,
    })

    expect(out.action.kind).toBe('cursor.hook.preToolUse')
    expect(out.action.target).toBe('tool:Write')
    expect(out.action.parameters?.tool_use_id).toBe('use_01HX5K2P3QRSWriteCallID01')
  })

  it('honors a scopeOverride function', () => {
    const event = loadFixture('cursor-hook-toolCall.json')
    const out = mapEventToReceiptInput({
      event,
      decision: 'deny',
      agentDid: FIXED.agentDid,
      delegationChainRoot: FIXED.delegationChainRoot,
      timestamp: FIXED.timestamp,
      scopeOverride: () => ({
        asserts: 'custom scope',
        does_not_assert: ['nothing-else'],
        capture_mode: 'self_attested',
        completeness: 'complete',
        self_attested: true,
      }),
    })

    expect(out.scope_of_claim.asserts).toBe('custom scope')
    expect(out.scope_of_claim.self_attested).toBe(true)
  })

  it('threads decision and reason into the default scope assertion', () => {
    const event = loadFixture('cursor-hook-afterCommand.json')
    const out = mapEventToReceiptInput({
      event,
      decision: 'deny',
      agentDid: FIXED.agentDid,
      delegationChainRoot: FIXED.delegationChainRoot,
      timestamp: FIXED.timestamp,
      reason: 'matched destructive verb pattern',
    })

    expect(out.scope_of_claim.asserts).toContain('"deny"')
    expect(out.scope_of_claim.asserts).toContain('matched destructive verb pattern')
  })
})
