/** One thing an agent can do, as its Agent Card advertises it. */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Prompts that show what the skill is for. */
  examples: string[];
}

/** An agent as configuration: who it is, which harness runs it, and where it works. */
export interface AgentDefinition {
  /** A URL-safe slug: lowercase letters, digits and single hyphens. It names the agent's endpoints. */
  id: string;
  name: string;
  description: string;
  /** The name of a harness in the `HarnessRegistry`. */
  harness: string;
  instructions: string;
  /** The working directory the agent reads and writes in. */
  workspace: string;
  /** The model to run; the harness's own default when absent. */
  model?: string;
  skills: AgentSkill[];
}

/** An agent as `GET /agents` and `GET /agents/:id` answer it: enough to pick it and fetch its card. */
export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  harness: string;
  cardUrl: string;
}

/** Which rule an agent id broke. */
export type AgentRegistryErrorReason = 'invalid-id' | 'duplicate-id' | 'unknown-id';

const registryMessages: Record<AgentRegistryErrorReason, (agentId: string) => string> = {
  'invalid-id': (agentId) => `"${agentId}" is not a URL-safe slug: use lowercase letters, digits and single hyphens`,
  'duplicate-id': (agentId) => `An agent is already registered as "${agentId}"`,
  'unknown-id': (agentId) => `No agent is registered as "${agentId}"`
};

/** Thrown by the `AgentRegistry`; `reason` says which rule the agent id broke. */
export class AgentRegistryError extends Error {
  readonly reason: AgentRegistryErrorReason;
  readonly agentId: string;

  constructor({ reason, agentId }: { reason: AgentRegistryErrorReason; agentId: string }) {
    super(registryMessages[reason](agentId));
    this.name = 'AgentRegistryError';
    this.reason = reason;
    this.agentId = agentId;
  }
}
