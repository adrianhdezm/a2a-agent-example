import { isAgentSummary } from './agent-summary.ts';
import type { AgentSummary } from './agent-summary.ts';
import { AgentNotFoundError } from './errors/agent-not-found-error.ts';
import { UnexpectedResponseError } from './errors/unexpected-response-error.ts';

export type Fetch = (url: string) => Promise<Response>;

/** Finds an agent in the server's `GET /agents` list. */
export async function findAgent(serverUrl: string, agentId: string, fetchUrl: Fetch = fetch): Promise<AgentSummary> {
  const response = await fetchUrl(`${serverUrl.replace(/\/+$/, '')}/agents`);
  if (!response.ok) {
    throw new UnexpectedResponseError(`GET /agents answered ${String(response.status)}`);
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !body.every(isAgentSummary)) {
    throw new UnexpectedResponseError('GET /agents did not answer with a list of agents');
  }
  const agent = body.find(({ id }) => id === agentId);
  if (agent === undefined) {
    throw new AgentNotFoundError(
      agentId,
      body.map(({ id }) => id)
    );
  }
  return agent;
}
