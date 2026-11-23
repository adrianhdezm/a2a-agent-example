import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import { buildAgentCard } from './agent-card.ts';
import type { AgentDefinition } from './agent-definition.ts';
import { agentPaths } from './agent-paths.ts';
import { listAgents } from './controllers/agent.controller.ts';
import { getHealth } from './controllers/health.controller.ts';
import { HarnessExecutor } from './harness-executor.ts';
import { logger } from './logger.ts';
import { errorHandler } from './middlewares/error.middleware.ts';
import { notFoundHandler } from './middlewares/not-found.middleware.ts';
import type { AppContext } from './models/app-context.model.ts';

/**
 * The Express app: `GET /health`, `GET /agents` for discovery, and each agent's card and JSON-RPC endpoint under
 * `/agents/<id>`; anything else is a 404 in the standard error shape.
 */
export function createApp(context: AppContext): Express {
  const app = express();
  app.locals.context = context;

  app.use(pinoHttp({ logger }));
  app.use(cors());
  // No app-wide express.json(): the A2A JSON-RPC router parses its own body, and must answer malformed JSON as a
  // JSON-RPC error rather than in this server's error shape. The server's own routes take no body.

  app.get('/health', getHealth);
  app.get('/agents', listAgents);
  for (const agent of context.agents.list()) {
    mountAgent(app, agent, context);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// The A2A endpoints are the SDK's routers, mounted at the agent's paths; their requests and errors follow the A2A spec.
function mountAgent(app: Express, agent: AgentDefinition, { harnesses, baseUrl }: AppContext): void {
  const executor = new HarnessExecutor({ agent, harness: harnesses.get(agent.harness), sessions: new Map() });
  const requestHandler = new DefaultRequestHandler(buildAgentCard(agent, baseUrl), new InMemoryTaskStore(), executor);
  const paths = agentPaths(agent.id);
  app.use(paths.card, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(paths.jsonRpc, jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
}
