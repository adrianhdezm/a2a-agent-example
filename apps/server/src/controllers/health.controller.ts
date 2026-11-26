import type { NextFunction, Request, Response } from 'express';

/** `GET /health`: the server is up. It has no dependency to probe: Claude and Open-Meteo are reached per turn. */
export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}
