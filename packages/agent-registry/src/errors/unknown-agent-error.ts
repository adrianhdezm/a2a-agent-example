/** Thrown when no agent is registered under the requested id. */
export class UnknownAgentError extends Error {
  readonly agentId: string;

  constructor(agentId: string) {
    super(`No agent is registered as "${agentId}"`);
    this.name = 'UnknownAgentError';
    this.agentId = agentId;
  }
}
