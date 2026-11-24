import type { AgentExecutionEvent, ExecutionEventBus } from '@a2a-js/sdk/server';

export interface FakeEventBus {
  bus: ExecutionEventBus;
  events: AgentExecutionEvent[];
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
