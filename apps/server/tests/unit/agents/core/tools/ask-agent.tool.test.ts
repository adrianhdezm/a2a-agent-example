import { TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { runTool } from '../../../../../src/agents/core/helpers/tool.helper.ts';
import { askAgentTool } from '../../../../../src/agents/core/tools/ask-agent.tool.ts';
import type { ConnectAgent } from '../../../../../src/agents/core/tools/ask-agent.tool.ts';

const contextId = 'weather-ctx';

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

/** An A2A agent whose n-th message streams `script[n]`; it records what it was sent, what was cancelled, and connections. */
function fakeAgent(script: StreamResponse[][]) {
  const sent: SendMessageRequest[] = [];
  const cancelled: string[] = [];
  const connected: string[] = [];
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

function weatherTool(connect: ConnectAgent) {
  return askAgentTool({ name: 'ask_weather_agent', agentName: 'Weather Agent', knows: 'the weather', url: 'http://weather/', connect });
}

const inContext = (id = 'trip-1', signal = new AbortController().signal) => ({ contextId: id, signal });

describe('ask-agent.tool', () => {
  it('names itself and says what the other agent knows', () => {
    const tool = weatherTool(fakeAgent([]).connect);

    expect(tool.name).toBe('ask_weather_agent');
    expect(tool.description).toBe('Asks the Weather Agent, another agent, one question in plain words. It knows the weather.');
  });

  it("connects on the first question, sends it, and answers with the other agent's artifact", async () => {
    const agent = fakeAgent([
      [
        task('t1'),
        status('t1', TaskState.TASK_STATE_WORKING, 'Calling find_city'),
        artifact('t1', 'Sunny.'),
        status('t1', TaskState.TASK_STATE_COMPLETED)
      ]
    ]);
    const tool = weatherTool(agent.connect);

    expect(agent.connected).toEqual([]);
    const result = await runTool(tool, { question: 'Lisbon this weekend?' }, inContext());

    expect(agent.connected).toEqual(['http://weather/']);
    expect(agent.sent[0]?.message).toMatchObject({ contextId: '', taskId: '', parts: [{ content: { value: 'Lisbon this weekend?' } }] });
    expect(result).toEqual({ text: 'Sunny.', isError: false });
  });

  it("hands back the other agent's question, with how to answer it", async () => {
    const agent = fakeAgent([[task('t1'), status('t1', TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?')]]);

    const result = await runTool(weatherTool(agent.connect), { question: 'Springfield on Monday?' }, inContext());

    expect(result.text).toBe(
      'The Weather Agent asks: Which Springfield?\nIf you cannot answer from what you know, ask the user, then call ask_weather_agent again with their answer.'
    );
  });

  it('reports a failed task as a tool error', async () => {
    const agent = fakeAgent([[task('t1'), status('t1', TaskState.TASK_STATE_FAILED, 'Agent error: rate limited')]]);

    expect(await runTool(weatherTool(agent.connect), { question: 'Lisbon?' }, inContext())).toEqual({
      text: 'The Weather Agent could not answer: Agent error: rate limited',
      isError: true
    });
  });

  it('continues the task that waits for an answer, then asks the next question in the same context', async () => {
    const agent = fakeAgent([
      [task('t1'), status('t1', TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?')],
      [task('t1'), artifact('t1', 'Cold.'), status('t1', TaskState.TASK_STATE_COMPLETED)],
      [task('t2'), artifact('t2', 'Warmer.'), status('t2', TaskState.TASK_STATE_COMPLETED)]
    ]);
    const tool = weatherTool(agent.connect);

    await runTool(tool, { question: 'Springfield on Monday?' }, inContext());
    await runTool(tool, { question: 'Springfield, Illinois' }, inContext());
    await runTool(tool, { question: 'And on Tuesday?' }, inContext());

    expect(agent.sent.map(({ message }) => [message?.contextId, message?.taskId])).toEqual([
      ['', ''],
      [contextId, 't1'],
      [contextId, '']
    ]);
  });

  it('keeps each A2A context in a conversation of its own', async () => {
    const agent = fakeAgent([
      [task('t1'), status('t1', TaskState.TASK_STATE_COMPLETED)],
      [task('t2'), status('t2', TaskState.TASK_STATE_COMPLETED)]
    ]);
    const tool = weatherTool(agent.connect);

    await runTool(tool, { question: 'Lisbon?' }, inContext('trip-1'));
    await runTool(tool, { question: 'Rome?' }, inContext('trip-2'));

    expect(agent.sent[1]?.message?.contextId).toBe('');
  });

  it("cancels the other agent's task when the turn is aborted", async () => {
    const abortController = new AbortController();
    const agent = fakeAgent([
      [task('t1'), status('t1', TaskState.TASK_STATE_WORKING, 'Calling find_city'), status('t1', TaskState.TASK_STATE_COMPLETED)]
    ]);
    const connect: ConnectAgent = async (url) => {
      const client = await agent.connect(url);
      return {
        ...client,
        sendMessageStream: async function* (params, options) {
          for await (const event of client.sendMessageStream(params, options)) {
            yield event;
            abortController.abort();
          }
        }
      };
    };

    await expect(runTool(weatherTool(connect), { question: 'Lisbon?' }, inContext('trip-1', abortController.signal))).rejects.toThrow();
    expect(agent.cancelled).toEqual(['t1']);
  });
});
