import type { AgentExecutionEvent, ExecutionEventBus } from '@a2a-js/sdk/server';

export interface FakeEventBus {
  /** The bus to hand to the executor. */
  bus: ExecutionEventBus;
  /** Every event published, in order. */
  events: AgentExecutionEvent[];
  /** How many times `finished()` was called. */
  finishedCalls: () => number;
}

/** An event bus that records what the executor publishes; the executor only publishes and finishes. */
export function fakeEventBus(): FakeEventBus {
  const events: AgentExecutionEvent[] = [];
  let finished = 0;
  const bus = {
    publish: (event: AgentExecutionEvent) => {
      events.push(event);
    },
    finished: () => {
      finished += 1;
    }
  } as unknown as ExecutionEventBus;
  return { bus, events, finishedCalls: () => finished };
}
