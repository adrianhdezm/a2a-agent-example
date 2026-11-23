import { isAgentPage, isAgentResponse } from './agent-response.ts';
import type { AgentPage, AgentResponse } from './agent-response.ts';
import { AgentExistsError } from './errors/agent-exists-error.ts';
import { AgentNotFoundError } from './errors/agent-not-found-error.ts';
import { UnexpectedResponseError } from './errors/unexpected-response-error.ts';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** One thing a new agent can do, as its Agent Card will advertise it. */
export interface NewAgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

/** The body of `POST /agents`. */
export interface NewAgent {
  id: string;
  name: string;
  description: string;
  harness: string;
  instructions: string;
  model?: string;
  skills: NewAgentSkill[];
}

/** The server's `/agents` resource. */
export interface AgentsApi {
  get(agentId: string): Promise<AgentResponse>;
  list(): Promise<AgentPage>;
  /** Creates the agent; throws an `AgentExistsError` when the server already has one with its id. */
  create(agent: NewAgent): Promise<AgentResponse>;
}

// The server's own message for an error answer, which says what to fix; the status when there is none.
async function failure(what: string, response: Response): Promise<UnexpectedResponseError> {
  const body: unknown = await response.json().catch(() => undefined);
  const message =
    typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' ? body.message : undefined;
  return new UnexpectedResponseError(`${what} answered ${String(response.status)}${message === undefined ? '' : `: ${message}`}`);
}

async function read<T>(what: string, response: Response, guard: (value: unknown) => value is T): Promise<T> {
  if (!response.ok) {
    throw await failure(what, response);
  }
  const body: unknown = await response.json();
  if (!guard(body)) {
    throw new UnexpectedResponseError(`${what} answered with a body this client cannot read`);
  }
  return body;
}

/** The `/agents` resource of the server at `serverUrl`. */
export function agentsApi(serverUrl: string, fetchUrl: Fetch = fetch): AgentsApi {
  const url = `${serverUrl.replace(/\/+$/, '')}/agents`;
  return {
    get: async (agentId) => {
      const response = await fetchUrl(`${url}/${encodeURIComponent(agentId)}`);
      if (response.status === 404) {
        throw new AgentNotFoundError(agentId);
      }
      return read(`GET /agents/${agentId}`, response, isAgentResponse);
    },
    list: async () => read('GET /agents', await fetchUrl(`${url}?sortField=id&sortDirection=ASC&pageSize=100`), isAgentPage),
    create: async (agent) => {
      const response = await fetchUrl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });
      if (response.status === 409) {
        throw new AgentExistsError(agent.id);
      }
      return read('POST /agents', response, isAgentResponse);
    }
  };
}
