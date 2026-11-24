import type { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import type { AgentExecutor } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import express from 'express';
import type { Express } from 'express';
import { agentPaths } from './agent-card.ts';

/** The Express app serving one agent: its card, and its JSON-RPC endpoint backed by an in-memory task store. */
export function createApp(card: AgentCard, executor: AgentExecutor): Express {
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), executor);
  const app = express();
  app.use(agentPaths.card, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(agentPaths.jsonRpc, jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
  return app;
}
