import { UnknownHarnessError } from '@a2a-agent-example/harness-core';
import type { HarnessRegistry } from '@a2a-agent-example/harness-core';
import type { AgentDefinition } from './agent-definition.ts';
import { DuplicateAgentError } from './errors/duplicate-agent-error.ts';
import { InvalidAgentIdError } from './errors/invalid-agent-id-error.ts';
import { UnknownAgentError } from './errors/unknown-agent-error.ts';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The agents the server exposes, by id, each checked against the harnesses it can run on. */
export class AgentRegistry {
  readonly #harnesses: HarnessRegistry;
  readonly #agents = new Map<string, AgentDefinition>();

  constructor(harnesses: HarnessRegistry) {
    this.#harnesses = harnesses;
  }

  /**
   * Adds an agent. Throws `InvalidAgentIdError` for an id that is not a slug, `DuplicateAgentError` for an id already
   * taken, and `UnknownHarnessError` for a harness the harness registry does not hold.
   */
  register(definition: AgentDefinition): void {
    if (!slug.test(definition.id)) {
      throw new InvalidAgentIdError(definition.id);
    }
    if (this.#agents.has(definition.id)) {
      throw new DuplicateAgentError(definition.id);
    }
    if (!this.#harnesses.has(definition.harness)) {
      throw new UnknownHarnessError(definition.harness);
    }
    this.#agents.set(definition.id, definition);
  }

  /** Returns the agent registered as `id`; throws `UnknownAgentError` if there is none. */
  get(id: string): AgentDefinition {
    const definition = this.#agents.get(id);
    if (definition === undefined) {
      throw new UnknownAgentError(id);
    }
    return definition;
  }

  /** Every registered agent, in registration order. */
  list(): AgentDefinition[] {
    return [...this.#agents.values()];
  }
}
