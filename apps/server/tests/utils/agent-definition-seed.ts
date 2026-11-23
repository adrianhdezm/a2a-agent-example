import type { AgentDefinition } from '../../src/agent-definition.ts';

/** A valid agent definition on the `fake` harness, with `overrides` applied. */
export function agentDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'claude-coder',
    name: 'Claude Coder',
    description: 'Writes and edits code in its workspace.',
    harness: 'fake',
    instructions: 'You write small programs.',
    workspace: '/srv/workspaces/claude-coder',
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
