// CursorAPSAdapter — bridge from Cursor hook events to signed APS receipts.
//
// One adapter instance per agent identity. The instance holds the signing
// key and the delegation chain root; each handle() call produces one signed
// AccountabilityActionReceipt regardless of decision. Even denials get
// receipts: a deny is itself a governance event worth attesting.

import { createActionReceipt } from 'agent-passport-system'
import type { AccountabilityActionReceipt } from 'agent-passport-system'

import { defaultAllowAll } from './policy-engine.js'
import { mapEventToReceiptInput } from './receipt-mapper.js'
import type {
  AdapterConfig,
  AdapterDecision,
  AdapterResult,
  CursorHookEvent,
} from './types.js'

export class CursorAPSAdapter {
  private readonly clock: () => string

  constructor(private readonly config: AdapterConfig) {
    if (!config.agentPrivateKey || !/^[0-9a-fA-F]{64}$/.test(config.agentPrivateKey)) {
      throw new Error(
        'CursorAPSAdapter: agentPrivateKey must be a 64-char hex string (Ed25519 raw private key)',
      )
    }
    if (!config.agentDid || !/^[0-9a-fA-F]{64}$/.test(config.agentDid)) {
      throw new Error(
        'CursorAPSAdapter: agentDid must be a 64-char hex string (Ed25519 raw public key)',
      )
    }
    if (!config.delegationChainRoot || !/^[0-9a-fA-F]{64}$/.test(config.delegationChainRoot)) {
      throw new Error(
        'CursorAPSAdapter: delegationChainRoot must be a 64-char sha256 hex string',
      )
    }
    this.clock = config.clock ?? (() => new Date().toISOString())
  }

  async handle(event: CursorHookEvent): Promise<AdapterResult> {
    const policy = this.config.policy ?? defaultAllowAll
    const decision = (await policy(event)) as AdapterDecision

    const timestamp = this.clock()
    const receipt = this.signReceipt(event, decision, timestamp)

    return { decision, receipt }
  }

  private signReceipt(
    event: CursorHookEvent,
    decision: AdapterDecision,
    timestamp: string,
  ): AccountabilityActionReceipt {
    const input = mapEventToReceiptInput({
      event,
      decision,
      agentDid: this.config.agentDid,
      delegationChainRoot: this.config.delegationChainRoot,
      timestamp,
      ...(this.config.scopeOverride ? { scopeOverride: this.config.scopeOverride } : {}),
    })

    return createActionReceipt(
      {
        scope_of_claim: input.scope_of_claim,
        agent_did: input.agent_did,
        delegation_chain_root: input.delegation_chain_root,
        action: input.action,
        side_effect_classes: input.side_effect_classes,
        timestamp: input.timestamp,
      },
      this.config.agentPrivateKey,
    )
  }
}
