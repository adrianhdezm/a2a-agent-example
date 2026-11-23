import type { Agent, AgentInput } from '../../src/models/agent.model.ts';

/** A fixed instant on 1 January 2026, `n` seconds in. */
export function instant(n: number): string {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();
}

/** A clock that moves one second per reading, from `instant(0)`. */
export function fixedClock(): () => Date {
  let n = 0;
  return () => new Date(instant(n++));
}

/** A valid `POST /agents` body on the `fake` harness, with `overrides` applied. */
export function agentInput(overrides: Partial<AgentInput> = {}): AgentInput {
  return {
    id: 'claude-coder',
    name: 'Claude Coder',
    description: 'Writes and edits code in its workspace.',
    harness: 'fake',
    instructions: 'You write small programs.',
    skills: [
      {
        id: 'write-code',
        name: 'Write code',
        description: 'Writes a small program to a file in the workspace.',
        tags: ['code'],
        examples: ["Write hello.py that prints 'Hello, A2A!'"]
      }
    ],
    ...overrides
  };
}

/** A stored agent: `agentInput` with its workspace and fixed timestamps, with `overrides` applied. */
export function agent(overrides: Partial<Agent> = {}): Agent {
  const input = agentInput(overrides);
  return { ...input, workspace: `/srv/workspaces/${input.id}`, createdAt: instant(0), updatedAt: instant(0), ...overrides };
}
