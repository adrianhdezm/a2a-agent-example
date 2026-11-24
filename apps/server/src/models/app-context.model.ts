import type { DefaultRequestHandler } from '@a2a-js/sdk/server';

/** What the app's handlers use, built once by `server.ts` and stored on `app.locals.context`. */
export interface AppContext {
  /** The A2A SDK's request handler for the agent: its card, task store and executor. */
  requestHandler: DefaultRequestHandler;
}
