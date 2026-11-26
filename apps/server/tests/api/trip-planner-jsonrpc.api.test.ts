import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, Task } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import { afterEach, describe, expect, it } from 'vitest';
import { forecastCall, init, sessionId, structuredResult } from '../fixtures/claude-messages.ts';
import { run, threadId } from '../fixtures/codex-events.ts';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

// The weather agent's Claude turns: a forecast, or its question back.
const forecast = [init, forecastCall, structuredResult({ outcome: 'completed', text: 'Sunny, 18 to 24 °C.' })];
const whichSpringfield = [init, structuredResult({ outcome: 'input-required', text: 'Which Springfield?' })];

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
  return new ClientFactory().createFromUrl(`${app.baseUrl}/agents/trip-planner/`);
}

describe('POST /agents/trip-planner/a2a/jsonrpc', () => {
  let app: TestApp | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('consults the weather agent over A2A, then answers with the forecast in a trip-plan artifact', async () => {
    app = await serveTestApp(
      [forecast],
      [
        run({ outcome: 'consult', text: 'Lisbon this weekend?' }),
        run({ outcome: 'completed', text: 'Pack sunscreen and a light jacket.' }, false)
      ]
    );

    const task = (await (await clientFor(app)).sendMessage(message('What should I pack for Lisbon this weekend?'))) as Task;

    expect(task.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    expect(task.artifacts[0]).toMatchObject({ name: 'trip-plan', parts: [{ content: { value: 'Pack sunscreen and a light jacket.' } }] });
    expect(app.turns.map(({ prompt }) => prompt)).toEqual(['Lisbon this weekend?']);
    expect(app.codexRuns.map(({ input }) => input)).toEqual([
      'What should I pack for Lisbon this weekend?',
      'The Weather Agent answered:\nSunny, 18 to 24 °C.'
    ]);
  });

  it("streams the weather agent's progress as its own", async () => {
    app = await serveTestApp(
      [forecast],
      [run({ outcome: 'consult', text: 'Lisbon this weekend?' }), run({ outcome: 'completed', text: 'Pack light.' }, false)]
    );
    const progress: string[] = [];

    for await (const event of (await clientFor(app)).sendMessageStream(message('Packing for Lisbon?'))) {
      if (event.payload?.$case === 'statusUpdate' && event.payload.value.status?.state === TaskState.TASK_STATE_WORKING) {
        const part = event.payload.value.status.message?.parts[0]?.content;
        progress.push(part?.$case === 'text' ? part.value : '');
      }
    }

    expect(progress).toEqual([
      'Looking into it…',
      '**Checking the forecast for Lisbon**',
      'Asking the Weather Agent: Lisbon this weekend?',
      'Weather Agent: Looking into it…',
      'Weather Agent: Calling get_forecast {"latitude":38.72,"longitude":-9.13,"days":2}',
      '**Checking the forecast for Lisbon**'
    ]);
  });

  it("asks the user the weather agent's question, and continues the weather agent's task with the answer", async () => {
    // Arrange
    app = await serveTestApp(
      [whichSpringfield, forecast],
      [
        run({ outcome: 'consult', text: 'Springfield on Monday?' }),
        run({ outcome: 'input-required', text: 'Which Springfield are you going to?' }, false),
        run({ outcome: 'consult', text: 'Springfield, Illinois' }, false),
        run({ outcome: 'completed', text: 'Pack a warm coat.' }, false)
      ]
    );
    const client = await clientFor(app);

    // Act
    const asked = (await client.sendMessage(message("I'm in Springfield on Monday, what do I wear?"))) as Task;
    const answered = (await client.sendMessage(message('Illinois', { contextId: asked.contextId, taskId: asked.id }))) as Task;

    // Assert
    expect(asked.status).toMatchObject({
      state: TaskState.TASK_STATE_INPUT_REQUIRED,
      message: { parts: [{ content: { value: 'Which Springfield are you going to?' } }] }
    });
    expect(answered).toMatchObject({ id: asked.id, status: { state: TaskState.TASK_STATE_COMPLETED } });
    expect(app.codexRuns.map(({ input, resumed }) => [input, resumed])).toEqual([
      ["I'm in Springfield on Monday, what do I wear?", undefined],
      ['The Weather Agent asks you:\nWhich Springfield?', undefined],
      ['Illinois', threadId],
      ['The Weather Agent answered:\nSunny, 18 to 24 °C.', threadId]
    ]);
    // The weather agent got the answer in the task it asked in, so its Claude session resumed.
    expect(app.turns.map(({ prompt, sessionId: resumed }) => [prompt, resumed])).toEqual([
      ['Springfield on Monday?', undefined],
      ['Springfield, Illinois', sessionId]
    ]);
  });
});
