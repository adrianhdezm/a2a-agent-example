import { describe, expect, it } from 'vitest';
import { weatherAgent } from '../../../../src/agents/weather/weather.agent.ts';

describe('weatherAgent', () => {
  const agent = weatherAgent({ apiKey: 'test-key', baseUrl: 'http://localhost:41241' });

  it('serves a card with one JSON-RPC interface under the base URL, streaming and no push notifications', () => {
    expect(agent.card.name).toBe('Weather Agent');
    expect(agent.card.supportedInterfaces.map(({ url }) => url)).toEqual(['http://localhost:41241/a2a/jsonrpc']);
    expect(agent.card.capabilities).toMatchObject({ streaming: true, pushNotifications: false });
  });

  it('mounts its card and JSON-RPC endpoint at the A2A paths, with a request handler that serves the same card', async () => {
    expect(agent.paths).toEqual({ card: '/.well-known/agent-card.json', jsonRpc: '/a2a/jsonrpc' });
    expect(await agent.requestHandler.getAgentCard()).toBe(agent.card);
  });
});
