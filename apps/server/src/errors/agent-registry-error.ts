/** Which rule an agent id broke. */
export type AgentRegistryErrorReason = 'invalid-id' | 'duplicate-id' | 'unknown-id';

export interface AgentRegistryErrorDetails {
  reason: AgentRegistryErrorReason;
  agentId: string;
}

const messages: Record<AgentRegistryErrorReason, (agentId: string) => string> = {
  'invalid-id': (agentId) => `"${agentId}" is not a URL-safe slug: use lowercase letters, digits and single hyphens`,
  'duplicate-id': (agentId) => `An agent is already registered as "${agentId}"`,
  'unknown-id': (agentId) => `No agent is registered as "${agentId}"`
};

/** Thrown by the `AgentRegistry`; `reason` says which rule the agent id broke. */
export class AgentRegistryError extends Error {
  readonly reason: AgentRegistryErrorReason;
  readonly agentId: string;

  constructor({ reason, agentId }: AgentRegistryErrorDetails) {
    super(messages[reason](agentId));
    this.name = 'AgentRegistryError';
    this.reason = reason;
    this.agentId = agentId;
  }
}
