import { describe, expect, it } from 'vitest';
import { agentPaths, joinUrl } from '../../src/agent-paths.ts';

describe('agent-paths', () => {
  it('puts every endpoint of an agent under /agents/<id>', () => {
    expect(agentPaths('claude-coder')).toEqual({
      base: '/agents/claude-coder',
      card: '/agents/claude-coder/.well-known/agent-card.json',
      jsonRpc: '/agents/claude-coder/a2a/jsonrpc'
    });
  });

  it.each(['http://localhost:4000', 'http://localhost:4000/'])('joins %s and a path with one slash', (baseUrl) => {
    expect(joinUrl(baseUrl, '/agents')).toBe('http://localhost:4000/agents');
  });
});
