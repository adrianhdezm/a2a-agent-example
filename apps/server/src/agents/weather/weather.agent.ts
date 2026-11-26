import type { AgentCard } from '@a2a-js/sdk';
import { jsonRpcInterface } from '../core/helpers/agent-card.helper.ts';
import type { AgentDefinition } from '../core/models/agent-definition.model.ts';
import type { WeatherService } from './models/weather.model.ts';
import { weatherInstructions } from './prompts/weather.prompt.ts';
import { weatherMcpServer, weatherServerName, weatherToolNames } from './tools/weather.tool.ts';

const textModes = ['text/plain'];

// Enough round trips for a city lookup, a forecast or two and the answer, with room to ask back.
const maxTurns = 8;

function weatherAgentCard(baseUrl: string): AgentCard {
  return {
    name: 'Weather Agent',
    description: 'Answers questions about the weather now and for the next 7 days anywhere in the world, from Open-Meteo forecasts.',
    supportedInterfaces: [jsonRpcInterface(baseUrl)],
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

/** The weather agent: its card, a dated prompt, the `find_city` and `get_forecast` tools on `weather`, and its `forecast` answer. */
export function weatherAgent(weather: WeatherService): AgentDefinition {
  return {
    card: weatherAgentCard,
    systemPrompt: () => weatherInstructions(new Date()),
    mcpServers: { [weatherServerName]: weatherMcpServer(weather) },
    allowedTools: weatherToolNames,
    maxTurns,
    answerArtifact: { name: 'forecast', description: "The weather agent's answer" }
  };
}
