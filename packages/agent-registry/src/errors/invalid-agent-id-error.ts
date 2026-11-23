/** Thrown when an agent id is not a URL-safe slug. */
export class InvalidAgentIdError extends Error {
  readonly agentId: string;

  constructor(agentId: string) {
    super(`"${agentId}" is not a URL-safe slug: use lowercase letters, digits and single hyphens`);
    this.name = 'InvalidAgentIdError';
    this.agentId = agentId;
  }
}
