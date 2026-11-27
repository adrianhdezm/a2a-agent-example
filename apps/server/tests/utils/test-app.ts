import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { claudeRunner } from '../../src/agents/core/runners/claude.runner.ts';
import { codexRunner } from '../../src/agents/core/runners/codex.runner.ts';
import { tripPlannerAgent } from '../../src/agents/trip-planner/trip-planner.agent.ts';
import { weatherAgent } from '../../src/agents/weather/weather.agent.ts';
import { createApp } from '../../src/app.ts';
import { mcpCallingCodex } from './fake-codex.ts';
import type { CodexStep, McpCodexRun } from './fake-codex.ts';
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
  /** Every Codex run the trip planner made, in order, with what its tools answered. */
  readonly codexRuns: McpCodexRun[];
}

/**
 * The real app on an ephemeral port, with both agents built as `server.ts` builds them, on the runners `.env.example`
 * names, but scripted. The weather agent runs on Claude, its n-th turn streaming `claude[n]` (the last repeating). The
 * trip planner runs on Codex, its n-th run playing `codex[n]` through a fake that calls the agent's tools over its MCP
 * endpoint, as the Codex CLI does: so `ask_weather_agent` really runs, and reaches the weather agent over HTTP. Open-Meteo
 * is never reached, since the scripted turns call no tool for real.
 */
export async function serveTestApp(claude: SDKMessage[][], codex: CodexStep[][] = []): Promise<TestApp> {
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
  const fake = mcpCallingCodex(codex);
  const trip = tripPlannerAgent({ baseUrl: server.baseUrl, runner: codexRunner({ codex: fake.factory }), weatherAgentUrl: weather.url });
  server.serve(createApp({ agents: [weather, trip] }));
  return { ...server, turns, codexRuns: fake.runs };
}
