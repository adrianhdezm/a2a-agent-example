import { TaskState } from '@a2a-js/sdk';
import type { AgentExecutionEvent } from '@a2a-js/sdk/server';
import { describe, expect, it } from 'vitest';
import type { TurnEvent, TurnRequest } from '../../src/claude-turn.ts';
import { WeatherAgentExecutor } from '../../src/weather-agent-executor.ts';
import { fakeEventBus } from '../utils/fake-event-bus.ts';
import { requestContext } from '../utils/request-context-seed.ts';

const ids = { taskId: 'task-1', contextId: 'context-1' };

/** A turn runner that answers every turn with `events`, and records what it was asked. */
function fakeTurns(events: TurnEvent[]) {
  const requests: TurnRequest[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
  async function* runTurn(request: TurnRequest): AsyncIterable<TurnEvent> {
    requests.push(request);
    yield* events;
  }
  return { requests, runTurn };
}

/** Each published event as its kind and the state or artifact name it carries. */
function timeline(events: AgentExecutionEvent[]): string[] {
  return events.map((event) => {
    if (event.kind === 'artifactUpdate') {
      return `artifact ${event.data.artifact?.name ?? ''}`;
    }
    if (event.kind === 'message') {
      return 'message';
    }
    return `${event.kind === 'task' ? 'task' : 'status'} ${TaskState[event.data.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED]}`;
  });
}

function partsOf(event: AgentExecutionEvent | undefined) {
  if (event?.kind === 'statusUpdate') {
    return event.data.status?.message?.parts;
  }
  return event?.kind === 'artifactUpdate' ? event.data.artifact?.parts : undefined;
}

/** The text of a status update's message or of an artifact. */
function textOf(event: AgentExecutionEvent | undefined): string | undefined {
  const content = partsOf(event)?.[0]?.content;
  return content?.$case === 'text' ? content.value : undefined;
}

describe('WeatherAgentExecutor', () => {
  it('streams progress, then completes with the answer as the forecast artifact', async () => {
    // Arrange
    const { runTurn } = fakeTurns([
      { type: 'session', sessionId: 'session-1' },
      { type: 'progress', text: 'Calling find_city {"name":"Lisbon"}' },
      { type: 'result', ok: true, text: 'Take an umbrella tomorrow.\nCOMPLETED' }
    ]);
    const { bus, events, finishedCalls } = fakeEventBus();

    // Act
    await new WeatherAgentExecutor(runTurn).execute(requestContext('Lisbon tomorrow?', ids), bus);

    // Assert
    expect(timeline(events)).toEqual([
      'task TASK_STATE_SUBMITTED',
      'status TASK_STATE_WORKING',
      'status TASK_STATE_WORKING',
      'artifact forecast',
      'status TASK_STATE_COMPLETED'
    ]);
    expect(textOf(events[2])).toBe('Calling find_city {"name":"Lisbon"}');
    expect(textOf(events[3])).toBe('Take an umbrella tomorrow.');
    expect(finishedCalls()).toBe(1);
  });

  it("asks the user back with input-required, carrying the agent's question on the status", async () => {
    const { runTurn } = fakeTurns([{ type: 'result', ok: true, text: 'Springfield, Illinois or Missouri?\nAWAITING_USER_INPUT' }]);
    const { bus, events } = fakeEventBus();

    await new WeatherAgentExecutor(runTurn).execute(requestContext('Springfield this weekend?', ids), bus);

    expect(timeline(events).at(-1)).toBe('status TASK_STATE_INPUT_REQUIRED');
    expect(textOf(events.at(-1))).toBe('Springfield, Illinois or Missouri?');
    expect(timeline(events)).not.toContain('artifact forecast');
  });

  it('resumes the Claude session of the context for the next message', async () => {
    const { requests, runTurn } = fakeTurns([
      { type: 'session', sessionId: 'session-1' },
      { type: 'result', ok: true, text: 'Which Springfield?\nAWAITING_USER_INPUT' }
    ]);
    const executor = new WeatherAgentExecutor(runTurn);

    await executor.execute(requestContext('Springfield this weekend?', ids), fakeEventBus().bus);
    await executor.execute(requestContext('Illinois', ids), fakeEventBus().bus);
    await executor.execute(requestContext('Paris today?', { taskId: 'task-2', contextId: 'context-2' }), fakeEventBus().bus);

    expect(requests.map(({ prompt, sessionId }) => [prompt, sessionId])).toEqual([
      ['Springfield this weekend?', undefined],
      ['Illinois', 'session-1'],
      ['Paris today?', undefined]
    ]);
  });

  it.each([
    ['a failed turn', [{ type: 'result', ok: false, error: 'error_max_turns' }] as TurnEvent[], 'Agent error: error_max_turns'],
    ['a turn that ends without an answer', [] as TurnEvent[], 'Agent error: the turn ended without an answer']
  ])('fails the task for %s', async (_case, turn, message) => {
    const { runTurn } = fakeTurns(turn);
    const { bus, events, finishedCalls } = fakeEventBus();

    await new WeatherAgentExecutor(runTurn).execute(requestContext('Lisbon tomorrow?', ids), bus);

    expect(timeline(events).at(-1)).toBe('status TASK_STATE_FAILED');
    expect(textOf(events.at(-1))).toBe(message);
    expect(finishedCalls()).toBe(1);
  });

  it('fails the task with the message of an error the turn throws', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await, require-yield -- a turn that fails before its first event
    async function* runTurn(): AsyncIterable<TurnEvent> {
      throw new Error('spawn claude ENOENT');
    }
    const { bus, events } = fakeEventBus();

    await new WeatherAgentExecutor(runTurn).execute(requestContext('Lisbon tomorrow?', ids), bus);

    expect(textOf(events.at(-1))).toBe('Agent error: spawn claude ENOENT');
  });

  it('cancels the running turn and ends the task canceled', async () => {
    // Arrange: a turn that waits until it is aborted, as the SDK's query does.
    let started: () => void = () => undefined;
    const running = new Promise<void>((resolve) => {
      started = resolve;
    });
    async function* runTurn({ abortController }: TurnRequest): AsyncIterable<TurnEvent> {
      started();
      await new Promise((_resolve, reject) => {
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Claude Code process aborted by user'));
        });
      });
      yield { type: 'result', ok: true, text: 'never' };
    }
    const executor = new WeatherAgentExecutor(runTurn);
    const { bus, events, finishedCalls } = fakeEventBus();

    // Act
    const execution = executor.execute(requestContext('Lisbon tomorrow?', ids), bus);
    await running;
    await executor.cancelTask('task-1');
    await execution;

    // Assert
    expect(timeline(events).at(-1)).toBe('status TASK_STATE_CANCELED');
    expect(finishedCalls()).toBe(1);
  });
});
