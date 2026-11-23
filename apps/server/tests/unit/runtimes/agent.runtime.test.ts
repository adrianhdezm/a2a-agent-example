import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { Role } from '@a2a-js/sdk';
import type { SendMessageRequest, Task } from '@a2a-js/sdk';
import { ServerCallContext } from '@a2a-js/sdk/server';
import { describe, expect, it } from 'vitest';
import { AgentRuntime } from '../../../src/runtimes/agent.runtime.ts';
import { agent } from '../../utils/agent-seed.ts';

function setup() {
  const harness = new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'completed', finalText: 'Done' }]);
  const harnessRegistry = new HarnessRegistry();
  harnessRegistry.register(harness);
  return { harness, runtime: new AgentRuntime({ harnessRegistry, baseUrl: 'http://localhost:4000' }) };
}

function message(text: string, contextId = ''): SendMessageRequest {
  return {
    tenant: '',
    message: {
      messageId: crypto.randomUUID(),
      contextId,
      taskId: '',
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

describe('AgentRuntime', () => {
  it("opens an agent's endpoints with its card", async () => {
    const { runtime } = setup();

    const endpoints = runtime.open(agent());

    expect(runtime.get('claude-coder')).toBe(endpoints);
    expect(await endpoints.requestHandler.getAgentCard()).toMatchObject({ name: 'Claude Coder' });
  });

  it('closes them, after which the agent has none', () => {
    const { runtime } = setup();
    runtime.open(agent());

    runtime.close('claude-coder');

    expect(runtime.get('claude-coder')).toBeUndefined();
  });

  it('reopens them with the changed agent, keeping its conversations', async () => {
    // Arrange
    const { harness, runtime } = setup();
    const first = (await runtime.open(agent()).requestHandler.sendMessage(message('Write hello.py'), new ServerCallContext())) as Task;

    // Act
    const reopened = runtime.open(agent({ name: 'Claude Tester', instructions: 'Write tests first.' }));
    await reopened.requestHandler.sendMessage(message('Now add a test', first.contextId), new ServerCallContext());

    // Assert
    expect(await reopened.requestHandler.getAgentCard()).toMatchObject({ name: 'Claude Tester' });
    expect(harness.resumed).toEqual([
      { id: 'fake-session-1', config: expect.objectContaining({ instructions: 'Write tests first.' }) as unknown }
    ]);
  });
});
