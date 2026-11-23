/** Thrown when the command line does not name an agent and a prompt. */
export class UsageError extends Error {
  constructor() {
    super('Usage: pnpm ask <agent-id> "<prompt>"');
    this.name = 'UsageError';
  }
}
