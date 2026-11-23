import type { DefaultRequestHandler } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import type { RequestHandler } from 'express';

/** The Express handlers in front of one agent's request handler; mount each with `app.use` at the agent's path. */
export interface ExpressEndpoints {
  /** Answers `GET /` beneath its mount path with the agent's card. */
  card: RequestHandler;
  /** Answers `POST /` beneath its mount path as the agent's JSON-RPC endpoint. */
  jsonRpc: RequestHandler;
}

/** The SDK's Express handlers for one agent, without authentication. */
export function expressEndpoints(requestHandler: DefaultRequestHandler): ExpressEndpoints {
  return {
    card: agentCardHandler({ agentCardProvider: requestHandler }),
    jsonRpc: jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })
  };
}
