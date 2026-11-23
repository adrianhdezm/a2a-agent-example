import { describe, expect, it } from 'vitest';
import { codingAgent } from '../../../src/agents/coding-agent.ts';

describe('codingAgent', () => {
  it('gives the agent the shared instructions and write-code skill, in a workspace named for its id', () => {
    const agent = codingAgent(
      { id: 'gemini-coder', name: 'Gemini Coder', description: 'Writes code.', harness: 'gemini' },
      '/srv/workspaces'
    );

    expect(agent).toMatchObject({ id: 'gemini-coder', harness: 'gemini', workspace: '/srv/workspaces/gemini-coder' });
    expect(agent.instructions).toContain('workspace folder');
    expect(agent.skills.map(({ id }) => id)).toEqual(['write-code']);
  });
});
