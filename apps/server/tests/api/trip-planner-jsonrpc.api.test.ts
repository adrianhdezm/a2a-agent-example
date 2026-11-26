import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, Task } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import { fauxAssistantMessage, fauxToolCall } from '@mariozechner/pi-ai';
import type { AssistantMessage, Context } from '@mariozechner/pi-ai';
import { afterEach, describe, expect, it } from 'vitest';
import { forecastCall, init, sessionId, structuredResult } from '../fixtures/claude-messages.ts';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

// The weather agent's Claude turns: a forecast, or its question back.
const forecast = [init, forecastCall, structuredResult({ outcome: 'completed', text: 'Sunny, 18 to 24 °C.' })];
const whichSpringfield = [init, structuredResult({ outcome: 'input-required', text: 'Which Springfield?' })];

// The trip planner's model calls, on Pi: asking the weather agent, and answering.
function askWeather(question: string): AssistantMessage {
  return fauxAssistantMessage(fauxToolCall('ask_weather_agent', { question }), { stopReason: 'toolUse' });
}

function answer(outcome: 'completed' | 'input-required', text: string): AssistantMessage {
  return fauxAssistantMessage(fauxToolCall('answer', { outcome, text }), { stopReason: 'toolUse' });
}

/** What the last tool call of a model call's context gave back. */
function lastToolResult(context: Context | undefined): string {
  const last = context?.messages.at(-1);
  return last?.role === 'toolResult' && last.content[0]?.type === 'text' ? last.content[0].text : '';
}

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

  it('asks the weather agent over A2A through its tool, then answers in a trip-plan artifact', async () => {
    app = await serveTestApp([forecast], [askWeather('Lisbon this weekend?'), answer('completed', 'Pack sunscreen and a light jacket.')]);

    const task = (await (await clientFor(app)).sendMessage(message('What should I pack for Lisbon this weekend?'))) as Task;

    expect(task.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    expect(task.artifacts[0]).toMatchObject({ name: 'trip-plan', parts: [{ content: { value: 'Pack sunscreen and a light jacket.' } }] });
    expect(app.turns.map(({ prompt }) => prompt)).toEqual(['Lisbon this weekend?']);
    expect(lastToolResult(app.tripCalls[1])).toBe('Sunny, 18 to 24 °C.');
  });

  it('streams its call to the weather agent as progress', async () => {
    app = await serveTestApp([forecast], [askWeather('Lisbon this weekend?'), answer('completed', 'Pack light.')]);
    const progress: string[] = [];

    for await (const event of (await clientFor(app)).sendMessageStream(message('Packing for Lisbon?'))) {
      if (event.payload?.$case === 'statusUpdate' && event.payload.value.status?.state === TaskState.TASK_STATE_WORKING) {
        const part = event.payload.value.status.message?.parts[0]?.content;
        progress.push(part?.$case === 'text' ? part.value : '');
      }
    }

    expect(progress).toEqual(['Looking into it…', 'Calling ask_weather_agent {"question":"Lisbon this weekend?"}']);
  });

  it("asks the user the weather agent's question, and continues the weather agent's task with the answer", async () => {
    // Arrange
    app = await serveTestApp(
      [whichSpringfield, forecast],
      [
        askWeather('Springfield on Monday?'),
        answer('input-required', 'Which Springfield are you going to?'),
        askWeather('Springfield, Illinois'),
        answer('completed', 'Pack a warm coat.')
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
    expect(lastToolResult(app.tripCalls[1])).toMatch(/^The Weather Agent asks: Which Springfield\?/);
    expect(answered).toMatchObject({ id: asked.id, status: { state: TaskState.TASK_STATE_COMPLETED } });
    // The trip planner's second turn carried on its Pi transcript, and the weather agent got the answer in the task
    // it asked in, so its Claude session resumed.
    expect(app.tripCalls[2]?.messages.length).toBeGreaterThan(4);
    expect(app.turns.map(({ prompt, sessionId: resumed }) => [prompt, resumed])).toEqual([
      ['Springfield on Monday?', undefined],
      ['Springfield, Illinois', sessionId]
    ]);
  });
});
