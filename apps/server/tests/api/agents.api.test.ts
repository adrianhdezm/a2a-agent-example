import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestServer } from '../utils/test-server.ts';

describe('GET /agents and GET /agents/:id', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await serveTestApp();
  });

  afterAll(async () => {
    await server.close();
  });

  it('lists the registered agents with the URL of each card', async () => {
    const response = await fetch(`${server.baseUrl}/agents`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 'first-coder',
        name: 'First Coder',
        description: 'Writes and edits code in its workspace.',
        harness: 'fake',
        cardUrl: `${server.baseUrl}/agents/first-coder/.well-known/agent-card.json`
      },
      {
        id: 'second-coder',
        name: 'Second Coder',
        description: 'Writes and edits code in its workspace.',
        harness: 'fake',
        cardUrl: `${server.baseUrl}/agents/second-coder/.well-known/agent-card.json`
      }
    ]);
  });

  it('answers an unknown query param with a 400 in the standard error shape', async () => {
    const response = await fetch(`${server.baseUrl}/agents?page=2`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'error', message: 'Unknown query params: page' });
  });

  it('answers one agent by id with the URL of its card', async () => {
    const response = await fetch(`${server.baseUrl}/agents/second-coder`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'second-coder',
      name: 'Second Coder',
      description: 'Writes and edits code in its workspace.',
      harness: 'fake',
      cardUrl: `${server.baseUrl}/agents/second-coder/.well-known/agent-card.json`
    });
  });

  it('answers an id no agent has with a 404 in the standard error shape', async () => {
    const response = await fetch(`${server.baseUrl}/agents/missing`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: 'error', message: 'Agent not found: missing' });
  });
});
