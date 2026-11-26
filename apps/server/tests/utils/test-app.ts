import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { weatherAgent } from '../../src/agents/weather/weather.agent.ts';
import { createApp } from '../../src/app.ts';
import { listen } from './test-server.ts';
import type { TestServer } from './test-server.ts';

/** One turn the agent ran: the prompt, the Claude session it resumed, and the tools it allowed. */
export interface TestTurn {
  prompt: string;
  sessionId: string | undefined;
  allowedTools: string[] | undefined;
}

export interface TestApp extends TestServer {
  /** Every turn the agent was asked to run, in order. */
  readonly turns: TestTurn[];
}

/**
 * The real app on an ephemeral port, with the weather agent built as `server.ts` builds it, but with a scripted SDK
 * `query()` in place of Claude: the n-th turn streams `script[n]`, and the last entry repeats. Open-Meteo is never
 * reached, since the scripted turns call no tool for real.
 */
export async function serveTestApp(script: SDKMessage[][]): Promise<TestApp> {
  const server = await listen();
  const turns: TestTurn[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
  async function* query({ prompt, options }: { prompt: string; options: Options }): AsyncIterable<SDKMessage> {
    turns.push({ prompt, sessionId: options.resume, allowedTools: options.allowedTools });
    yield* script[Math.min(turns.length, script.length) - 1] ?? [];
  }
  const agent = weatherAgent({
    baseUrl: server.baseUrl,
    query,
    fetchUrl: () => Promise.reject(new Error('Open-Meteo is not reached in the API tests'))
  });
  server.serve(createApp({ agent }));
  return { ...server, turns };
}
