import { parseArgs } from 'node:util';
import { UsageError } from './errors/usage-error.ts';

/** What the command line asks of the CLI. */
export interface CliOptions {
  /** The agent's base URL; the server this repository runs when absent. */
  url?: string;
  /** Where the Agent Card is, relative to the URL; the A2A default when absent. */
  cardPath?: string;
  /** Show timestamps, task and context ids, and every state change. */
  verbose: boolean;
  help: boolean;
}

export const usage = `A2A terminal client

Usage: pnpm cli [url] [flags]

  url                 The agent's base URL. Default: the agent this repository runs, on the PORT in .env.
  --card-path <path>  The Agent Card's path, relative to the url. Default: .well-known/agent-card.json.
  --verbose           Show timestamps, task and context ids, and every state change.
  --help              Show this message.

In the session: /help lists the commands, /new starts a new conversation, /exit quits,
and Ctrl+C cancels the answer in progress.`;

/** Reads the CLI's flags and its one optional argument; throws a `UsageError` for anything else. */
export function parseCliArgs(args: readonly string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: { 'card-path': { type: 'string' }, verbose: { type: 'boolean' }, help: { type: 'boolean' } }
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
  const { values, positionals } = parsed;
  if (positionals.length > 1) {
    throw new UsageError(`Expected at most one url, got: ${positionals.join(' ')}`);
  }
  return { url: positionals[0], cardPath: values['card-path'], verbose: values.verbose ?? false, help: values.help ?? false };
}
