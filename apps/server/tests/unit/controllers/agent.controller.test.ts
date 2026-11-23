import { describe, expect, it } from 'vitest';
import { getAgent, listAgents } from '../../../src/controllers/agent.controller.ts';
import { mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';
import { testContext } from '../../utils/test-context.ts';

describe('agent.controller', () => {
  describe('listAgents', () => {
    it('answers every registered agent with the URL of its card', async () => {
      const { res, json } = mockResponse();
      const next = mockNext();

      await listAgents(mockRequest({ context: testContext('http://localhost:4000') }), res, next);

      expect(json).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'first-coder', cardUrl: 'http://localhost:4000/agents/first-coder/.well-known/agent-card.json' }),
        expect.objectContaining({ id: 'second-coder', cardUrl: 'http://localhost:4000/agents/second-coder/.well-known/agent-card.json' })
      ]);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards an exposed 400 naming the unknown query params without answering', async () => {
      const { res, json } = mockResponse();
      const next = mockNext();

      await listAgents(mockRequest({ context: testContext('http://localhost:4000'), query: { harness: 'claude', page: '2' } }), res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400, expose: true, message: 'Unknown query params: harness, page' })
      );
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('getAgent', () => {
    it('answers the agent with the URL of its card', async () => {
      const { res, json } = mockResponse();
      const next = mockNext();

      await getAgent(mockRequest({ context: testContext('http://localhost:4000'), params: { id: 'second-coder' } }), res, next);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'second-coder', cardUrl: 'http://localhost:4000/agents/second-coder/.well-known/agent-card.json' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards an exposed 404 for an id no agent has', async () => {
      const { res, json } = mockResponse();
      const next = mockNext();

      await getAgent(mockRequest({ context: testContext('http://localhost:4000'), params: { id: 'missing' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, expose: true, message: 'Agent not found: missing' }));
      expect(json).not.toHaveBeenCalled();
    });

    it('forwards an exposed 400 for a query param', async () => {
      const next = mockNext();

      await getAgent(
        mockRequest({ context: testContext('http://localhost:4000'), params: { id: 'first-coder' }, query: { full: '1' } }),
        mockResponse().res,
        next
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, message: 'Unknown query params: full' }));
    });
  });
});
