import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import { getAgent, listAgents } from './controllers/agent.controller.ts';
import { getHealth } from './controllers/health.controller.ts';
import { HarnessExecutor } from './executors/harness.executor.ts';
import { buildAgentCard } from './helpers/agent-card.helper.ts';
import { agentPaths } from './helpers/agent-url.helper.ts';
import { logger } from './logger.ts';
import { errorHandler } from './middlewares/error.middleware.ts';
import { notFoundHandler } from './middlewares/not-found.middleware.ts';
import type { AgentDefinition } from './models/agent.model.ts';
import type { AppContext } from './models/app-context.model.ts';

/**
 * The Express app: `GET /health`, `GET /agents` and `GET /agents/:id` for discovery, and each agent's card and
 * JSON-RPC endpoint under `/agents/<id>`; anything else is a 404 in the standard error shape.
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
  app.get('/agents/:id', getAgent);
  for (const agent of context.agentRegistry.list()) {
    mountA2AEndpoints(app, agent, context);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// The A2A endpoints are the SDK's routers, mounted at the agent's paths with a harness executor behind them; their
// requests and errors follow the A2A spec.
function mountA2AEndpoints(app: Express, agent: AgentDefinition, { harnessRegistry, baseUrl }: AppContext): void {
  const executor = new HarnessExecutor({ agent, harness: harnessRegistry.get(agent.harness), sessions: new Map() });
  const requestHandler = new DefaultRequestHandler(buildAgentCard(agent, baseUrl), new InMemoryTaskStore(), executor);
  const paths = agentPaths(agent.id);
  app.use(paths.card, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(paths.jsonRpc, jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
}
