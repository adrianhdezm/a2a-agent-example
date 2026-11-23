import type { AgentsApi, NewAgent } from './agents-api.ts';
import { AgentExistsError } from './errors/agent-exists-error.ts';

const coderInstructions = [
  'You are a coding agent that works inside your workspace folder.',
  'Write and edit the files the user asks for there, keep changes small, and end with a short summary of what you did.'
].join(' ');

const writeCode = {
  id: 'write-code',
  name: 'Write code',
  description: 'Writes or edits small programs and files in the agent workspace.',
  tags: ['code', 'files'],
  examples: ["Write hello.py that prints 'Hello, A2A!'"]
};

/** The agents `pnpm agents seed` creates: one coding agent on each harness the server ships with. */
export const starterAgents: NewAgent[] = [
  {
    id: 'claude-coder',
    name: 'Claude Coder',
    description: 'A coding agent on the Claude Agent SDK that writes and edits files in its workspace.',
    harness: 'claude',
    instructions: coderInstructions,
    skills: [writeCode]
  },
  {
    id: 'codex-coder',
    name: 'Codex Coder',
    description: 'A coding agent on the Codex SDK that writes and edits files in its workspace.',
    harness: 'codex',
    instructions: coderInstructions,
    skills: [writeCode]
  }
];

export interface SeedResult {
  id: string;
  outcome: 'created' | 'exists';
}

/** Creates each of `agents` on the server; one it already has is left as it is, so seeding twice changes nothing. */
export async function seedAgents(api: AgentsApi, agents: readonly NewAgent[] = starterAgents): Promise<SeedResult[]> {
  return Promise.all(
    agents.map(async (agent): Promise<SeedResult> => {
      try {
        await api.create(agent);
        return { id: agent.id, outcome: 'created' };
      } catch (error) {
        if (error instanceof AgentExistsError) {
          return { id: agent.id, outcome: 'exists' };
        }
        throw error;
      }
    })
  );
}
