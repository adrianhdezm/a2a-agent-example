import type { RequestHandler } from 'express';
import createError from 'http-errors';
import type { AgentEndpoints } from '../runtimes/agent.runtime.ts';

type EndpointName = 'card' | 'jsonRpc';

// Hands the request to the agent's endpoint of that name, looked up when it arrives, so an agent created or deleted at
// runtime is reachable exactly while it exists; an unknown agent is a 404 in the standard error shape.
function dispatchTo(endpoint: EndpointName): RequestHandler<{ id: string }> {
  return (req, res, next) => {
    const endpoints: AgentEndpoints | undefined = req.app.locals.context.agentRuntime.get(req.params.id);
    if (endpoints === undefined) {
      next(createError(404, `Agent not found: ${req.params.id}`, { expose: true }));
      return;
    }
    endpoints[endpoint](req, res, next);
  };
}

/** `/agents/:id/.well-known/agent-card.json`: the agent's A2A card. */
export const agentCardHandler = dispatchTo('card');

/** `/agents/:id/a2a/jsonrpc`: the agent's A2A JSON-RPC endpoint. */
export const agentJsonRpcHandler = dispatchTo('jsonRpc');
