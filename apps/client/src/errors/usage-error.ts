/** Thrown when the command line has a flag or an argument the CLI does not take. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
