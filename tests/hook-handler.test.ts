import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  generateKeyPair,
  publicKeyFromPrivate,
  verifyActionReceipt,
} from 'agent-passport-system'

import { CursorAPSAdapter } from '../src/hook-handler.js'
import type { CursorHookEvent, PolicyFunction } from '../src/types.js'

const here = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): CursorHookEvent {
  const raw = readFileSync(join(here, 'fixtures', name), 'utf8')
  return JSON.parse(raw) as CursorHookEvent
}

const FIXED_TIMESTAMP = '2026-04-30T00:00:00.000Z'
const DELEGATION_CHAIN_ROOT = 'c'.repeat(64)

function buildAdapter(opts: { policy?: PolicyFunction } = {}): CursorAPSAdapter {
  const keys = generateKeyPair()
  return new CursorAPSAdapter({
    agentPrivateKey: keys.privateKey,
    agentDid: keys.publicKey,
    delegationChainRoot: DELEGATION_CHAIN_ROOT,
    clock: () => FIXED_TIMESTAMP,
    ...(opts.policy ? { policy: opts.policy } : {}),
  })
}

describe('CursorAPSAdapter', () => {
  it('produces a signed receipt that verifies for an allowed event', async () => {
    const adapter = buildAdapter()
    const event = loadFixture('cursor-hook-beforeMCPExecution.json')
    const result = await adapter.handle(event)

    expect(result.decision).toBe('allow')
    expect(result.receipt.claim_type).toBe('aps:action:v1')
    expect(verifyActionReceipt(result.receipt)).toEqual({ valid: true })
  })

  it('produces a signed receipt that verifies for a denied event', async () => {
    const adapter = buildAdapter({ policy: () => 'deny' })
    const event = loadFixture('cursor-hook-afterCommand.json')
    const result = await adapter.handle(event)

    expect(result.decision).toBe('deny')
    expect(result.receipt.claim_type).toBe('aps:action:v1')
    expect(verifyActionReceipt(result.receipt)).toEqual({ valid: true })
    expect(result.receipt.scope_of_claim.asserts).toContain('"deny"')
  })

  it('passes the event into a custom policy function', async () => {
    let seen: CursorHookEvent | undefined
    const policy: PolicyFunction = (event) => {
      seen = event
      return 'ask'
    }
    const adapter = buildAdapter({ policy })
    const event = loadFixture('cursor-hook-toolCall.json')
    const result = await adapter.handle(event)

    expect(seen).toBe(event)
    expect(result.decision).toBe('ask')
  })

  it('throws cleanly when given an invalid private key', () => {
    expect(() => {
      new CursorAPSAdapter({
        agentPrivateKey: 'not-hex',
        agentDid: 'a'.repeat(64),
        delegationChainRoot: DELEGATION_CHAIN_ROOT,
      })
    }).toThrow(/agentPrivateKey/)
  })

  it('throws cleanly when given an invalid agent DID', () => {
    const keys = generateKeyPair()
    expect(() => {
      new CursorAPSAdapter({
        agentPrivateKey: keys.privateKey,
        agentDid: 'short',
        delegationChainRoot: DELEGATION_CHAIN_ROOT,
      })
    }).toThrow(/agentDid/)
  })

  it('produces deterministic receipts for the same event + key + clock', async () => {
    const keys = generateKeyPair()
    const make = () =>
      new CursorAPSAdapter({
        agentPrivateKey: keys.privateKey,
        agentDid: keys.publicKey,
        delegationChainRoot: DELEGATION_CHAIN_ROOT,
        clock: () => FIXED_TIMESTAMP,
      })

    const event = loadFixture('cursor-hook-toolCall.json')
    const a = await make().handle(event)
    const b = await make().handle(event)

    expect(a.receipt.receipt_id).toBe(b.receipt.receipt_id)
    expect(a.receipt.signature).toBe(b.receipt.signature)
  })

  it('binds the receipt signer_did to the configured agent identity', async () => {
    const keys = generateKeyPair()
    const adapter = new CursorAPSAdapter({
      agentPrivateKey: keys.privateKey,
      agentDid: keys.publicKey,
      delegationChainRoot: DELEGATION_CHAIN_ROOT,
      clock: () => FIXED_TIMESTAMP,
    })
    const result = await adapter.handle(loadFixture('cursor-hook-beforeMCPExecution.json'))

    expect(result.receipt.signer_did).toBe(publicKeyFromPrivate(keys.privateKey))
    expect(result.receipt.agent_did).toBe(keys.publicKey)
    expect(result.receipt.delegation_chain_root).toBe(DELEGATION_CHAIN_ROOT)
  })
})
