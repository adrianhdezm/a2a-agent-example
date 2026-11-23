import { AgentRegistry } from '@a2a-agent-example/agent-registry';
import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { Role, TaskState } from '@a2a-js/sdk';
import type { AgentCard, Task } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { fakeAgent } from './utils/agent-definition-seed.ts';
import { listen } from './utils/test-server.ts';
import type { TestServer } from './utils/test-server.ts';

describe('createApp', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await listen();
    const harnesses = new HarnessRegistry();
    harnesses.register(new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'completed', finalText: 'Created hello.py' }]));
    const agents = new AgentRegistry(harnesses);
    agents.register(fakeAgent({ id: 'first-coder' }));
    agents.register(fakeAgent({ id: 'second-coder' }));
    server.serve(createApp({ agents, harnesses, baseUrl: server.baseUrl }));
  });

  afterAll(async () => {
    await server.close();
  });

  it('lists the registered agents with the URL of each card', async () => {
    const response = await fetch(`${server.baseUrl}/agents`);

    expect(await response.json()).toEqual([
      expect.objectContaining({
        id: 'first-coder',
        harness: 'fake',
        cardUrl: `${server.baseUrl}/agents/first-coder/.well-known/agent-card.json`
      }),
      expect.objectContaining({
        id: 'second-coder',
        harness: 'fake',
        cardUrl: `${server.baseUrl}/agents/second-coder/.well-known/agent-card.json`
      })
    ]);
  });

  it("serves each agent's own card, pointing at its own JSON-RPC endpoint", async () => {
    const response = await fetch(`${server.baseUrl}/agents/second-coder/.well-known/agent-card.json`);
    const card = (await response.json()) as AgentCard;

    expect(card.supportedInterfaces[0]?.url).toBe(`${server.baseUrl}/agents/second-coder/a2a/jsonrpc`);
  });

  it('completes a task with the result artifact for a message sent over JSON-RPC', async () => {
    // Arrange
    const client = await new ClientFactory().createFromUrl(`${server.baseUrl}/agents/first-coder/.well-known/agent-card.json`, '');

    // Act
    const result = await client.sendMessage({
      tenant: '',
      message: {
        messageId: 'message-1',
        contextId: '',
        taskId: '',
        role: Role.ROLE_USER,
        parts: [{ content: { $case: 'text', value: 'Write hello.py' }, metadata: undefined, filename: '', mediaType: 'text/plain' }],
        metadata: undefined,
        extensions: [],
        referenceTaskIds: []
      },
      configuration: undefined,
      metadata: undefined
    });

    // Assert
    const task = result as Task;
    expect(task.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    expect(task.artifacts[0]?.parts[0]?.content).toEqual({ $case: 'text', value: 'Created hello.py' });
  });
});
