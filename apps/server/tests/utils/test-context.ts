import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import type { AppContext } from '../../src/models/app-context.model.ts';
import { AgentRegistry } from '../../src/registries/agent.registry.ts';
import { agentDefinition } from './agent-definition-seed.ts';

/** A context with two agents, `first-coder` and `second-coder`, on a `fake` harness that answers with `events`. */
export function testContext(baseUrl: string, events: HarnessEvent[] = []): AppContext {
  const harnessRegistry = new HarnessRegistry();
  harnessRegistry.register(new FakeHarness('fake', events));
  const agentRegistry = new AgentRegistry(harnessRegistry);
  agentRegistry.register(agentDefinition({ id: 'first-coder', name: 'First Coder' }));
  agentRegistry.register(agentDefinition({ id: 'second-coder', name: 'Second Coder' }));
  return { agentRegistry, harnessRegistry, baseUrl };
}
