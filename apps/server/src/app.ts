import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import { getAgentCard, handleAgentJsonRpc } from './controllers/a2a.controller.ts';
import { createAgent, deleteAgent, getAgent, listAgents, updateAgent } from './controllers/agent.controller.ts';
import { getHealth } from './controllers/health.controller.ts';
import { logger } from './logger.ts';
import { errorHandler } from './middlewares/error.middleware.ts';
import { notFoundHandler } from './middlewares/not-found.middleware.ts';
import type { AppContext } from './models/app-context.model.ts';

/**
 * The Express app: `GET /health`, the `/agents` resource, and each agent's A2A card and JSON-RPC endpoint under
 * `/agents/:id`, looked up per request so agents come and go at runtime; anything else is a 404 in the standard shape.
 */
export function createApp(context: AppContext): Express {
  const app = express();
  app.locals.context = context;

  app.use(pinoHttp({ logger }));
  app.use(cors());
  // Bodies are parsed only where the server's own routes take one: the A2A JSON-RPC router parses its own, and must
  // answer malformed JSON as a JSON-RPC error rather than in this server's error shape.
  const json = express.json();

  app.get('/health', getHealth);
  app.get('/agents', listAgents);
  app.post('/agents', json, createAgent);
  app.get('/agents/:id', getAgent);
  app.patch('/agents/:id', json, updateAgent);
  app.delete('/agents/:id', deleteAgent);
  // app.use, not app.get or app.post: the SDK's handlers are routers of their own that match `/` beneath the mount path
  // (and the v0.3 compatibility routes when enabled), which only app.use gives them by stripping that path.
  app.use('/agents/:id/.well-known/agent-card.json', getAgentCard);
  app.use('/agents/:id/a2a/jsonrpc', handleAgentJsonRpc);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
