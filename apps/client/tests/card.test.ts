import type { AgentCard } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { renderCard } from '../src/card.ts';
import { tagStyle } from './utils/a2a-seed.ts';

const card: AgentCard = {
  name: 'Weather Agent',
  description: 'Answers questions about the weather.',
  supportedInterfaces: [{ url: 'http://localhost:41241/a2a/jsonrpc', protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }],
  provider: undefined,
  version: '0.1.0',
  capabilities: { streaming: true, pushNotifications: false, extensions: [], extendedAgentCard: false },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'weather-forecast',
      name: 'Weather forecast',
      description: 'The weather now and for the next days.',
      tags: ['weather'],
      examples: ['Do I need an umbrella in Lisbon tomorrow?'],
      inputModes: [],
      outputModes: [],
      securityRequirements: []
    }
  ],
  signatures: []
};

describe('renderCard', () => {
  it('shows who the agent is, where it is reached, whether it streams, and its skills with examples', () => {
    expect(renderCard(card, tagStyle).split('\n')).toEqual([
      '<green>Weather Agent <dim>v0.1.0',
      'Answers questions about the weather.',
      '  Endpoint:  JSON-RPC at http://localhost:41241/a2a/jsonrpc (A2A 1.0)',
      '  Streaming: yes',
      '  Skills:',
      '    <bold>Weather forecast: The weather now and for the next days.',
      '  <dim>    e.g. Do I need an umbrella in Lisbon tomorrow?'
    ]);
  });

  it('names a binding it does not know as the card gives it, and leaves out an empty skills list', () => {
    const lines = renderCard(
      {
        ...card,
        supportedInterfaces: [
          { url: 'http://localhost:41241/a2a/jsonrpc', protocolBinding: 'WEBSOCKET', tenant: '', protocolVersion: '1.0' }
        ],
        skills: []
      },
      tagStyle
    );

    expect(lines).toContain('WEBSOCKET at http://localhost:41241/a2a/jsonrpc');
    expect(lines).not.toContain('Skills');
  });
});
