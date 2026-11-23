import { HarnessRegistry, UnknownHarnessError } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { describe, expect, it } from 'vitest';
import { AgentRegistry } from '../../../src/registries/agent.registry.ts';
import { agentDefinition } from '../../utils/agent-definition-seed.ts';

function registryWithFakeHarness(): AgentRegistry {
  const harnesses = new HarnessRegistry();
  harnesses.register(new FakeHarness('fake', []));
  return new AgentRegistry(harnesses);
}

describe('AgentRegistry', () => {
  it('returns a registered agent by id and lists agents in registration order', () => {
    const registry = registryWithFakeHarness();
    const first = agentDefinition({ id: 'claude-coder' });
    const second = agentDefinition({ id: 'codex-coder' });

    registry.register(first);
    registry.register(second);

    expect(registry.get('codex-coder')).toBe(second);
    expect(registry.list()).toEqual([first, second]);
  });

  it('rejects a second agent under an id already taken', () => {
    const registry = registryWithFakeHarness();
    registry.register(agentDefinition());

    expect(() => {
      registry.register(agentDefinition());
    }).toThrow(expect.objectContaining({ name: 'AgentRegistryError', reason: 'duplicate-id', agentId: 'claude-coder' }));
  });

  it('rejects an agent whose harness is not registered', () => {
    const registry = registryWithFakeHarness();

    expect(() => {
      registry.register(agentDefinition({ harness: 'missing' }));
    }).toThrow(UnknownHarnessError);
    expect(registry.list()).toEqual([]);
  });

  it.each(['Claude-Coder', 'claude coder', 'claude--coder', '-claude', 'claude/coder', ''])('rejects the id %j as not URL-safe', (id) => {
    const registry = registryWithFakeHarness();

    expect(() => {
      registry.register(agentDefinition({ id }));
    }).toThrow(expect.objectContaining({ name: 'AgentRegistryError', reason: 'invalid-id', agentId: id }));
  });

  it('throws an unknown-id error for an id that is not registered', () => {
    expect(() => registryWithFakeHarness().get('missing')).toThrow(
      expect.objectContaining({ name: 'AgentRegistryError', reason: 'unknown-id', message: 'No agent is registered as "missing"' })
    );
  });
});
