import { TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { readWeatherEvent, weatherAgentClient } from '../../../../../src/agents/trip-planner/clients/weather-agent.client.ts';
import type { ConnectAgent } from '../../../../../src/agents/trip-planner/clients/weather-agent.client.ts';
import type { TurnEvent } from '../../../../../src/agents/core/a2a-agent.ts';

const contextId = 'ctx-1';

function text(value: string) {
  return { content: { $case: 'text' as const, value }, metadata: undefined, filename: '', mediaType: 'text/plain' };
}

function task(id: string): StreamResponse {
  return { payload: { $case: 'task', value: { id, contextId } } } as unknown as StreamResponse;
}

function status(taskId: string, state: TaskState, message?: string): StreamResponse {
  return {
    payload: {
      $case: 'statusUpdate',
      value: { taskId, contextId, status: { state, message: message === undefined ? undefined : { parts: [text(message)] } } }
    }
  } as unknown as StreamResponse;
}

function artifact(taskId: string, value: string): StreamResponse {
  return {
    payload: { $case: 'artifactUpdate', value: { taskId, contextId, artifact: { parts: [text(value)] } } }
  } as unknown as StreamResponse;
}

/** A weather agent whose n-th message streams `script[n]`; it records what it was sent and what was cancelled. */
function fakeAgent(script: StreamResponse[][], connected: string[] = []) {
  const sent: SendMessageRequest[] = [];
  const cancelled: string[] = [];
  const connect: ConnectAgent = (url) => {
    connected.push(url);
    return Promise.resolve({
      // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
      sendMessageStream: async function* (params, options) {
        sent.push(params);
        for (const event of script[sent.length - 1] ?? []) {
          options?.signal?.throwIfAborted();
          yield event;
        }
      },
      cancelTask: (params) => {
        cancelled.push(params.id);
        return Promise.resolve({} as never);
      }
    } as Awaited<ReturnType<ConnectAgent>>);
  };
  return { connect, sent, cancelled, connected };
}

async function collect(events: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const collected: TurnEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

const conversation = (signal = new AbortController().signal) => ({ threadId: 'thread-1', signal });

describe('weather-agent.client', () => {
  describe('readWeatherEvent', () => {
    it('reads working updates as progress, and leaves out the task and the artifact', () => {
      expect(readWeatherEvent(status('t1', TaskState.TASK_STATE_WORKING, 'Calling find_city'), '')).toEqual({
        type: 'progress',
        text: 'Calling find_city'
      });
      expect(readWeatherEvent(task('t1'), '')).toBeUndefined();
      expect(readWeatherEvent(artifact('t1', 'Sunny.'), '')).toBeUndefined();
    });

    it.each([
      [
        'completed, with the artifact text',
        status('t1', TaskState.TASK_STATE_COMPLETED),
        'Sunny.',
        { ok: true, outcome: 'completed', text: 'Sunny.' }
      ],
      [
        'input-required, with its question',
        status('t1', TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?'),
        '',
        { ok: true, outcome: 'input-required', text: 'Which Springfield?' }
      ],
      [
        'failed, with its error',
        status('t1', TaskState.TASK_STATE_FAILED, 'Agent error: rate limited'),
        '',
        { ok: false, error: 'Agent error: rate limited' }
      ]
    ])('ends on %s', (_case, event, answer, result) => {
      expect(readWeatherEvent(event, answer)).toEqual({ type: 'result', ...result });
    });
  });

  describe('weatherAgentClient', () => {
    it('connects on the first question, sends it, and streams the progress and the answer', async () => {
      const agent = fakeAgent([
        [
          task('t1'),
          status('t1', TaskState.TASK_STATE_WORKING, 'Calling find_city'),
          artifact('t1', 'Sunny.'),
          status('t1', TaskState.TASK_STATE_COMPLETED)
        ]
      ]);
      const client = weatherAgentClient('http://localhost:41241/agents/weather/', agent.connect);

      expect(agent.connected).toEqual([]);
      const events = await collect(client.ask('Lisbon this weekend?', conversation()));

      expect(client.name).toBe('Weather Agent');
      expect(agent.connected).toEqual(['http://localhost:41241/agents/weather/']);
      expect(agent.sent[0]?.message).toMatchObject({ contextId: '', taskId: '', parts: [{ content: { value: 'Lisbon this weekend?' } }] });
      expect(events).toEqual([
        { type: 'progress', text: 'Calling find_city' },
        { type: 'result', ok: true, outcome: 'completed', text: 'Sunny.' }
      ]);
    });

    it("continues the task that waits for an answer, then asks the next question in the thread's context", async () => {
      const agent = fakeAgent([
        [task('t1'), status('t1', TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?')],
        [task('t1'), artifact('t1', 'Cold.'), status('t1', TaskState.TASK_STATE_COMPLETED)],
        [task('t2'), artifact('t2', 'Warmer.'), status('t2', TaskState.TASK_STATE_COMPLETED)]
      ]);
      const client = weatherAgentClient('http://weather/', agent.connect);

      await collect(client.ask('Springfield on Monday?', conversation()));
      await collect(client.ask('Springfield, Illinois', conversation()));
      await collect(client.ask('And on Tuesday?', conversation()));

      expect(agent.sent.map(({ message }) => [message?.contextId, message?.taskId])).toEqual([
        ['', ''],
        [contextId, 't1'],
        [contextId, '']
      ]);
    });

    it('keeps each Codex thread in a conversation of its own', async () => {
      const agent = fakeAgent([
        [task('t1'), status('t1', TaskState.TASK_STATE_COMPLETED)],
        [task('t2'), status('t2', TaskState.TASK_STATE_COMPLETED)]
      ]);
      const client = weatherAgentClient('http://weather/', agent.connect);

      await collect(client.ask('Lisbon?', conversation()));
      await collect(client.ask('Rome?', { threadId: 'thread-2', signal: new AbortController().signal }));

      expect(agent.sent[1]?.message?.contextId).toBe('');
    });

    it("cancels the weather agent's task when the question is aborted", async () => {
      const abortController = new AbortController();
      const agent = fakeAgent([
        [task('t1'), status('t1', TaskState.TASK_STATE_WORKING, 'Calling find_city'), status('t1', TaskState.TASK_STATE_COMPLETED)]
      ]);
      const client = weatherAgentClient('http://weather/', agent.connect);

      const asking = (async () => {
        for await (const event of client.ask('Lisbon?', conversation(abortController.signal))) {
          if (event.type === 'progress') {
            abortController.abort();
          }
        }
      })();

      await expect(asking).rejects.toThrow();
      expect(agent.cancelled).toEqual(['t1']);
    });
  });
});
