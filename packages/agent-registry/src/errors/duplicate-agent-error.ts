/** Thrown when an agent is registered under an id already taken. */
export class DuplicateAgentError extends Error {
  readonly agentId: string;

  constructor(agentId: string) {
    super(`An agent is already registered as "${agentId}"`);
    this.name = 'DuplicateAgentError';
    this.agentId = agentId;
  }
}
