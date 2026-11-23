import type { Harness, HarnessRegistry } from '@a2a-agent-example/harness-core';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import express from 'express';
import type { Express } from 'express';
import { buildAgentCard } from './agent-card.ts';
import type { AgentDefinition } from './agent-definition.ts';
import { agentPaths } from './agent-paths.ts';
import type { AgentRegistry } from './agent-registry.ts';
import { summarizeAgent } from './agent-summary.ts';
import { HarnessExecutor } from './harness-executor.ts';

export interface AppOptions {
  agents: AgentRegistry;
  harnesses: HarnessRegistry;
  /** The URL clients reach the server at; the Agent Cards point there. */
  baseUrl: string;
}

/** The Express app: `GET /agents` for discovery, and each agent's card and JSON-RPC endpoint under `/agents/<id>`. */
export function createApp({ agents, harnesses, baseUrl }: AppOptions): Express {
  const app = express();
  app.get('/agents', (_req, res) => {
    res.json(agents.list().map((agent) => summarizeAgent(agent, baseUrl)));
  });
  for (const agent of agents.list()) {
    mountAgent(app, agent, harnesses.get(agent.harness), baseUrl);
  }
  return app;
}

function mountAgent(app: Express, agent: AgentDefinition, harness: Harness, baseUrl: string): void {
  const executor = new HarnessExecutor({ agent, harness, sessions: new Map() });
  const requestHandler = new DefaultRequestHandler(buildAgentCard(agent, baseUrl), new InMemoryTaskStore(), executor);
  const paths = agentPaths(agent.id);
  app.use(paths.card, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(paths.jsonRpc, jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
}
