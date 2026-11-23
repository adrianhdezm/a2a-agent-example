import type { Request, Response } from 'express';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { AppContext } from '../../src/models/app-context.model.ts';

export interface MockLog {
  readonly warn: Mock;
  readonly error: Mock;
}

export function mockLog(): MockLog {
  return { warn: vi.fn(), error: vi.fn() };
}

interface MockRequestOptions {
  context?: AppContext;
  query?: Record<string, unknown>;
  log?: MockLog;
  method?: string;
  path?: string;
}

/** A request as a handler sees it: the context on `req.app.locals`, the query, the request's logger. */
export function mockRequest({ context, query = {}, log = mockLog(), method = 'GET', path = '/' }: MockRequestOptions = {}): Request {
  return { app: { locals: { context } }, query, log, method, path } as unknown as Request;
}

export interface MockResponse {
  readonly res: Response;
  readonly status: Mock;
  readonly json: Mock;
}

export function mockResponse(headersSent = false): MockResponse {
  const spies = { status: vi.fn(), json: vi.fn() };
  const res = { ...spies, headersSent } as unknown as Response;
  spies.status.mockReturnValue(res);
  spies.json.mockReturnValue(res);
  return { res, ...spies };
}

export function mockNext(): Mock {
  return vi.fn();
}
