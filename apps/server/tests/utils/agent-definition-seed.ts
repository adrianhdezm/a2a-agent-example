import type { AgentDefinition } from '@a2a-agent-example/agent-registry';

/** An agent on the `fake` harness. */
export function fakeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'fake-coder',
    name: 'Fake Coder',
    description: 'Answers from a script.',
    harness: 'fake',
    instructions: 'You write small programs.',
    workspace: '/srv/workspaces/fake-coder',
    skills: [],
    ...overrides
  };
}
