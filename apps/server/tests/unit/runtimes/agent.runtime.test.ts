import { HarnessRegistry } from '@a2a-agent-example/harness';
import { FakeHarness } from '@a2a-agent-example/harness/testing';
import { Role } from '@a2a-js/sdk';
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

describe('AgentRuntime', () => {
  it("serves the agent's card at the server's own JSON-RPC path for it", async () => {
    const { runtime } = setup();

    const card = await runtime.open(agent()).requestHandler.getAgentCard();

    expect(card).toMatchObject({ name: 'Claude Coder', skills: [expect.objectContaining({ id: 'write-code' })] });
    expect(card.supportedInterfaces[0]?.url).toBe('http://localhost:4000/agents/claude-coder/a2a/jsonrpc');
  });

  it("runs the agent's turns in its workspace with its instructions", async () => {
    // Arrange
    const { harness, runtime } = setup();
    const endpoints = runtime.open(agent({ model: 'claude-sonnet-5-5' }));
    const text = {
      content: { $case: 'text' as const, value: 'Write hello.py' },
      metadata: undefined,
      filename: '',
      mediaType: 'text/plain'
    };
    const message = {
      messageId: 'm-1',
      contextId: '',
      taskId: '',
      role: Role.ROLE_USER,
      parts: [text],
      metadata: undefined,
      extensions: [],
      referenceTaskIds: []
    };

    // Act
    await endpoints.requestHandler.sendMessage(
      { tenant: '', message, configuration: undefined, metadata: undefined },
      new ServerCallContext()
    );

    // Assert
    expect(harness.started).toEqual([
      { workspace: '/srv/workspaces/claude-coder', instructions: 'You write small programs.', model: 'claude-sonnet-5-5' }
    ]);
  });

  it('closes an agent, after which it has no endpoints', () => {
    const { runtime } = setup();
    runtime.open(agent());

    runtime.close('claude-coder');

    expect(runtime.get('claude-coder')).toBeUndefined();
  });
});
