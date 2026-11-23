import { UsageError } from './errors/usage-error.ts';

export interface AskArgs {
  agentId: string;
  prompt: string;
}

/** Reads the agent id and the prompt from the command-line arguments; the words after the id form the prompt. */
export function parseArgs(args: readonly string[]): AskArgs {
  const [agentId, ...words] = args;
  const prompt = words.join(' ').trim();
  if (agentId === undefined || agentId === '' || prompt === '') {
    throw new UsageError();
  }
  return { agentId, prompt };
}
