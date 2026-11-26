import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { createApp } from '../../src/app.ts';
import { TurnAgentExecutor } from '../../src/agents/core/executors/turn-agent.executor.ts';
import type { TurnEvent, TurnRequest } from '../../src/agents/core/models/turn.model.ts';
import { SessionStore } from '../../src/agents/core/stores/session.store.ts';
import type { WeatherService } from '../../src/agents/weather/models/weather.model.ts';
import { weatherAgent } from '../../src/agents/weather/weather.agent.ts';
import { listen } from './test-server.ts';
import type { TestServer } from './test-server.ts';

export interface TestApp extends TestServer {
  /** Every turn the agent was asked to run, in order. */
  readonly turns: TurnRequest[];
}

// The scripted turns stand in for Claude and its tools, so the weather service is never reached.
const unusedWeather: WeatherService = {
  findPlaces: () => Promise.reject(new Error('not called')),
  forecast: () => Promise.reject(new Error('not called'))
};

/**
 * The real app on an ephemeral port, wired as `server.ts` wires it, with a scripted turn runner in place of Claude:
 * the n-th turn answers with `script[n]`, and the last entry repeats.
 */
export async function serveTestApp(script: TurnEvent[][]): Promise<TestApp> {
  const server = await listen();
  const turns: TurnRequest[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
  async function* runTurn(request: TurnRequest): AsyncIterable<TurnEvent> {
    turns.push(request);
    yield* script[Math.min(turns.length, script.length) - 1] ?? [];
  }
  const { card, answerArtifact } = weatherAgent(unusedWeather);
  const executor = new TurnAgentExecutor({ runTurn, sessions: new SessionStore(), answerArtifact });
  const requestHandler = new DefaultRequestHandler(card(server.baseUrl), new InMemoryTaskStore(), executor);
  server.serve(createApp({ requestHandler }));
  return { ...server, turns };
}
