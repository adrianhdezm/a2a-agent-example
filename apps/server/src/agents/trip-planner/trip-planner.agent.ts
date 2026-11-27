import { askAgentTool, codexRunner, createA2aAgent } from '../core/a2a-agent.ts';
import type { A2aAgent, AgentCardBase, AgentSpec, ConnectAgent, Runner } from '../core/a2a-agent.ts';
import { tripPlannerInstructions } from './prompts/trip-planner.prompt.ts';

/** What the trip planner needs from the server that runs it. */
export interface TripPlannerAgentOptions {
  /** Where the server is reached, for the card's endpoint URL. */
  baseUrl: string;
  /** The A2A URL of the weather agent it asks. */
  weatherAgentUrl: string;
  /** The runner on a fake SDK, and the A2A SDK's client, unless a test hands in its own. */
  runner?: Runner;
  connect?: ConnectAgent;
}

const textModes = ['text/plain'];

// Enough round trips for a forecast or two, an answer to the weather agent's question, and the answer.
const maxSteps = 8;

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
 * The trip planner, ready to serve: it runs on Codex, with one tool, `ask_weather_agent`, which asks the weather agent
 * over A2A, instructions dated per turn, and its answer in a `trip-plan` artifact.
 */
export function tripPlannerAgent({ baseUrl, weatherAgentUrl, runner = codexRunner(), connect }: TripPlannerAgentOptions): A2aAgent {
  const askWeather = askAgentTool({
    name: 'ask_weather_agent',
    agentName: 'Weather Agent',
    knows: 'the weather now and for the next 7 days anywhere in the world',
    url: weatherAgentUrl,
    connect
  });
  const spec: AgentSpec = { instructions: tripPlannerInstructions, tools: [askWeather], maxSteps };
  return createA2aAgent(
    {
      id: 'trip-planner',
      card: tripPlannerCard,
      spec,
      runner,
      answerArtifact: { name: 'trip-plan', description: "The trip planner's answer" }
    },
    baseUrl
  );
}
