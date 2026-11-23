/** One entry of the server's `GET /agents` list, as this client reads it. */
export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  harness: string;
  cardUrl: string;
}

/** Whether a parsed JSON value is an `AgentSummary`. */
export function isAgentSummary(value: unknown): value is AgentSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields: Record<string, unknown> = { ...value };
  return ['id', 'name', 'description', 'harness', 'cardUrl'].every((key) => typeof fields[key] === 'string');
}
