import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { registerFauxProvider } from '@mariozechner/pi-ai';
import type { Context, FauxResponseStep } from '@mariozechner/pi-ai';
import { claudeRunner } from '../../src/agents/core/runners/claude.runner.ts';
import { piRunner } from '../../src/agents/core/runners/pi.runner.ts';
import { tripPlannerAgent } from '../../src/agents/trip-planner/trip-planner.agent.ts';
import { weatherAgent } from '../../src/agents/weather/weather.agent.ts';
import { createApp } from '../../src/app.ts';
import { listen } from './test-server.ts';
import type { TestServer } from './test-server.ts';

/** One turn the weather agent ran: the prompt, the Claude session it resumed, and the tools it allowed. */
export interface TestTurn {
  prompt: string;
  sessionId: string | undefined;
  allowedTools: string[] | undefined;
}

export interface TestApp extends TestServer {
  /** Every turn the weather agent was asked to run, in order. */
  readonly turns: TestTurn[];
  /** The context of every model call the trip planner made, in order. */
  readonly tripCalls: Context[];
}

let fauxProviders = 0;

/**
 * The real app on an ephemeral port, with both agents built as `server.ts` builds them, but scripted. The weather agent
 * runs on Claude, its n-th turn streaming `claude[n]` (the last repeating); the trip planner runs on Pi with Pi's fake
 * provider, whose model calls are `tripPlanner` in turn, so its tools run for real: `ask_weather_agent` reaches the
 * weather agent over HTTP, as in production. Open-Meteo is never reached, since the scripted turns call no tool for real.
 */
export async function serveTestApp(claude: SDKMessage[][], tripPlanner: FauxResponseStep[] = []): Promise<TestApp> {
  const server = await listen();
  const turns: TestTurn[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
  async function* query({ prompt, options }: { prompt: string; options: Options }): AsyncIterable<SDKMessage> {
    turns.push({ prompt, sessionId: options.resume, allowedTools: options.allowedTools });
    yield* claude[Math.min(turns.length, claude.length) - 1] ?? [];
  }
  const weather = weatherAgent({
    baseUrl: server.baseUrl,
    runner: claudeRunner({ query }),
    fetchUrl: () => Promise.reject(new Error('Open-Meteo is not reached in the API tests'))
  });
  const tripCalls: Context[] = [];
  fauxProviders += 1;
  const faux = registerFauxProvider({ provider: `faux-app-${String(fauxProviders)}` });
  faux.setResponses(
    tripPlanner.map((step): FauxResponseStep => (context, ...rest) => {
      tripCalls.push({ ...context, messages: structuredClone(context.messages) });
      return typeof step === 'function' ? step(context, ...rest) : step;
    })
  );
  const trip = tripPlannerAgent({ baseUrl: server.baseUrl, runner: piRunner({ model: faux.getModel() }), weatherAgentUrl: weather.url });
  server.serve(createApp({ agents: [weather, trip] }));
  return {
    ...server,
    turns,
    tripCalls,
    close: async () => {
      faux.unregister();
      await server.close();
    }
  };
}
