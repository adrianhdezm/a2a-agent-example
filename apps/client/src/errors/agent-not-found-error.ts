/** Thrown when the server lists no agent with the requested id. */
export class AgentNotFoundError extends Error {
  readonly agentId: string;

  constructor(agentId: string, available: string[]) {
    super(`The server has no agent "${agentId}"; it has: ${available.join(', ') || 'none'}`);
    this.name = 'AgentNotFoundError';
    this.agentId = agentId;
  }
}
