import type { DefaultRequestHandler } from '@a2a-js/sdk/server';

/** An A2A agent as the app mounts it: the SDK's request handler for it, and where its card and JSON-RPC endpoint go. */
export interface MountedAgent {
  requestHandler: DefaultRequestHandler;
  paths: { card: string; jsonRpc: string };
}

/** What the app's handlers use, built once by `server.ts` and stored on `app.locals.context`. */
export interface AppContext {
  agent: MountedAgent;
}
