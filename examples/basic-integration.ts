// Basic integration example for cursor-aps-adapter.
//
// Run: npx tsx examples/basic-integration.ts
//
// What it does:
//   1. Generates a fresh Ed25519 keypair (the agent identity).
//   2. Builds a CursorAPSAdapter with a sample restrictive policy.
//   3. Loads three Cursor hook event fixtures and handles each through the
//      adapter, printing the decision and the signed APS receipt.
//   4. Verifies one receipt end-to-end via verifyActionReceipt.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  generateKeyPair,
  verifyActionReceipt,
} from 'agent-passport-system'

import {
  CursorAPSAdapter,
  sampleRestrictivePolicy,
  type CursorHookEvent,
} from '../src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, '..', 'tests', 'fixtures')

function load(name: string): CursorHookEvent {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as CursorHookEvent
}

async function main(): Promise<void> {
  const keys = generateKeyPair()
  const delegationChainRoot = '0'.repeat(64)

  const adapter = new CursorAPSAdapter({
    agentPrivateKey: keys.privateKey,
    agentDid: keys.publicKey,
    delegationChainRoot,
    policy: sampleRestrictivePolicy,
  })

  const fixtures = [
    'cursor-hook-beforeMCPExecution.json',
    'cursor-hook-afterCommand.json',
    'cursor-hook-toolCall.json',
  ]

  let verifyTarget: Awaited<ReturnType<typeof adapter.handle>> | undefined

  for (const name of fixtures) {
    const event = load(name)
    const result = await adapter.handle(event)
    process.stdout.write(`\n=== ${name} ===\n`)
    process.stdout.write(`decision: ${result.decision}\n`)
    process.stdout.write(`receipt:\n${JSON.stringify(result.receipt, null, 2)}\n`)
    if (!verifyTarget) verifyTarget = result
  }

  if (verifyTarget) {
    const verdict = verifyActionReceipt(verifyTarget.receipt)
    process.stdout.write('\n=== verification ===\n')
    process.stdout.write(`receipt_id: ${verifyTarget.receipt.receipt_id}\n`)
    process.stdout.write(`verdict: ${JSON.stringify(verdict)}\n`)
    if (!verdict.valid) {
      process.exitCode = 1
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
