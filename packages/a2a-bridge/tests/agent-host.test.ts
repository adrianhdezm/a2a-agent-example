import { FakeHarness } from '@a2a-agent-example/harness/testing';
import { Role } from '@a2a-js/sdk';
import type { SendMessageRequest, Task } from '@a2a-js/sdk';
import { ServerCallContext } from '@a2a-js/sdk/server';
import { describe, expect, it } from 'vitest';
import { buildAgentCard } from '../src/agent-card.ts';
import { AgentHost } from '../src/agent-host.ts';
import type { HostedAgent } from '../src/agent-host.ts';

function hostedAgent(harness: FakeHarness, name: string, instructions: string): HostedAgent {
  return {
    card: buildAgentCard({ name, description: 'Writes code.', skills: [], url: 'http://localhost:4000/agents/claude-coder/a2a/jsonrpc' }),
    harness,
    sessionConfig: { workspace: '/srv/workspaces/claude-coder', instructions }
  };
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

const done = new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'completed', finalText: 'Done' }]);

describe('AgentHost', () => {
  it('opens an agent behind a request handler that serves its card and runs its turns', async () => {
    const host = new AgentHost();

    const requestHandler = host.open('claude-coder', hostedAgent(done, 'Claude Coder', 'You write small programs.'));
    const task = (await requestHandler.sendMessage(message('Write hello.py'), new ServerCallContext())) as Task;

    expect(host.get('claude-coder')).toBe(requestHandler);
    expect(await requestHandler.getAgentCard()).toMatchObject({ name: 'Claude Coder' });
    expect(task.artifacts[0]?.parts[0]?.content).toEqual({ $case: 'text', value: 'Done' });
  });

  it('closes an agent, after which it has no request handler', () => {
    const host = new AgentHost();
    host.open('claude-coder', hostedAgent(done, 'Claude Coder', 'You write small programs.'));

    host.close('claude-coder');

    expect(host.get('claude-coder')).toBeUndefined();
  });

  it('reopens a changed agent, keeping its conversations', async () => {
    // Arrange
    const harness = new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'completed', finalText: 'Done' }]);
    const host = new AgentHost();
    const first = host.open('claude-coder', hostedAgent(harness, 'Claude Coder', 'You write small programs.'));
    const task = (await first.sendMessage(message('Write hello.py'), new ServerCallContext())) as Task;

    // Act
    const reopened = host.open('claude-coder', hostedAgent(harness, 'Claude Tester', 'Write tests first.'));
    await reopened.sendMessage(message('Now add a test', task.contextId), new ServerCallContext());

    // Assert
    expect(await reopened.getAgentCard()).toMatchObject({ name: 'Claude Tester' });
    expect(harness.resumed).toEqual([
      { id: 'fake-session-1', config: expect.objectContaining({ instructions: 'Write tests first.' }) as unknown }
    ]);
  });
});
