import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { createApp } from '../../src/app.ts';
import { WeatherAgentExecutor } from '../../src/executors/weather-agent.executor.ts';
import { weatherAgentCard } from '../../src/helpers/agent-card.helper.ts';
import type { TurnEvent, TurnRequest } from '../../src/models/turn.model.ts';
import { SessionStore } from '../../src/stores/session.store.ts';
import { listen } from './test-server.ts';
import type { TestServer } from './test-server.ts';

export interface TestApp extends TestServer {
  /** Every turn the agent was asked to run, in order. */
  readonly turns: TurnRequest[];
}

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
  const executor = new WeatherAgentExecutor(runTurn, new SessionStore());
  const requestHandler = new DefaultRequestHandler(weatherAgentCard(server.baseUrl), new InMemoryTaskStore(), executor);
  server.serve(createApp({ requestHandler }));
  return { ...server, turns };
}
