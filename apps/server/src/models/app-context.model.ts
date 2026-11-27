import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DefaultRequestHandler } from '@a2a-js/sdk/server';

/**
 * An A2A agent as the app mounts it: the SDK's request handler for it, its tools over MCP for one A2A context, and
 * where its card, JSON-RPC endpoint and tools go.
 */
export interface MountedAgent {
  requestHandler: DefaultRequestHandler;
  toolsHandler: (contextId: string, req: IncomingMessage, res: ServerResponse) => Promise<void>;
  paths: { card: string; jsonRpc: string; mcp: string };
}

/** What the app's handlers use, built once by `server.ts` and stored on `app.locals.context`. */
export interface AppContext {
  /** The agents the app serves, each at its own paths. */
  agents: MountedAgent[];
}
