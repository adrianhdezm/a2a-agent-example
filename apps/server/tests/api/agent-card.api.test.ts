import type { AgentCard } from '@a2a-js/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestServer } from '../utils/test-server.ts';

describe('GET /agents/:id/.well-known/agent-card.json', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await serveTestApp();
  });

  afterAll(async () => {
    await server.close();
  });

  it.each(['first-coder', 'second-coder'])("serves %s's own card, pointing at its own JSON-RPC endpoint", async (id) => {
    const response = await fetch(`${server.baseUrl}/agents/${id}/.well-known/agent-card.json`);
    const card = (await response.json()) as AgentCard;

    expect(response.status).toBe(200);
    expect(card.supportedInterfaces).toEqual([
      { url: `${server.baseUrl}/agents/${id}/a2a/jsonrpc`, protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it('answers an agent that is not registered with a 404 in the standard error shape', async () => {
    const response = await fetch(`${server.baseUrl}/agents/missing/.well-known/agent-card.json`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: 'error', message: 'Not Found: GET /agents/missing/.well-known/agent-card.json' });
  });
});
