import type { ErrorRequestHandler } from 'express';
import createError from 'http-errors';

/** Answers every error of the server's own routes as `{ status: 'error', message }`, logged on the request's logger. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const httpError = createError.isHttpError(err) ? err : undefined;
  const status = httpError?.status ?? 500;
  const message = httpError?.expose ? httpError.message : 'Internal Server Error';
  if (status >= 500) {
    req.log.error({ err }, message);
  } else {
    req.log.warn({ err }, message);
  }
  res.status(status).json({ status: 'error', message });
};
