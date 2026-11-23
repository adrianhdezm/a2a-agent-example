import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { z } from 'zod';
import { toAgentResponse } from '../helpers/agent-url.helper.ts';
import { AgentError, createAgentSchema, listAgentsQuerySchema, updateAgentSchema } from '../models/agent.model.ts';

type AgentRequest = Request<{ id: string }>;

const noQuery = z.strictObject({});

// The domain errors' answers: an unknown agent is a 404, a taken id a 409, an unregistered harness a 400.
function toHttpError(err: unknown): unknown {
  if (!(err instanceof AgentError)) {
    return err;
  }
  const status = { 'unknown-id': 404, 'duplicate-id': 409, 'unknown-harness': 400 }[err.reason];
  return createError(status, err.message, { expose: true, cause: err });
}

/** `GET /agents`: one page of the agents, sorted, in the list envelope. */
export async function listAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listAgentsQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw createError(400, 'Invalid query', { expose: true, cause: z.flattenError(query.error) });
    }
    const { agentService, baseUrl } = req.app.locals.context;
    const result = agentService.list(query.data);
    res.json({ ...result, items: result.items.map((agent) => toAgentResponse(agent, baseUrl)) });
  } catch (err) {
    next(err);
  }
}

/** `GET /agents/:id`: one agent; a 404 for an id no agent has. */
export async function getAgent(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = noQuery.safeParse(req.query);
    if (!query.success) {
      throw createError(400, 'Invalid query', { expose: true, cause: z.flattenError(query.error) });
    }
    const { agentService, baseUrl } = req.app.locals.context;
    res.json(toAgentResponse(agentService.get(req.params.id), baseUrl));
  } catch (err) {
    next(toHttpError(err));
  }
}

/** `POST /agents`: creates an agent on a registered harness and opens its A2A endpoints; 201 with the agent. */
export async function createAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createAgentSchema.safeParse(req.body);
    if (!body.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(body.error) });
    }
    const { agentService, baseUrl } = req.app.locals.context;
    res.status(201).json(toAgentResponse(await agentService.create(body.data), baseUrl));
  } catch (err) {
    next(toHttpError(err));
  }
}

/** `PATCH /agents/:id`: changes the agent's name, description, instructions, skills or model; 200 with the agent. */
export async function updateAgent(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateAgentSchema.safeParse(req.body);
    if (!body.success) {
      throw createError(400, 'Invalid body', { expose: true, cause: z.flattenError(body.error) });
    }
    const { agentService, baseUrl } = req.app.locals.context;
    res.json(toAgentResponse(agentService.update(req.params.id, body.data), baseUrl));
  } catch (err) {
    next(toHttpError(err));
  }
}

/** `DELETE /agents/:id`: deletes the agent and closes its A2A endpoints; 204 with no body. */
export async function deleteAgent(req: AgentRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    req.app.locals.context.agentService.delete(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(toHttpError(err));
  }
}
