import { describe, expect, it, vi } from 'vitest';
import { agentCardHandler, agentJsonRpcHandler } from '../../../src/middlewares/a2a.middleware.ts';
import type { AppContext } from '../../../src/models/app-context.model.ts';
import { mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';

function contextWith(endpoints: { card: unknown; jsonRpc: unknown } | undefined): AppContext {
  return { agentRuntime: { get: () => endpoints } } as unknown as AppContext;
}

describe('a2a.middleware', () => {
  it.each([
    ['agentCardHandler', agentCardHandler, 'card'],
    ['agentJsonRpcHandler', agentJsonRpcHandler, 'jsonRpc']
  ] as const)("%s hands the request to the agent's %s endpoint", (_name, handler, endpoint) => {
    const endpoints = { card: vi.fn(), jsonRpc: vi.fn() };
    const req = mockRequest<{ id: string }>({ context: contextWith(endpoints), params: { id: 'claude-coder' } });
    const { res } = mockResponse();
    const next = mockNext();

    handler(req, res, next);

    expect(endpoints[endpoint]).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards an exposed 404 for an agent with no endpoints open', () => {
    const next = mockNext();

    agentJsonRpcHandler(
      mockRequest<{ id: string }>({ context: contextWith(undefined), params: { id: 'missing' } }),
      mockResponse().res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, expose: true, message: 'Agent not found: missing' }));
  });
});
