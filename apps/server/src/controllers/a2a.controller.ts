import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';

// The agent's A2A endpoints are the SDK's handlers, kept in the runtime; these handlers look the agent up when a
// request arrives, so an agent created or deleted at runtime is reachable exactly while it exists, and hand the
// request on. What the SDK answers follows the A2A spec.

type AgentRequest = Request<{ id: string }>;

/** `/agents/:id/.well-known/agent-card.json`: the agent's A2A card; a 404 for an agent that does not exist. */
export async function getAgentCard(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const endpoints = req.app.locals.context.agentRuntime.get(req.params.id);
    if (endpoints === undefined) {
      throw createError(404, `Agent not found: ${req.params.id}`, { expose: true });
    }
    await endpoints.card(req, res, next);
  } catch (err) {
    next(err);
  }
}

/** `/agents/:id/a2a/jsonrpc`: the agent's A2A JSON-RPC endpoint; a 404 for an agent that does not exist. */
export async function handleAgentJsonRpc(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const endpoints = req.app.locals.context.agentRuntime.get(req.params.id);
    if (endpoints === undefined) {
      throw createError(404, `Agent not found: ${req.params.id}`, { expose: true });
    }
    await endpoints.jsonRpc(req, res, next);
  } catch (err) {
    next(err);
  }
}
