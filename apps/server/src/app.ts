import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import { getHealth } from './controllers/health.controller.ts';
import { agentPaths } from './helpers/agent-card.helper.ts';
import { logger } from './logger.ts';
import { errorHandler } from './middlewares/error.middleware.ts';
import { notFoundHandler } from './middlewares/not-found.middleware.ts';
import type { AppContext } from './models/app-context.model.ts';

/** The Express app: `GET /health`, the agent's A2A card and JSON-RPC endpoint, and a 404 in the standard shape for anything else. */
export function createApp(context: AppContext): Express {
  const app = express();
  app.locals.context = context;

  app.use(pinoHttp({ logger }));
  app.use(cors());
  // No express.json(): the server's own routes take no body, and the A2A JSON-RPC handler parses its own, answering
  // malformed JSON as a JSON-RPC error rather than in this server's error shape.

  app.get('/health', getHealth);
  // The A2A endpoints are the SDK's own handlers, with no controller in front: the SDK answers them, as the A2A spec
  // says. app.use, not app.get or app.post, because they are routers that match `/` beneath the mount path.
  app.use(agentPaths.card, agentCardHandler({ agentCardProvider: context.requestHandler }));
  app.use(agentPaths.jsonRpc, jsonRpcHandler({ requestHandler: context.requestHandler, userBuilder: UserBuilder.noAuthentication }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
