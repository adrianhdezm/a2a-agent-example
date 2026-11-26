import { describe, expect, it } from 'vitest';
import { weatherAgent } from '../../../../src/agents/weather/weather.agent.ts';

describe('weatherAgent', () => {
  const agent = weatherAgent({ baseUrl: 'http://localhost:41241', runner: { name: 'claude' } });

  it('serves a card with one JSON-RPC interface under the base URL, streaming and no push notifications', () => {
    expect(agent.card.name).toBe('Weather Agent');
    expect(agent.card.supportedInterfaces.map(({ url }) => url)).toEqual(['http://localhost:41241/agents/weather/a2a/jsonrpc']);
    expect(agent.card.capabilities).toMatchObject({ streaming: true, pushNotifications: false });
  });

  it('mounts its card and JSON-RPC endpoint under /agents/weather/, with a request handler that serves the same card', async () => {
    expect(agent.paths).toMatchObject({ card: '/agents/weather/.well-known/agent-card.json', jsonRpc: '/agents/weather/a2a/jsonrpc' });
    expect(agent.url).toBe('http://localhost:41241/agents/weather/');
    expect(await agent.requestHandler.getAgentCard()).toBe(agent.card);
  });
});
