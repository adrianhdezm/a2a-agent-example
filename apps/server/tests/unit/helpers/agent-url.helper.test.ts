import { describe, expect, it } from 'vitest';
import { agentPaths, joinUrl, toAgentResponse } from '../../../src/helpers/agent-url.helper.ts';
import { agent } from '../../utils/agent-seed.ts';

describe('agent-url.helper', () => {
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

  it('answers an agent with the URL of its card', () => {
    expect(toAgentResponse(agent(), 'http://localhost:4000')).toEqual({
      ...agent(),
      cardUrl: 'http://localhost:4000/agents/claude-coder/.well-known/agent-card.json'
    });
  });
});
