import { AgentHost, buildAgentCard } from '@a2a-agent-example/a2a-bridge';
import { expressEndpoints } from '@a2a-agent-example/a2a-bridge/express';
import type { ExpressEndpoints } from '@a2a-agent-example/a2a-bridge/express';
import type { HarnessRegistry } from '@a2a-agent-example/harness';
import type { DefaultRequestHandler } from '@a2a-js/sdk/server';
import { agentPaths, joinUrl } from '../helpers/agent-url.helper.ts';
import { logger } from '../logger.ts';
import type { Agent } from '../models/agent.model.ts';

/** One agent's A2A side: the bridge's request handler and the Express handlers in front of it. */
export interface AgentEndpoints extends ExpressEndpoints {
  requestHandler: DefaultRequestHandler;
}

export interface AgentRuntimeOptions {
  harnessRegistry: HarnessRegistry;
  /** The URL clients reach the server at; the Agent Cards point there. */
  baseUrl: string;
}

/**
 * Where the agents run: the server's agents on the bridge's `AgentHost`, each with its card at the server's own URL
 * and the Express handlers in front, by agent id. Nothing here is stored; it is rebuilt from the records.
 */
export class AgentRuntime {
  readonly #harnessRegistry: HarnessRegistry;
  readonly #baseUrl: string;
  readonly #host = new AgentHost();
  readonly #endpoints = new Map<string, AgentEndpoints>();

  constructor({ harnessRegistry, baseUrl }: AgentRuntimeOptions) {
    this.#harnessRegistry = harnessRegistry;
    this.#baseUrl = baseUrl;
  }

  /** Opens the agent, or reopens it after a change; the host keeps its tasks and sessions across the change. */
  open(agent: Agent): AgentEndpoints {
    const requestHandler = this.#host.open(agent.id, {
      card: buildAgentCard({
        name: agent.name,
        description: agent.description,
        skills: agent.skills,
        url: joinUrl(this.#baseUrl, agentPaths(agent.id).jsonRpc)
      }),
      harness: this.#harnessRegistry.get(agent.harness),
      sessionConfig: { workspace: agent.workspace, instructions: agent.instructions, model: agent.model },
      logger: logger.child({ agent: agent.id })
    });
    const endpoints = { requestHandler, ...expressEndpoints(requestHandler) };
    this.#endpoints.set(agent.id, endpoints);
    return endpoints;
  }

  /** The agent's endpoints, or undefined when it is not open. */
  get(agentId: string): AgentEndpoints | undefined {
    return this.#endpoints.get(agentId);
  }

  /** Closes the agent; tasks already running finish on their own. */
  close(agentId: string): void {
    this.#host.close(agentId);
    this.#endpoints.delete(agentId);
  }
}
