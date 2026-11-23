import { z } from 'zod';

const slug = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a URL-safe slug: lowercase letters, digits and single hyphens');

export const agentSkillSchema = z.strictObject({
  id: slug,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(50)).max(20),
  examples: z.array(z.string().min(1).max(2000)).max(20)
});

/** The body of `POST /agents`: who the agent is, which harness runs it, and what it is for. */
export const createAgentSchema = z.strictObject({
  id: slug,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  harness: z.string().min(1).max(64),
  instructions: z.string().min(1).max(20_000),
  model: z.string().min(1).max(200).optional(),
  skills: z.array(agentSkillSchema).max(20)
});

/** The body of `PATCH /agents/:id`: any of the fields a running agent may change, at least one. */
export const updateAgentSchema = createAgentSchema
  .omit({ id: true, harness: true })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'no field to update');

export const agentSortFields = ['id', 'name', 'createdAt'] as const;

/** The query of `GET /agents`: one page, sorted; nothing else. */
export const listAgentsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortField: z.enum(agentSortFields).default('createdAt'),
  sortDirection: z.enum(['ASC', 'DESC']).default('DESC')
});

export type AgentSkill = z.infer<typeof agentSkillSchema>;
export type AgentInput = z.infer<typeof createAgentSchema>;
export type AgentChanges = z.infer<typeof updateAgentSchema>;
export type AgentSortField = (typeof agentSortFields)[number];

/** An agent as the server keeps it: what it was created with, its workspace, and when it was created and changed. */
export interface Agent extends AgentInput {
  /** `<workspaces>/<id>`, chosen by the server, never by a client. */
  workspace: string;
  createdAt: string;
  updatedAt: string;
}

/** An agent as the API answers it: the agent and the URL of its card. */
export interface AgentResponse extends Agent {
  cardUrl: string;
}

export type AgentErrorDetails =
  | { reason: 'duplicate-id'; agentId: string }
  | { reason: 'unknown-id'; agentId: string }
  | { reason: 'unknown-harness'; agentId: string; harness: string };

function messageFor(details: AgentErrorDetails): string {
  switch (details.reason) {
    case 'duplicate-id':
      return `An agent already exists as "${details.agentId}"`;
    case 'unknown-id':
      return `No agent exists as "${details.agentId}"`;
    case 'unknown-harness':
      return `Agent "${details.agentId}" names the harness "${details.harness}", which is not registered`;
  }
}

/** The agents' domain error; `reason` says which rule an operation broke. */
export class AgentError extends Error {
  readonly reason: AgentErrorDetails['reason'];
  readonly agentId: string;

  constructor(details: AgentErrorDetails) {
    super(messageFor(details));
    this.name = 'AgentError';
    this.reason = details.reason;
    this.agentId = details.agentId;
  }
}
