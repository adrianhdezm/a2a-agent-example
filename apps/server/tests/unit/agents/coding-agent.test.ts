import { describe, expect, it } from 'vitest';
import { codingAgent } from '../../../src/agents/coding-agent.ts';

describe('codingAgent', () => {
  it('gives the agent the shared instructions and the write-code skill', () => {
    const agent = codingAgent({ id: 'gemini-coder', name: 'Gemini Coder', description: 'Writes code.', harness: 'gemini' });

    expect(agent).toMatchObject({ id: 'gemini-coder', harness: 'gemini' });
    expect(agent.instructions).toContain('workspace folder');
    expect(agent.skills.map(({ id }) => id)).toEqual(['write-code']);
  });
});
