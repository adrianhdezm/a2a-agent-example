import { describe, expect, it } from 'vitest';
import { weatherAgent } from '../../../../src/agents/weather/weather.agent.ts';
import type { WeatherService } from '../../../../src/agents/weather/models/weather.model.ts';

const unusedWeather: WeatherService = {
  findPlaces: () => Promise.reject(new Error('not called')),
  forecast: () => Promise.reject(new Error('not called'))
};

describe('weatherAgent', () => {
  const agent = weatherAgent(unusedWeather);

  it('serves a card with one JSON-RPC interface, streaming and no push notifications', () => {
    const card = agent.card('http://localhost:41241');

    expect(card.supportedInterfaces.map(({ url }) => url)).toEqual(['http://localhost:41241/a2a/jsonrpc']);
    expect(card.capabilities).toMatchObject({ streaming: true, pushNotifications: false });
  });

  it('gives Claude the two weather tools and names its answer forecast', () => {
    expect(Object.keys(agent.mcpServers)).toEqual(['weather']);
    expect(agent.allowedTools).toEqual(['mcp__weather__find_city', 'mcp__weather__get_forecast']);
    expect(agent.answerArtifact.name).toBe('forecast');
  });
});
