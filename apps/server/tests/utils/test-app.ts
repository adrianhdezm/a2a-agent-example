import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ThreadEvent } from '@openai/codex-sdk';
import { tripPlannerAgent } from '../../src/agents/trip-planner/trip-planner.agent.ts';
import { weatherAgent } from '../../src/agents/weather/weather.agent.ts';
import { createApp } from '../../src/app.ts';
import { fakeCodex } from './fake-codex.ts';
import type { CodexRun } from './fake-codex.ts';
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
  /** Every run the trip planner asked of Codex, in order. */
  readonly codexRuns: CodexRun[];
}

/**
 * The real app on an ephemeral port, with both agents built as `server.ts` builds them, but scripted: the weather
 * agent's n-th Claude turn streams `claude[n]` and the trip planner's n-th Codex run streams `codex[n]`, the last entry
 * of each repeating. The trip planner reaches the weather agent over HTTP, as in production. Open-Meteo is never
 * reached, since the scripted turns call no tool for real.
 */
export async function serveTestApp(claude: SDKMessage[][], codex: ThreadEvent[][] = [[]]): Promise<TestApp> {
  const server = await listen();
  const turns: TestTurn[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
  async function* query({ prompt, options }: { prompt: string; options: Options }): AsyncIterable<SDKMessage> {
    turns.push({ prompt, sessionId: options.resume, allowedTools: options.allowedTools });
    yield* claude[Math.min(turns.length, claude.length) - 1] ?? [];
  }
  const weather = weatherAgent({
    baseUrl: server.baseUrl,
    query,
    fetchUrl: () => Promise.reject(new Error('Open-Meteo is not reached in the API tests'))
  });
  const fake = fakeCodex(codex);
  const tripPlanner = tripPlannerAgent({ baseUrl: server.baseUrl, weatherAgentUrl: weather.url, codex: fake.factory });
  server.serve(createApp({ agents: [weather, tripPlanner] }));
  return { ...server, turns, codexRuns: fake.runs };
}
