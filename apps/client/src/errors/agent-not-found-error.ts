/** Thrown when the server has no agent with the requested id. */
export class AgentNotFoundError extends Error {
  readonly agentId: string;

  constructor(agentId: string) {
    super(`The server has no agent "${agentId}": pnpm agents list shows the ones it has`);
    this.name = 'AgentNotFoundError';
    this.agentId = agentId;
  }
}
