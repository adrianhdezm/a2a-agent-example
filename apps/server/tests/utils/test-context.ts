import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { AgentRegistry } from '../../src/agent-registry.ts';
import type { AppContext } from '../../src/models/app-context.model.ts';
import { agentDefinition } from './agent-definition-seed.ts';

/** A context with two agents, `first-coder` and `second-coder`, on a `fake` harness that answers with `events`. */
export function testContext(baseUrl: string, events: HarnessEvent[] = []): AppContext {
  const harnesses = new HarnessRegistry();
  harnesses.register(new FakeHarness('fake', events));
  const agents = new AgentRegistry(harnesses);
  agents.register(agentDefinition({ id: 'first-coder', name: 'First Coder' }));
  agents.register(agentDefinition({ id: 'second-coder', name: 'Second Coder' }));
  return { agents, harnesses, baseUrl };
}
