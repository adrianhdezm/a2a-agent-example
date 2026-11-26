import { createA2aAgent, runCodexTurn } from '../core/a2a-agent.ts';
import type { A2aAgent, AgentCardBase, CodexFactory, CodexTurnSettings } from '../core/a2a-agent.ts';
import { weatherAgentClient } from './clients/weather-agent.client.ts';
import type { ConnectAgent } from './clients/weather-agent.client.ts';
import { tripPlannerInstructions } from './prompts/trip-planner.prompt.ts';

/** What the trip planner needs from the server that runs it. */
export interface TripPlannerAgentOptions {
  /** Where the server is reached, for the card's endpoint URL. */
  baseUrl: string;
  /** The A2A URL of the weather agent it consults. */
  weatherAgentUrl: string;
  /** The Codex SDK's `Codex` and the A2A SDK's client, unless a test hands in its own. */
  codex?: CodexFactory;
  connect?: ConnectAgent;
}

const textModes = ['text/plain'];

// Enough for a forecast or two, and an answer to the weather agent's question.
const maxConsultations = 3;

const tripPlannerCard: AgentCardBase = {
  name: 'Trip Planner',
  description: 'Helps you get ready for a trip: what to pack and wear, from the forecast the Weather Agent gives it.',
  provider: undefined,
  version: '0.1.0',
  capabilities: { streaming: true, pushNotifications: false, extensions: [], extendedAgentCard: false },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: textModes,
  defaultOutputModes: textModes,
  skills: [
    {
      id: 'trip-planning',
      name: 'Trip planning',
      description: 'A packing list and practical advice for a trip in the next 7 days, from the forecast where you are going.',
      tags: ['travel', 'packing', 'weather'],
      examples: [
        'What should I pack for Lisbon this weekend?',
        "I'm in Springfield on Monday and Tuesday, what do I wear?",
        'Rome or Madrid on Friday: where do I need a jacket?'
      ],
      inputModes: textModes,
      outputModes: textModes,
      securityRequirements: []
    }
  ],
  signatures: []
};

/**
 * The trip planner, ready to serve: it runs on Codex, with no tools, and instructions dated per turn. It consults the
 * weather agent over A2A for forecasts, and answers in a `trip-plan` artifact.
 */
export function tripPlannerAgent({ baseUrl, weatherAgentUrl, codex, connect }: TripPlannerAgentOptions): A2aAgent {
  const settings: CodexTurnSettings = {
    instructions: () => tripPlannerInstructions(new Date()),
    consultant: weatherAgentClient(weatherAgentUrl, connect),
    maxConsultations,
    codex
  };
  return createA2aAgent(
    {
      id: 'trip-planner',
      card: tripPlannerCard,
      runTurn: (request) => runCodexTurn(settings, request),
      answerArtifact: { name: 'trip-plan', description: "The trip planner's answer" }
    },
    baseUrl
  );
}
