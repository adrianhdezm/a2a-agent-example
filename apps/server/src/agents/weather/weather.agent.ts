import { createA2aAgent, resolveRunner } from '../core/a2a-agent.ts';
import type { A2aAgent, AgentCardBase, AgentSpec, Runner, RunnerConfig } from '../core/a2a-agent.ts';
import { openMeteoClient } from './clients/open-meteo.client.ts';
import type { Fetch } from './clients/open-meteo.client.ts';
import { weatherInstructions } from './prompts/weather.prompt.ts';
import { weatherTools } from './tools/weather.tool.ts';

/** What the weather agent needs from the server that runs it. */
export interface WeatherAgentOptions {
  /** Where the server is reached, for the card's endpoint URL. */
  baseUrl: string;
  /** The runner to run on, as configuration names it, or one a test hands in. */
  runner: RunnerConfig | Runner;
  /** The global `fetch`, unless a test hands in its own. */
  fetchUrl?: Fetch;
}

const textModes = ['text/plain'];

// Enough round trips for a city lookup, a forecast or two and the answer, with room to ask back.
const maxSteps = 8;

const weatherCard: AgentCardBase = {
  name: 'Weather Agent',
  description: 'Answers questions about the weather now and for the next 7 days anywhere in the world, from Open-Meteo forecasts.',
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

/**
 * The weather agent, ready to serve on any runner: the `find_city` and `get_forecast` tools over Open-Meteo, a prompt
 * dated per turn, and its answer in a `forecast` artifact.
 */
export function weatherAgent({ baseUrl, runner, fetchUrl }: WeatherAgentOptions): A2aAgent {
  const spec: AgentSpec = { instructions: weatherInstructions, tools: weatherTools(openMeteoClient(fetchUrl)), maxSteps };
  return createA2aAgent(
    {
      id: 'weather',
      card: weatherCard,
      spec,
      runner: resolveRunner(runner),
      answerArtifact: { name: 'forecast', description: "The weather agent's answer" }
    },
    baseUrl
  );
}
