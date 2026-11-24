import type { RequestHandler } from 'express';
import createError from 'http-errors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(createError(404, `Not Found: ${req.method} ${req.path}`, { expose: true }));
};
