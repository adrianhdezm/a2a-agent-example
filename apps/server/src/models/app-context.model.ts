import type { HarnessRegistry } from '@a2a-agent-example/harness-core';
import type { AgentRegistry } from '../registries/agent.registry.ts';

/** What the handlers use, built once by `server.ts` and stored on `app.locals.context`. */
export interface AppContext {
  agentRegistry: AgentRegistry;
  harnessRegistry: HarnessRegistry;
  /** The URL clients reach the server at; the Agent Cards and summaries point there. */
  baseUrl: string;
}
