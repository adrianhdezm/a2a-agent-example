/** Thrown when the server already has an agent with the id a new one asks for. */
export class AgentExistsError extends Error {
  readonly agentId: string;

  constructor(agentId: string) {
    super(`The server already has an agent "${agentId}"`);
    this.name = 'AgentExistsError';
    this.agentId = agentId;
  }
}
