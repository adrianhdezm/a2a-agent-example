import { describe, expect, it } from 'vitest';
import { isAgentPage, isAgentResponse } from '../src/agent-response.ts';

const agent = {
  id: 'claude-coder',
  name: 'Claude Coder',
  description: 'Writes code.',
  harness: 'claude',
  instructions: 'You write small programs.',
  cardUrl: 'http://localhost:4000/agents/claude-coder/.well-known/agent-card.json',
  workspace: '/srv/workspaces/claude-coder'
};

describe('agent-response', () => {
  it('recognizes an agent and a page of agents parsed from JSON', () => {
    const page: unknown = JSON.parse(JSON.stringify({ items: [agent], total: 1, page: 1, pageSize: 20, totalPages: 1 }));

    expect(isAgentResponse(agent)).toBe(true);
    expect(isAgentPage(page)).toBe(true);
  });

  it.each([undefined, null, 'claude-coder', { id: 'claude-coder' }, { ...agent, cardUrl: 1 }])('rejects %j as an agent', (value) => {
    expect(isAgentResponse(value)).toBe(false);
  });

  it.each([[[agent]], { items: [agent] }, { items: [{ id: 'x' }], total: 1 }])('rejects %j as a page', (value) => {
    expect(isAgentPage(value)).toBe(false);
  });
});
