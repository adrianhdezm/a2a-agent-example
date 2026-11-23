import type { AgentDefinition } from './agent-definition.ts';
import { agentPaths, joinUrl } from './agent-paths.ts';

/** One entry of the server's `GET /agents` list: enough for a client to pick an agent and fetch its card. */
export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  harness: string;
  cardUrl: string;
}

export function summarizeAgent(definition: AgentDefinition, baseUrl: string): AgentSummary {
  const { id, name, description, harness } = definition;
  return { id, name, description, harness, cardUrl: joinUrl(baseUrl, agentPaths(id).card) };
}

/** Whether a parsed JSON value is an `AgentSummary`. */
export function isAgentSummary(value: unknown): value is AgentSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields: Record<string, unknown> = { ...value };
  return ['id', 'name', 'description', 'harness', 'cardUrl'].every((key) => typeof fields[key] === 'string');
}
