/** An agent as the server's `/agents` routes answer it, in the fields this client reads. */
export interface AgentResponse {
  id: string;
  name: string;
  description: string;
  harness: string;
  instructions: string;
  cardUrl: string;
}

/** One page of `GET /agents`, in the fields this client reads. */
export interface AgentPage {
  items: AgentResponse[];
  total: number;
}

function fieldsOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? { ...value } : undefined;
}

/** Whether a parsed JSON value is an `AgentResponse`. */
export function isAgentResponse(value: unknown): value is AgentResponse {
  const fields = fieldsOf(value);
  return (
    fields !== undefined &&
    ['id', 'name', 'description', 'harness', 'instructions', 'cardUrl'].every((key) => typeof fields[key] === 'string')
  );
}

/** Whether a parsed JSON value is an `AgentPage`. */
export function isAgentPage(value: unknown): value is AgentPage {
  const fields = fieldsOf(value);
  return fields !== undefined && typeof fields.total === 'number' && Array.isArray(fields.items) && fields.items.every(isAgentResponse);
}
