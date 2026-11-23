import type { AgentCard } from '@a2a-js/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agentInput } from '../utils/agent-seed.ts';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

describe('GET /agents/:id/.well-known/agent-card.json', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function card(id: string): Promise<{ status: number; card: AgentCard }> {
    const response = await fetch(`${app.baseUrl}/agents/${id}/.well-known/agent-card.json`, { headers: { 'Cache-Control': 'no-cache' } });
    return { status: response.status, card: (await response.json()) as AgentCard };
  }

  it("serves each agent's own card, pointing at its own JSON-RPC endpoint", async () => {
    const { status, card: served } = await card('second-coder');

    expect(status).toBe(200);
    expect(served.supportedInterfaces).toEqual([
      { url: `${app.baseUrl}/agents/second-coder/a2a/jsonrpc`, protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it('serves the card of an agent created at runtime, follows its changes, and stops once it is deleted', async () => {
    const headers = { 'Content-Type': 'application/json' };
    await fetch(`${app.baseUrl}/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify(agentInput({ id: 'reviewer', name: 'Reviewer' }))
    });
    expect((await card('reviewer')).card.name).toBe('Reviewer');

    await fetch(`${app.baseUrl}/agents/reviewer`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Senior Reviewer' }) });
    expect((await card('reviewer')).card.name).toBe('Senior Reviewer');

    await fetch(`${app.baseUrl}/agents/reviewer`, { method: 'DELETE' });
    expect(await card('reviewer')).toEqual({ status: 404, card: { status: 'error', message: 'Agent not found: reviewer' } });
  });
});
