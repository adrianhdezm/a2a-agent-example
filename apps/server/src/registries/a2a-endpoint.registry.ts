import type { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import type { RequestHandler } from 'express';
import { HarnessExecutor } from '../executors/harness.executor.ts';
import { buildAgentCard } from '../helpers/agent-card.helper.ts';
import type { Agent } from '../models/agent.model.ts';

/** The A2A side of one agent: the SDK's request handler and the two Express handlers in front of it. */
export interface AgentEndpoints {
  requestHandler: DefaultRequestHandler;
  card: RequestHandler;
  jsonRpc: RequestHandler;
}

// What outlives a change to the agent: its tasks and the harness session of each A2A context.
interface AgentState {
  taskStore: InMemoryTaskStore;
  sessions: Map<string, string>;
  endpoints: AgentEndpoints;
}

export interface A2AEndpointRegistryOptions {
  harnessRegistry: HarnessRegistry;
  /** The URL clients reach the server at; the Agent Cards point there. */
  baseUrl: string;
}

/** The A2A endpoints of every agent, by agent id, opened when an agent is created and closed when it is deleted. */
export class A2AEndpointRegistry {
  readonly #harnessRegistry: HarnessRegistry;
  readonly #baseUrl: string;
  readonly #agents = new Map<string, AgentState>();

  constructor({ harnessRegistry, baseUrl }: A2AEndpointRegistryOptions) {
    this.#harnessRegistry = harnessRegistry;
    this.#baseUrl = baseUrl;
  }

  /**
   * Opens the agent's endpoints, or reopens them after a change: the card and the executor follow the new agent,
   * while its tasks and sessions carry over, so a conversation goes on with the new instructions.
   */
  open(agent: Agent): AgentEndpoints {
    const previous = this.#agents.get(agent.id);
    const taskStore = previous?.taskStore ?? new InMemoryTaskStore();
    const sessions = previous?.sessions ?? new Map<string, string>();
    const executor = new HarnessExecutor({ agent, harness: this.#harnessRegistry.get(agent.harness), sessions });
    const requestHandler = new DefaultRequestHandler(buildAgentCard(agent, this.#baseUrl), taskStore, executor);
    const endpoints = {
      requestHandler,
      card: agentCardHandler({ agentCardProvider: requestHandler }),
      jsonRpc: jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })
    };
    this.#agents.set(agent.id, { taskStore, sessions, endpoints });
    return endpoints;
  }

  /** The agent's endpoints, or undefined when it has none open. */
  get(agentId: string): AgentEndpoints | undefined {
    return this.#agents.get(agentId)?.endpoints;
  }

  /** Closes the agent's endpoints; tasks already running finish on their own. */
  close(agentId: string): void {
    this.#agents.delete(agentId);
  }
}
