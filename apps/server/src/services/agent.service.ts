import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { AgentError } from '../models/agent.model.ts';
import type { Agent, AgentChanges, AgentInput, AgentSortField } from '../models/agent.model.ts';
import type { ListParams, PaginatedResult } from '../models/list.model.ts';
import type { A2AEndpointRegistry } from '../registries/a2a-endpoint.registry.ts';
import type { AgentRegistry } from '../registries/agent.registry.ts';

export interface AgentServiceOptions {
  agentRegistry: AgentRegistry;
  endpointRegistry: A2AEndpointRegistry;
  harnessRegistry: HarnessRegistry;
  /** The folder every agent's workspace is created in, as `<workspacesDir>/<id>`. */
  workspacesDir: string;
  /** Creates a workspace folder; the file system unless a test hands in its own. */
  createWorkspace?: (path: string) => Promise<unknown>;
  /** The current time; the clock unless a test hands in its own. */
  now?: () => Date;
}

/**
 * The agents' operations: each one changes the agent registry and the A2A endpoints together, so an agent is
 * reachable exactly while it exists.
 */
export class AgentService {
  readonly #agents: AgentRegistry;
  readonly #endpoints: A2AEndpointRegistry;
  readonly #harnesses: HarnessRegistry;
  readonly #workspacesDir: string;
  readonly #createWorkspace: (path: string) => Promise<unknown>;
  readonly #now: () => Date;

  constructor(options: AgentServiceOptions) {
    this.#agents = options.agentRegistry;
    this.#endpoints = options.endpointRegistry;
    this.#harnesses = options.harnessRegistry;
    this.#workspacesDir = options.workspacesDir;
    this.#createWorkspace = options.createWorkspace ?? ((path) => mkdir(path, { recursive: true }));
    this.#now = options.now ?? (() => new Date());
  }

  /**
   * Creates an agent in its own workspace and opens its A2A endpoints. Throws an `AgentError` for a harness that is
   * not registered (`unknown-harness`) or an id already taken (`duplicate-id`).
   */
  async create(input: AgentInput): Promise<Agent> {
    if (!this.#harnesses.has(input.harness)) {
      throw new AgentError({ reason: 'unknown-harness', agentId: input.id, harness: input.harness });
    }
    const now = this.#now().toISOString();
    const agent: Agent = { ...input, workspace: join(this.#workspacesDir, input.id), createdAt: now, updatedAt: now };
    this.#agents.create(agent);
    try {
      await this.#createWorkspace(agent.workspace);
    } catch (error) {
      this.#agents.delete(agent.id);
      throw error;
    }
    this.#endpoints.open(agent);
    return agent;
  }

  get(id: string): Agent {
    return this.#agents.get(id);
  }

  list(params: ListParams<AgentSortField>): PaginatedResult<Agent> {
    return this.#agents.list(params);
  }

  /** Applies `changes` and reopens the agent's endpoints with them; its harness and workspace stay. */
  update(id: string, changes: AgentChanges): Agent {
    const agent: Agent = { ...this.#agents.get(id), ...changes, updatedAt: this.#now().toISOString() };
    this.#agents.update(agent);
    this.#endpoints.open(agent);
    return agent;
  }

  /** Deletes the agent and closes its endpoints; its workspace folder stays on disk. */
  delete(id: string): void {
    this.#agents.delete(id);
    this.#endpoints.close(id);
  }
}
