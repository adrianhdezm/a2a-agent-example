import { parseArgs } from 'node:util';
import type { NewAgent } from './agents-api.ts';
import { UsageError } from './errors/usage-error.ts';

/** What the command line asks the client to do. */
export type Command =
  | { name: 'ask'; agentId: string; prompt: string }
  | { name: 'list-agents' }
  | { name: 'seed-agents' }
  | { name: 'create-agent'; agent: NewAgent };

/** Reads the command from the command-line arguments. */
export function parseCommand(args: readonly string[]): Command {
  const [command, ...rest] = args;
  if (command === 'ask') {
    return parseAsk(rest);
  }
  if (command === 'agents') {
    return parseAgents(rest);
  }
  throw new UsageError(`Unknown command: ${args.join(' ') || '(none)'}`);
}

// agents list | agents seed | agents create …
function parseAgents(args: readonly string[]): Command {
  const [subcommand, ...rest] = args;
  if (subcommand === 'list' && rest.length === 0) {
    return { name: 'list-agents' };
  }
  if (subcommand === 'seed' && rest.length === 0) {
    return { name: 'seed-agents' };
  }
  if (subcommand === 'create') {
    return { name: 'create-agent', agent: parseNewAgent(rest) };
  }
  throw new UsageError(`Unknown command: agents ${args.join(' ')}`.trimEnd());
}

// ask <agent-id> <prompt…>: the words after the id form the prompt.
function parseAsk(args: readonly string[]): Command {
  const [agentId, ...words] = args;
  const prompt = words.join(' ').trim();
  if (agentId === undefined || agentId === '' || prompt === '') {
    throw new UsageError('ask needs an agent id and a prompt');
  }
  return { name: 'ask', agentId, prompt };
}

// agents create <agent-id> --harness … --instructions …: the name defaults to the id and the description to what the
// agent runs on, since both are input the user may leave out.
function parseNewAgent(args: readonly string[]): NewAgent {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      harness: { type: 'string' },
      instructions: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      model: { type: 'string' }
    }
  });
  const [id, ...extra] = positionals;
  const { harness, instructions, model } = values;
  if (id === undefined || extra.length > 0 || harness === undefined || instructions === undefined) {
    throw new UsageError('agents create needs one agent id, --harness and --instructions');
  }
  const name = values.name ?? id;
  const description = values.description ?? `${name}, an agent on the ${harness} harness`;
  return { id, name, description, harness, instructions, ...(model === undefined ? {} : { model }), skills: [] };
}
