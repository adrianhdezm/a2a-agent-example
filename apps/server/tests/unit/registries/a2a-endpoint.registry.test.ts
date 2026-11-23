import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { Role } from '@a2a-js/sdk';
import type { SendMessageRequest, Task } from '@a2a-js/sdk';
import { ServerCallContext } from '@a2a-js/sdk/server';
import { describe, expect, it } from 'vitest';
import { A2AEndpointRegistry } from '../../../src/registries/a2a-endpoint.registry.ts';
import { agent } from '../../utils/agent-seed.ts';

function setup() {
  const harness = new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'completed', finalText: 'Done' }]);
  const harnessRegistry = new HarnessRegistry();
  harnessRegistry.register(harness);
  return { harness, registry: new A2AEndpointRegistry({ harnessRegistry, baseUrl: 'http://localhost:4000' }) };
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

describe('A2AEndpointRegistry', () => {
  it("opens an agent's endpoints with its card", async () => {
    const { registry } = setup();

    const endpoints = registry.open(agent());

    expect(registry.get('claude-coder')).toBe(endpoints);
    expect(await endpoints.requestHandler.getAgentCard()).toMatchObject({ name: 'Claude Coder' });
  });

  it('closes them, after which the agent has none', () => {
    const { registry } = setup();
    registry.open(agent());

    registry.close('claude-coder');

    expect(registry.get('claude-coder')).toBeUndefined();
  });

  it('reopens them with the changed agent, keeping its conversations', async () => {
    // Arrange
    const { harness, registry } = setup();
    const first = (await registry.open(agent()).requestHandler.sendMessage(message('Write hello.py'), new ServerCallContext())) as Task;

    // Act
    const reopened = registry.open(agent({ name: 'Claude Tester', instructions: 'Write tests first.' }));
    await reopened.requestHandler.sendMessage(message('Now add a test', first.contextId), new ServerCallContext());

    // Assert
    expect(await reopened.requestHandler.getAgentCard()).toMatchObject({ name: 'Claude Tester' });
    expect(harness.resumed).toEqual([
      { id: 'fake-session-1', config: expect.objectContaining({ instructions: 'Write tests first.' }) as unknown }
    ]);
  });
});
