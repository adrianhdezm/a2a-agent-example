import { AgentError } from '../models/agent.model.ts';
import type { Agent, AgentSortField } from '../models/agent.model.ts';
import type { ListParams, PaginatedResult } from '../models/list.model.ts';

/** The agents, kept in memory by id: the agents' data layer. It stores what it is given and checks only ids. */
export class AgentRegistry {
  readonly #agents = new Map<string, Agent>();

  /** Stores a new agent; throws an `AgentError` (`duplicate-id`) for an id already taken. */
  create(agent: Agent): void {
    if (this.#agents.has(agent.id)) {
      throw new AgentError({ reason: 'duplicate-id', agentId: agent.id });
    }
    this.#agents.set(agent.id, agent);
  }

  /** Returns the agent with `id`; throws an `AgentError` (`unknown-id`) if there is none. */
  get(id: string): Agent {
    const agent = this.#agents.get(id);
    if (agent === undefined) {
      throw new AgentError({ reason: 'unknown-id', agentId: id });
    }
    return agent;
  }

  /** One page of the agents, sorted by `sortField` with the id as tie-breaker. */
  list({ page, pageSize, sortField, sortDirection }: ListParams<AgentSortField>): PaginatedResult<Agent> {
    const direction = sortDirection === 'ASC' ? 1 : -1;
    const sorted = [...this.#agents.values()].sort(
      (a, b) => direction * a[sortField].localeCompare(b[sortField]) || a.id.localeCompare(b.id)
    );
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
      totalPages: Math.ceil(sorted.length / pageSize)
    };
  }

  /** Replaces a stored agent; throws an `AgentError` (`unknown-id`) if there is none with its id. */
  update(agent: Agent): void {
    this.get(agent.id);
    this.#agents.set(agent.id, agent);
  }

  /** Removes an agent; throws an `AgentError` (`unknown-id`) if there is none with `id`. */
  delete(id: string): void {
    this.get(id);
    this.#agents.delete(id);
  }
}
