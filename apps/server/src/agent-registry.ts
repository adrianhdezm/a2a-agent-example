import { UnknownHarnessError } from '@a2a-agent-example/harness-core';
import type { HarnessRegistry } from '@a2a-agent-example/harness-core';
import type { AgentDefinition } from './agent-definition.ts';
import { AgentRegistryError } from './errors/agent-registry-error.ts';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The agents the server exposes, by id, each checked against the harnesses it can run on. */
export class AgentRegistry {
  readonly #harnesses: HarnessRegistry;
  readonly #agents = new Map<string, AgentDefinition>();

  constructor(harnesses: HarnessRegistry) {
    this.#harnesses = harnesses;
  }

  /**
   * Adds an agent. Throws an `AgentRegistryError` for an id that is not a slug (`invalid-id`) or is already taken
   * (`duplicate-id`), and harness-core's `UnknownHarnessError` for a harness the harness registry does not hold.
   */
  register(definition: AgentDefinition): void {
    if (!slug.test(definition.id)) {
      throw new AgentRegistryError({ reason: 'invalid-id', agentId: definition.id });
    }
    if (this.#agents.has(definition.id)) {
      throw new AgentRegistryError({ reason: 'duplicate-id', agentId: definition.id });
    }
    if (!this.#harnesses.has(definition.harness)) {
      throw new UnknownHarnessError(definition.harness);
    }
    this.#agents.set(definition.id, definition);
  }

  /** Returns the agent registered as `id`; throws an `AgentRegistryError` (`unknown-id`) if there is none. */
  get(id: string): AgentDefinition {
    const definition = this.#agents.get(id);
    if (definition === undefined) {
      throw new AgentRegistryError({ reason: 'unknown-id', agentId: id });
    }
    return definition;
  }

  /** Every registered agent, in registration order. */
  list(): AgentDefinition[] {
    return [...this.#agents.values()];
  }
}
