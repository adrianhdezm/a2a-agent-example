import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import type { AppContext } from '../../src/models/app-context.model.ts';
import { A2AEndpointRegistry } from '../../src/registries/a2a-endpoint.registry.ts';
import { AgentRegistry } from '../../src/registries/agent.registry.ts';
import { AgentService } from '../../src/services/agent.service.ts';
import { agentInput, fixedClock } from './agent-seed.ts';

export interface TestContext {
  context: AppContext;
  /** The one harness every agent runs on: it answers each turn with the events it was given. */
  harness: FakeHarness;
  /** The workspace folders the service asked for, in order; none is created on disk. */
  workspaces: string[];
}

/**
 * A context built the way `server.ts` builds it, on a `fake` harness and a fixed clock, with two agents already
 * created: `first-coder` and `second-coder`.
 */
export async function testContext(baseUrl: string, events: HarnessEvent[] = []): Promise<TestContext> {
  const harness = new FakeHarness('fake', events);
  const harnessRegistry = new HarnessRegistry();
  harnessRegistry.register(harness);
  const endpointRegistry = new A2AEndpointRegistry({ harnessRegistry, baseUrl });
  const workspaces: string[] = [];
  const agentService = new AgentService({
    agentRegistry: new AgentRegistry(),
    endpointRegistry,
    harnessRegistry,
    workspacesDir: '/srv/workspaces',
    createWorkspace: (path) => Promise.resolve(workspaces.push(path)),
    now: fixedClock()
  });
  await agentService.create(agentInput({ id: 'first-coder', name: 'First Coder' }));
  await agentService.create(agentInput({ id: 'second-coder', name: 'Second Coder' }));
  return { context: { agentService, endpointRegistry, baseUrl }, harness, workspaces };
}
