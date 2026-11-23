import { describe, expect, it } from 'vitest';
import { summarizeAgent } from '../../src/agent-summary.ts';
import { agentDefinition } from '../utils/agent-definition-seed.ts';

describe('summarizeAgent', () => {
  it('summarizes an agent with the URL of its card', () => {
    expect(summarizeAgent(agentDefinition(), 'http://localhost:4000')).toEqual({
      id: 'claude-coder',
      name: 'Claude Coder',
      description: 'Writes and edits code in its workspace.',
      harness: 'fake',
      cardUrl: 'http://localhost:4000/agents/claude-coder/.well-known/agent-card.json'
    });
  });
});
