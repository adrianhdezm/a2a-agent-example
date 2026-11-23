import { AgentRegistry } from '@a2a-agent-example/agent-registry';
import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { describe, expect, it } from 'vitest';
import { registerStarterAgents } from '../src/agents.ts';

describe('registerStarterAgents', () => {
  it('registers claude-coder on claude and codex-coder on codex, each in its own workspace', () => {
    // Arrange
    const harnesses = new HarnessRegistry();
    harnesses.register(new FakeHarness('claude', []));
    harnesses.register(new FakeHarness('codex', []));
    const agents = new AgentRegistry(harnesses);

    // Act
    registerStarterAgents(agents, '/srv/workspaces');

    // Assert
    expect(agents.list().map(({ id, harness, workspace }) => ({ id, harness, workspace }))).toEqual([
      { id: 'claude-coder', harness: 'claude', workspace: '/srv/workspaces/claude-coder' },
      { id: 'codex-coder', harness: 'codex', workspace: '/srv/workspaces/codex-coder' }
    ]);
  });
});
