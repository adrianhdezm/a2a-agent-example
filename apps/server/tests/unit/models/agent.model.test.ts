import { describe, expect, it } from 'vitest';
import { AgentError, createAgentSchema, listAgentsQuerySchema, updateAgentSchema } from '../../../src/models/agent.model.ts';
import { agentInput } from '../../utils/agent-seed.ts';

describe('agent.model', () => {
  describe('createAgentSchema', () => {
    it('accepts an agent with or without a model', () => {
      expect(createAgentSchema.safeParse(agentInput()).success).toBe(true);
      expect(createAgentSchema.safeParse(agentInput({ model: 'claude-sonnet-5-5' })).success).toBe(true);
    });

    it.each([
      ['an id that is not a slug', { ...agentInput(), id: 'Claude Coder' }],
      ['an empty name', { ...agentInput(), name: '' }],
      ['no instructions', { ...agentInput(), instructions: '' }],
      ['a field the API does not know', { ...agentInput(), workspace: '/etc' }],
      ['a skill with a field the API does not know', { ...agentInput(), skills: [{ ...agentInput().skills[0], level: 3 }] }]
    ])('rejects %s', (_case, body) => {
      expect(createAgentSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('updateAgentSchema', () => {
    it('accepts any one of the fields an agent may change', () => {
      expect(updateAgentSchema.safeParse({ instructions: 'Write tests first.' }).success).toBe(true);
    });

    it.each([
      ['no field', {}],
      ['the id', { id: 'other-coder' }],
      ['the harness', { harness: 'codex' }]
    ])('rejects a change with %s', (_case, body) => {
      expect(updateAgentSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('listAgentsQuerySchema', () => {
    it('reads the page, the page size and the sort from query strings, defaulting each', () => {
      expect(listAgentsQuerySchema.parse({ page: '2' })).toEqual({ page: 2, pageSize: 20, sortField: 'createdAt', sortDirection: 'DESC' });
    });

    it.each([{ pageSize: '101' }, { page: '0' }, { sortField: 'harness' }, { page: ['1', '2'] }, { filter: '{}' }])(
      'rejects %j',
      (query) => {
        expect(listAgentsQuerySchema.safeParse(query).success).toBe(false);
      }
    );
  });

  describe('AgentError', () => {
    it.each([
      [{ reason: 'duplicate-id', agentId: 'claude-coder' } as const, 'An agent already exists as "claude-coder"'],
      [{ reason: 'unknown-id', agentId: 'missing' } as const, 'No agent exists as "missing"'],
      [
        { reason: 'unknown-harness', agentId: 'gemini-coder', harness: 'gemini' } as const,
        'Agent "gemini-coder" names the harness "gemini", which is not registered'
      ]
    ])('says what %j broke', (details, message) => {
      expect(new AgentError(details)).toMatchObject({ name: 'AgentError', reason: details.reason, agentId: details.agentId, message });
    });
  });
});
