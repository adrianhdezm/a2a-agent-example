import { describe, expect, it } from 'vitest';
import { isAgentSummary, summarizeAgent } from '../src/agent-summary.ts';
import { agentDefinition } from './utils/agent-definition-seed.ts';

describe('agent-summary', () => {
  it('summarizes an agent with the URL of its card', () => {
    expect(summarizeAgent(agentDefinition(), 'http://localhost:4000')).toEqual({
      id: 'claude-coder',
      name: 'Claude Coder',
      description: 'Writes and edits code in its workspace.',
      harness: 'fake',
      cardUrl: 'http://localhost:4000/agents/claude-coder/.well-known/agent-card.json'
    });
  });

  it('recognizes a summary parsed from JSON', () => {
    const parsed: unknown = JSON.parse(JSON.stringify(summarizeAgent(agentDefinition(), 'http://localhost:4000')));

    expect(isAgentSummary(parsed)).toBe(true);
  });

  it.each([undefined, null, 'claude-coder', { id: 'claude-coder' }, { id: 1, name: 'a', description: 'b', harness: 'c', cardUrl: 'd' }])(
    'rejects %j as a summary',
    (value) => {
      expect(isAgentSummary(value)).toBe(false);
    }
  );
});
