import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { z } from 'zod';
import { summarizeAgent } from '../agent-summary.ts';

const listAgentsQuery = z.strictObject({});

/** `GET /agents`: every registered agent, with the URL of its card. Takes no query params. */
export async function listAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listAgentsQuery.safeParse(req.query);
    if (!query.success) {
      throw createError(400, `Unknown query params: ${Object.keys(req.query).join(', ')}`, {
        expose: true,
        cause: z.flattenError(query.error)
      });
    }
    const { agents, baseUrl } = req.app.locals.context;
    res.json(agents.list().map((agent) => summarizeAgent(agent, baseUrl)));
  } catch (err) {
    next(err);
  }
}
