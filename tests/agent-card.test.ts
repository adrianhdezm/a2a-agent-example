import { describe, expect, it } from 'vitest';
import { weatherAgentCard } from '../src/agent-card.ts';

describe('weatherAgentCard', () => {
  it('serves one JSON-RPC interface on protocol 1.0 under the base URL', () => {
    expect(weatherAgentCard('http://localhost:41241/').supportedInterfaces).toEqual([
      { url: 'http://localhost:41241/a2a/jsonrpc', protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it('declares streaming, which the executor does, and no push notifications', () => {
    expect(weatherAgentCard('http://localhost:41241').capabilities).toMatchObject({ streaming: true, pushNotifications: false });
  });
});
