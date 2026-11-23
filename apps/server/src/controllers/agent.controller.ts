import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { z } from 'zod';
import { summarizeAgent } from '../helpers/agent-url.helper.ts';
import { AgentRegistryError } from '../models/agent.model.ts';

const noQuery = z.strictObject({});

/** `GET /agents`: every registered agent, with the URL of its card. Takes no query params. */
export async function listAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = noQuery.safeParse(req.query);
    if (!query.success) {
      throw createError(400, `Unknown query params: ${Object.keys(req.query).join(', ')}`, {
        expose: true,
        cause: z.flattenError(query.error)
      });
    }
    const { agentRegistry, baseUrl } = req.app.locals.context;
    res.json(agentRegistry.list().map((agent) => summarizeAgent(agent, baseUrl)));
  } catch (err) {
    next(err);
  }
}

/** `GET /agents/:id`: one agent, with the URL of its card; a 404 for an id no agent has. Takes no query params. */
export async function getAgent(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = noQuery.safeParse(req.query);
    if (!query.success) {
      throw createError(400, `Unknown query params: ${Object.keys(req.query).join(', ')}`, {
        expose: true,
        cause: z.flattenError(query.error)
      });
    }
    const { agentRegistry, baseUrl } = req.app.locals.context;
    res.json(summarizeAgent(agentRegistry.get(req.params.id), baseUrl));
  } catch (err) {
    next(
      err instanceof AgentRegistryError && err.reason === 'unknown-id'
        ? createError(404, `Agent not found: ${err.agentId}`, { expose: true, cause: err })
        : err
    );
  }
}
