const usage = [
  'Usage:',
  '  pnpm ask <agent-id> "<prompt>"',
  '  pnpm agents list',
  '  pnpm agents seed',
  '  pnpm agents create <agent-id> --harness <claude|codex> --instructions "<goal>" [--name "<name>"] [--description "<text>"] [--model <model>]'
].join('\n');

/** Thrown when the command line is not one of the client's commands. */
export class UsageError extends Error {
  constructor(problem: string) {
    super(`${problem}\n${usage}`);
    this.name = 'UsageError';
  }
}
