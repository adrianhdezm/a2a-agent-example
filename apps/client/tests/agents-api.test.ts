import { describe, expect, it } from 'vitest';
import { agentsApi } from '../src/agents-api.ts';
import { AgentExistsError } from '../src/errors/agent-exists-error.ts';
import { AgentNotFoundError } from '../src/errors/agent-not-found-error.ts';
import { UnexpectedResponseError } from '../src/errors/unexpected-response-error.ts';

const claudeCoder = {
  id: 'claude-coder',
  name: 'Claude Coder',
  description: 'Writes code.',
  harness: 'claude',
  instructions: 'You write small programs.',
  cardUrl: 'http://localhost:4000/agents/claude-coder/.well-known/agent-card.json'
};

const newAgent = {
  id: 'claude-coder',
  name: 'Claude Coder',
  description: 'Writes code.',
  harness: 'claude',
  instructions: 'Go.',
  skills: []
};

function answering(body: unknown, status = 200) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetchUrl = (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    return Promise.resolve(Response.json(body, { status }));
  };
  return { requests, api: agentsApi('http://localhost:4000/', fetchUrl) };
}

describe('agentsApi', () => {
  it('gets one agent by id', async () => {
    const { requests, api } = answering(claudeCoder);

    expect(await api.get('claude-coder')).toEqual(claudeCoder);
    expect(requests.map(({ url }) => url)).toEqual(['http://localhost:4000/agents/claude-coder']);
  });

  it('throws an AgentNotFoundError when the server has no agent with the id', async () => {
    const { api } = answering({ status: 'error', message: 'No agent exists as "missing"' }, 404);

    await expect(api.get('missing')).rejects.toThrow(AgentNotFoundError);
  });

  it('lists the agents sorted by id', async () => {
    const { requests, api } = answering({ items: [claudeCoder], total: 1, page: 1, pageSize: 100, totalPages: 1 });

    expect(await api.list()).toMatchObject({ items: [claudeCoder], total: 1 });
    expect(requests[0]?.url).toBe('http://localhost:4000/agents?sortField=id&sortDirection=ASC&pageSize=100');
  });

  it('creates an agent by posting it as JSON', async () => {
    const { requests, api } = answering(claudeCoder, 201);

    await api.create(newAgent);

    expect(requests[0]?.init).toMatchObject({ method: 'POST', body: JSON.stringify(newAgent) });
  });

  it('throws an AgentExistsError when the server already has an agent with the id', async () => {
    const { api } = answering({ status: 'error', message: 'An agent already exists as "claude-coder"' }, 409);

    await expect(api.create(newAgent)).rejects.toThrow(AgentExistsError);
  });

  it("carries the server's message when it refuses a request", async () => {
    const { api } = answering(
      { status: 'error', message: 'Agent "claude-coder" names the harness "gemini", which is not registered' },
      400
    );

    await expect(api.create({ ...newAgent, harness: 'gemini' })).rejects.toThrow(
      'POST /agents answered 400: Agent "claude-coder" names the harness "gemini", which is not registered'
    );
  });

  it('throws an UnexpectedResponseError for a body it cannot read', async () => {
    const { api } = answering([claudeCoder]);

    await expect(api.list()).rejects.toThrow(UnexpectedResponseError);
  });
});
