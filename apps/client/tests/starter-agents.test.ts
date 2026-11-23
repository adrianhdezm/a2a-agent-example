import { describe, expect, it } from 'vitest';
import type { AgentsApi, NewAgent } from '../src/agents-api.ts';
import { AgentExistsError } from '../src/errors/agent-exists-error.ts';
import { UnexpectedResponseError } from '../src/errors/unexpected-response-error.ts';
import { seedAgents, starterAgents } from '../src/starter-agents.ts';

/** An `/agents` API that already has the agents in `existing`, and records what it was asked to create. */
function fakeApi(existing: string[], failWith?: Error) {
  const created: NewAgent[] = [];
  const api = {
    create: (agent: NewAgent) => {
      if (failWith !== undefined) {
        return Promise.reject(failWith);
      }
      if (existing.includes(agent.id)) {
        return Promise.reject(new AgentExistsError(agent.id));
      }
      created.push(agent);
      return Promise.resolve({ ...agent, cardUrl: `http://localhost:4000/agents/${agent.id}/.well-known/agent-card.json` });
    }
  } as unknown as AgentsApi;
  return { api, created };
}

describe('starter-agents', () => {
  it('starts with one coding agent on each harness the server ships with', () => {
    expect(starterAgents.map(({ id, harness }) => ({ id, harness }))).toEqual([
      { id: 'claude-coder', harness: 'claude' },
      { id: 'codex-coder', harness: 'codex' }
    ]);
    expect(starterAgents.every(({ skills }) => skills.length > 0)).toBe(true);
  });

  describe('seedAgents', () => {
    it('creates every starter agent the server does not have yet', async () => {
      const { api, created } = fakeApi([]);

      expect(await seedAgents(api)).toEqual([
        { id: 'claude-coder', outcome: 'created' },
        { id: 'codex-coder', outcome: 'created' }
      ]);
      expect(created.map(({ id }) => id)).toEqual(['claude-coder', 'codex-coder']);
    });

    it('leaves an agent the server already has as it is', async () => {
      const { api, created } = fakeApi(['claude-coder']);

      expect(await seedAgents(api)).toEqual([
        { id: 'claude-coder', outcome: 'exists' },
        { id: 'codex-coder', outcome: 'created' }
      ]);
      expect(created.map(({ id }) => id)).toEqual(['codex-coder']);
    });

    it('fails on any other refusal', async () => {
      const { api } = fakeApi([], new UnexpectedResponseError('POST /agents answered 400: unknown harness'));

      await expect(seedAgents(api)).rejects.toThrow(UnexpectedResponseError);
    });
  });
});
