import { describe, expect, it } from 'vitest';
import { isAgentSummary } from '../src/agent-summary.ts';

describe('isAgentSummary', () => {
  it('recognizes an entry of the GET /agents list', () => {
    const parsed: unknown = JSON.parse(
      '{"id":"claude-coder","name":"Claude Coder","description":"Writes code.","harness":"claude","cardUrl":"http://localhost:4000/agents/claude-coder/.well-known/agent-card.json"}'
    );

    expect(isAgentSummary(parsed)).toBe(true);
  });

  it.each([undefined, null, 'claude-coder', { id: 'claude-coder' }, { id: 1, name: 'a', description: 'b', harness: 'c', cardUrl: 'd' }])(
    'rejects %j',
    (value) => {
      expect(isAgentSummary(value)).toBe(false);
    }
  );
});
