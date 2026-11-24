import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';

/** Where the agent's A2A endpoints live on the server. */
export const agentPaths = { card: '/.well-known/agent-card.json', jsonRpc: '/a2a/jsonrpc' } as const;

const textModes = ['text/plain'];

/** The weather agent's A2A 1.0 card, served at `baseUrl` with one JSON-RPC interface. */
export function weatherAgentCard(baseUrl: string): AgentCard {
  return {
    name: 'Weather Agent',
    description: 'Answers questions about the weather now and for the next 7 days anywhere in the world, from Open-Meteo forecasts.',
    supportedInterfaces: [
      {
        url: `${baseUrl.replace(/\/+$/, '')}${agentPaths.jsonRpc}`,
        protocolBinding: 'JSONRPC',
        tenant: '',
        protocolVersion: A2A_PROTOCOL_VERSION
      }
    ],
    provider: undefined,
    version: '0.1.0',
    capabilities: { streaming: true, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: textModes,
    defaultOutputModes: textModes,
    skills: [
      {
        id: 'weather-forecast',
        name: 'Weather forecast',
        description: 'The current weather and a daily forecast for a city: conditions, temperatures, rain and wind, with practical advice.',
        tags: ['weather', 'forecast', 'travel'],
        examples: [
          'Do I need an umbrella in Lisbon tomorrow?',
          "What's the weather like in Springfield this weekend?",
          'Is it warmer in Rome or Madrid on Friday?'
        ],
        inputModes: textModes,
        outputModes: textModes,
        securityRequirements: []
      }
    ],
    signatures: []
  };
}
