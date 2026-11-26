import type { AgentCard } from '@a2a-js/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

describe('GET /agents/<id>/.well-known/agent-card.json', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp([[]]);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['weather', 'Weather Agent'],
    ['trip-planner', 'Trip Planner']
  ])("serves the %s agent's card, with its own JSON-RPC endpoint on this server and streaming declared", async (id, name) => {
    const response = await fetch(`${app.baseUrl}/agents/${id}/.well-known/agent-card.json`);
    const card = (await response.json()) as AgentCard;

    expect(response.status).toBe(200);
    expect(card.name).toBe(name);
    expect(card.supportedInterfaces[0]?.url).toBe(`${app.baseUrl}/agents/${id}/a2a/jsonrpc`);
    expect(card.capabilities?.streaming).toBe(true);
  });

  it('serves no card at the root, since each agent has its own', async () => {
    const response = await fetch(`${app.baseUrl}/.well-known/agent-card.json`);

    expect(response.status).toBe(404);
  });
});
