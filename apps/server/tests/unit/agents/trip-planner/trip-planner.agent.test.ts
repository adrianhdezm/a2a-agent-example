import { describe, expect, it } from 'vitest';
import { tripPlannerAgent } from '../../../../src/agents/trip-planner/trip-planner.agent.ts';

describe('tripPlannerAgent', () => {
  const agent = tripPlannerAgent({ baseUrl: 'http://localhost:41241', weatherAgentUrl: 'http://localhost:41241/agents/weather/' });

  it('serves a card with one JSON-RPC interface under /agents/trip-planner/, streaming and no push notifications', () => {
    expect(agent.card.name).toBe('Trip Planner');
    expect(agent.card.supportedInterfaces.map(({ url }) => url)).toEqual(['http://localhost:41241/agents/trip-planner/a2a/jsonrpc']);
    expect(agent.card.capabilities).toMatchObject({ streaming: true, pushNotifications: false });
    expect(agent.url).toBe('http://localhost:41241/agents/trip-planner/');
  });

  it('mounts its card and JSON-RPC endpoint at its own paths, with a request handler that serves the same card', async () => {
    expect(agent.paths).toMatchObject({
      card: '/agents/trip-planner/.well-known/agent-card.json',
      jsonRpc: '/agents/trip-planner/a2a/jsonrpc'
    });
    expect(await agent.requestHandler.getAgentCard()).toBe(agent.card);
  });
});
