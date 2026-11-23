import { describe, expect, it } from 'vitest';
import { createAgent, deleteAgent, getAgent, listAgents, updateAgent } from '../../../src/controllers/agent.controller.ts';
import { agentInput, instant } from '../../utils/agent-seed.ts';
import { mockNext, mockRequest, mockResponse } from '../../utils/http-mocks.ts';
import { testContext } from '../../utils/test-context.ts';

const baseUrl = 'http://localhost:4000';

describe('agent.controller', () => {
  describe('listAgents', () => {
    it('answers one page of the agents in the list envelope, with the URL of each card', async () => {
      const { context } = await testContext(baseUrl);
      const { res, json } = mockResponse();

      await listAgents(mockRequest({ context, query: { pageSize: '1', sortField: 'id', sortDirection: 'ASC' } }), res, mockNext());

      expect(json).toHaveBeenCalledWith({
        items: [expect.objectContaining({ id: 'first-coder', cardUrl: `${baseUrl}/agents/first-coder/.well-known/agent-card.json` })],
        total: 2,
        page: 1,
        pageSize: 1,
        totalPages: 2
      });
    });

    it('forwards an exposed 400 for a query param it does not take', async () => {
      const { context } = await testContext(baseUrl);
      const { res, json } = mockResponse();
      const next = mockNext();

      await listAgents(mockRequest({ context, query: { harness: 'claude' } }), res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, expose: true, message: 'Invalid query' }));
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('getAgent', () => {
    it('answers the agent with the URL of its card', async () => {
      const { context } = await testContext(baseUrl);
      const { res, json } = mockResponse();

      await getAgent(mockRequest({ context, params: { id: 'second-coder' } }), res, mockNext());

      expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'second-coder', workspace: '/srv/workspaces/second-coder' }));
    });

    it('forwards an exposed 404 for an id no agent has', async () => {
      const { context } = await testContext(baseUrl);
      const next = mockNext();

      await getAgent(mockRequest({ context, params: { id: 'missing' } }), mockResponse().res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, expose: true, message: 'No agent exists as "missing"' }));
    });
  });

  describe('createAgent', () => {
    it('answers 201 with the created agent', async () => {
      const { context } = await testContext(baseUrl);
      const { res, status, json } = mockResponse();

      await createAgent(mockRequest({ context, body: agentInput({ id: 'third-coder' }) }), res, mockNext());

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'third-coder', createdAt: instant(2) }));
    });

    it('forwards an exposed 400 for an invalid body without creating anything', async () => {
      const { context } = await testContext(baseUrl);
      const next = mockNext();

      await createAgent(
        mockRequest({ context, body: { ...agentInput({ id: 'third-coder' }), workspace: '/etc' } }),
        mockResponse().res,
        next
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, message: 'Invalid body' }));
      expect(() => context.agentService.get('third-coder')).toThrow();
    });

    it.each([
      ['409 for an id already taken', { id: 'first-coder' }, 409, 'An agent already exists as "first-coder"'],
      [
        '400 for a harness that is not registered',
        { id: 'gemini-coder', harness: 'gemini' },
        400,
        'Agent "gemini-coder" names the harness "gemini", which is not registered'
      ]
    ])('forwards an exposed %s', async (_case, overrides, status, message) => {
      const { context } = await testContext(baseUrl);
      const next = mockNext();

      await createAgent(mockRequest({ context, body: agentInput(overrides) }), mockResponse().res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status, expose: true, message }));
    });
  });

  describe('updateAgent', () => {
    it('answers the agent with the changes applied', async () => {
      const { context } = await testContext(baseUrl);
      const { res, json } = mockResponse();

      await updateAgent(
        mockRequest({ context, params: { id: 'first-coder' }, body: { instructions: 'Write tests first.' } }),
        res,
        mockNext()
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'first-coder', instructions: 'Write tests first.', updatedAt: instant(2) })
      );
    });

    it.each([
      ['400 for a change to the harness', { id: 'first-coder' }, { harness: 'codex' }, 400],
      ['400 for no change at all', { id: 'first-coder' }, {}, 400],
      ['404 for an id no agent has', { id: 'missing' }, { name: 'Ghost' }, 404]
    ])('forwards an exposed %s', async (_case, params, body, status) => {
      const { context } = await testContext(baseUrl);
      const next = mockNext();

      await updateAgent(mockRequest({ context, params, body }), mockResponse().res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status, expose: true }));
    });
  });

  describe('deleteAgent', () => {
    it('answers 204 with no body', async () => {
      const { context } = await testContext(baseUrl);
      const { res, status, end } = mockResponse();

      await deleteAgent(mockRequest({ context, params: { id: 'first-coder' } }), res, mockNext());

      expect(status).toHaveBeenCalledWith(204);
      expect(end).toHaveBeenCalledWith();
    });

    it('forwards an exposed 404 for an id no agent has', async () => {
      const { context } = await testContext(baseUrl);
      const next = mockNext();

      await deleteAgent(mockRequest({ context, params: { id: 'missing' } }), mockResponse().res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });
});
