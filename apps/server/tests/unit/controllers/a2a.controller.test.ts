import { describe, expect, it, vi } from 'vitest';
import { getAgentCard, handleAgentJsonRpc } from '../../../src/controllers/a2a.controller.ts';
import type { AppContext } from '../../../src/models/app-context.model.ts';
import { mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';

function contextWith(endpoints: { card: unknown; jsonRpc: unknown } | undefined): AppContext {
  return { agentRuntime: { get: () => endpoints } } as unknown as AppContext;
}

describe('a2a.controller', () => {
  it.each([
    ['getAgentCard', getAgentCard, 'card'],
    ['handleAgentJsonRpc', handleAgentJsonRpc, 'jsonRpc']
  ] as const)("%s hands the request to the agent's %s endpoint", async (_name, handler, endpoint) => {
    const endpoints = { card: vi.fn(), jsonRpc: vi.fn() };
    const req = mockRequest<{ id: string }>({ context: contextWith(endpoints), params: { id: 'claude-coder' } });
    const { res } = mockResponse();
    const next = mockNext();

    await handler(req, res, next);

    expect(endpoints[endpoint]).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['getAgentCard', getAgentCard],
    ['handleAgentJsonRpc', handleAgentJsonRpc]
  ] as const)('%s forwards an exposed 404 for an agent that does not exist', async (_name, handler) => {
    const next = mockNext();

    await handler(mockRequest<{ id: string }>({ context: contextWith(undefined), params: { id: 'missing' } }), mockResponse().res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, expose: true, message: 'Agent not found: missing' }));
  });

  it('forwards an error the SDK handler rejects with', async () => {
    const failure = new Error('task store unavailable');
    const endpoints = { card: vi.fn(), jsonRpc: vi.fn().mockRejectedValue(failure) };
    const next = mockNext();

    await handleAgentJsonRpc(
      mockRequest<{ id: string }>({ context: contextWith(endpoints), params: { id: 'claude-coder' } }),
      mockResponse().res,
      next
    );

    expect(next).toHaveBeenCalledWith(failure);
  });
});
