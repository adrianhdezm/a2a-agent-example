import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agentInput } from '../utils/agent-seed.ts';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

describe('/agents', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function send(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${app.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  it('creates, reads, lists, changes and deletes an agent', async () => {
    // Create
    const created = await send('POST', '/agents', agentInput({ id: 'reviewer', name: 'Reviewer', instructions: 'Review the code.' }));
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      id: 'reviewer',
      harness: 'fake',
      workspace: '/srv/workspaces/reviewer',
      cardUrl: `${app.baseUrl}/agents/reviewer/.well-known/agent-card.json`
    });

    // Read and list
    expect(await (await send('GET', '/agents/reviewer')).json()).toMatchObject({ instructions: 'Review the code.' });
    const list = (await (await send('GET', '/agents?sortField=id&sortDirection=ASC')).json()) as { items: { id: string }[]; total: number };
    expect(list.total).toBe(3);
    expect(list.items.map(({ id }) => id)).toEqual(['first-coder', 'reviewer', 'second-coder']);

    // Change
    const changed = await send('PATCH', '/agents/reviewer', { instructions: 'Review the tests too.' });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ instructions: 'Review the tests too.' });

    // Delete
    expect((await send('DELETE', '/agents/reviewer')).status).toBe(204);
    expect((await send('GET', '/agents/reviewer')).status).toBe(404);
  });

  it('answers a page of the list with the totals', async () => {
    const response = await send('GET', '/agents?page=2&pageSize=1&sortField=id&sortDirection=ASC');

    expect(await response.json()).toMatchObject({ items: [{ id: 'second-coder' }], total: 2, page: 2, pageSize: 1, totalPages: 2 });
  });

  it.each([
    { name: 'an invalid query', method: 'GET', path: '/agents?harness=claude', status: 400, message: 'Invalid query' },
    {
      name: 'an invalid body',
      method: 'POST',
      path: '/agents',
      body: { ...agentInput({ id: 'other' }), workspace: '/etc' },
      status: 400,
      message: 'Invalid body'
    },
    {
      name: 'a harness that is not registered',
      method: 'POST',
      path: '/agents',
      body: agentInput({ id: 'other', harness: 'gemini' }),
      status: 400,
      message: 'Agent "other" names the harness "gemini", which is not registered'
    },
    {
      name: 'an id already taken',
      method: 'POST',
      path: '/agents',
      body: agentInput({ id: 'first-coder' }),
      status: 409,
      message: 'An agent already exists as "first-coder"'
    },
    {
      name: 'a change to the harness',
      method: 'PATCH',
      path: '/agents/first-coder',
      body: { harness: 'codex' },
      status: 400,
      message: 'Invalid body'
    },
    { name: 'an agent that does not exist', method: 'GET', path: '/agents/missing', status: 404, message: 'No agent exists as "missing"' }
  ])(
    'answers $name in the standard error shape',
    async (row: { method: string; path: string; body?: unknown; status: number; message: string }) => {
      const response = await send(row.method, row.path, row.body);

      expect(response.status).toBe(row.status);
      expect(await response.json()).toEqual({ status: 'error', message: row.message });
    }
  );

  it('answers malformed JSON with a 400 in the standard error shape', async () => {
    const response = await fetch(`${app.baseUrl}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"id":'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ status: 'error' });
  });

  it('answers a body over 100 kB with a 413', async () => {
    const response = await send('POST', '/agents', agentInput({ id: 'big', instructions: 'x'.repeat(110_000) }));

    expect(response.status).toBe(413);
  });
});
