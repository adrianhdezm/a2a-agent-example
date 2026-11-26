import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse, Task } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import { afterEach, describe, expect, it } from 'vitest';
import { forecastCall, init, sessionId, structuredResult } from '../fixtures/claude-messages.ts';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

// What the Claude Agent SDK streams for each turn: the session, any tool call, and the structured answer.
const answer = [init, forecastCall, structuredResult({ outcome: 'completed', text: 'Take an umbrella tomorrow.' })];
const question = [init, structuredResult({ outcome: 'input-required', text: 'Which Springfield?' })];

function message(text: string, taskRef: { contextId?: string; taskId?: string } = {}): SendMessageRequest {
  return {
    tenant: '',
    message: {
      messageId: crypto.randomUUID(),
      contextId: taskRef.contextId ?? '',
      taskId: taskRef.taskId ?? '',
      role: Role.ROLE_USER,
      parts: [{ content: { $case: 'text', value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' }],
      metadata: undefined,
      extensions: [],
      referenceTaskIds: []
    },
    configuration: undefined,
    metadata: undefined
  };
}

async function clientFor(app: TestApp) {
  return new ClientFactory().createFromUrl(`${app.baseUrl}/agents/weather/`);
}

describe('POST /agents/weather/a2a/jsonrpc', () => {
  let app: TestApp | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('answers SendMessage with a completed task holding the forecast artifact', async () => {
    app = await serveTestApp([answer]);

    const task = (await (await clientFor(app)).sendMessage(message('Umbrella in Lisbon tomorrow?'))) as Task;

    expect(task.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    expect(task.artifacts[0]).toMatchObject({
      name: 'forecast',
      parts: [{ content: { $case: 'text', value: 'Take an umbrella tomorrow.' } }]
    });
    expect(app.turns[0]?.allowedTools).toEqual(['mcp__weather__find_city', 'mcp__weather__get_forecast']);
  });

  it('streams the task, the progress, the artifact and the final state', async () => {
    app = await serveTestApp([answer]);
    const seen: string[] = [];

    for await (const event of (await clientFor(app)).sendMessageStream(message('Umbrella in Lisbon tomorrow?'))) {
      seen.push(step(event));
    }

    expect(seen).toEqual(['task', 'WORKING', 'WORKING', 'artifact forecast', 'COMPLETED']);
  });

  it('asks back with input-required, and continues the same task and session with the answer', async () => {
    // Arrange
    app = await serveTestApp([question, answer]);
    const client = await clientFor(app);

    // Act
    const asked = (await client.sendMessage(message('Springfield this weekend?'))) as Task;
    const answered = (await client.sendMessage(message('Illinois', { contextId: asked.contextId, taskId: asked.id }))) as Task;

    // Assert
    expect(asked.status?.state).toBe(TaskState.TASK_STATE_INPUT_REQUIRED);
    expect(answered).toMatchObject({ id: asked.id, contextId: asked.contextId, status: { state: TaskState.TASK_STATE_COMPLETED } });
    expect(app.turns.map(({ prompt, sessionId }) => [prompt, sessionId])).toEqual([
      ['Springfield this weekend?', undefined],
      ['Illinois', sessionId]
    ]);
  });

  it('answers malformed JSON with a JSON-RPC parse error, not the server error shape', async () => {
    app = await serveTestApp([answer]);

    const response = await fetch(`${app.baseUrl}/agents/weather/a2a/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'A2A-Version': '1.0' },
      body: '{"jsonrpc": "2.0", "method":'
    });

    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 } });
  });
});

function stateOf(event: StreamResponse): string {
  const state = event.payload?.$case === 'statusUpdate' ? event.payload.value.status?.state : undefined;
  return TaskState[state ?? TaskState.TASK_STATE_UNSPECIFIED].replace('TASK_STATE_', '');
}

/** One streamed event as its kind: the task, a state, or an artifact by name. */
function step(event: StreamResponse): string {
  switch (event.payload?.$case) {
    case 'statusUpdate':
      return stateOf(event);
    case 'artifactUpdate':
      return `artifact ${event.payload.value.artifact?.name ?? ''}`;
    default:
      return event.payload?.$case ?? 'none';
  }
}
