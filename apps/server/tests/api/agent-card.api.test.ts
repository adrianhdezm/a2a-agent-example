import type { AgentCard } from '@a2a-js/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

describe('GET /.well-known/agent-card.json', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp([[]]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the agent's card, with its JSON-RPC endpoint on this server and streaming declared", async () => {
    const response = await fetch(`${app.baseUrl}/.well-known/agent-card.json`);
    const card = (await response.json()) as AgentCard;

    expect(response.status).toBe(200);
    expect(card.name).toBe('Weather Agent');
    expect(card.supportedInterfaces[0]?.url).toBe(`${app.baseUrl}/a2a/jsonrpc`);
    expect(card.capabilities?.streaming).toBe(true);
  });
});
