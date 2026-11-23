import type { A2AEndpointRegistry } from '../registries/a2a-endpoint.registry.ts';
import type { AgentService } from '../services/agent.service.ts';

/** What the handlers use, built once by `server.ts` and stored on `app.locals.context`. */
export interface AppContext {
  agentService: AgentService;
  endpointRegistry: A2AEndpointRegistry;
  /** The URL clients reach the server at; the Agent Cards and agent responses point there. */
  baseUrl: string;
}
