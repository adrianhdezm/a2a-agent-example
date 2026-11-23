import { Role, TaskState } from '@a2a-js/sdk';
import type { Task } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestServer } from '../utils/test-server.ts';

function userMessage(text: string) {
  return {
    tenant: '',
    message: {
      messageId: crypto.randomUUID(),
      contextId: '',
      taskId: '',
      role: Role.ROLE_USER,
      parts: [{ content: { $case: 'text' as const, value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' }],
      metadata: undefined,
      extensions: [],
      referenceTaskIds: []
    },
    configuration: undefined,
    metadata: undefined
  };
}

describe('POST /agents/:id/a2a/jsonrpc', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await serveTestApp([
      { type: 'agent.message', text: 'Writing hello.py' },
      { type: 'turn.ended', outcome: 'completed', finalText: 'Created hello.py' }
    ]);
  });

  afterAll(async () => {
    await server.close();
  });

  it('answers SendMessage with a completed task carrying the result artifact', async () => {
    // Arrange
    const client = await new ClientFactory().createFromUrl(`${server.baseUrl}/agents/first-coder/.well-known/agent-card.json`, '');

    // Act
    const task = (await client.sendMessage(userMessage('Write hello.py'))) as Task;

    // Assert
    expect(task.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    expect(task.artifacts).toEqual([
      expect.objectContaining({
        name: 'result',
        parts: [expect.objectContaining({ content: { $case: 'text', value: 'Created hello.py' } })]
      })
    ]);
  });

  it('keeps the A2A context of a task for the next message', async () => {
    const client = await new ClientFactory().createFromUrl(`${server.baseUrl}/agents/first-coder/.well-known/agent-card.json`, '');
    const first = (await client.sendMessage(userMessage('Write hello.py'))) as Task;

    const followUp = userMessage('Now add a test');
    followUp.message.contextId = first.contextId;
    const second = (await client.sendMessage(followUp)) as Task;

    expect(second.contextId).toBe(first.contextId);
    expect(second.id).not.toBe(first.id);
  });

  it('answers malformed JSON with a JSON-RPC parse error, not the server error shape', async () => {
    const response = await fetch(`${server.baseUrl}/agents/first-coder/a2a/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'A2A-Version': '1.0' },
      body: '{"jsonrpc": "2.0", "method":'
    });

    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 } });
  });
});
