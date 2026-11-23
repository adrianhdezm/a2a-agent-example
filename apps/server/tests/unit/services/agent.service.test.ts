import { describe, expect, it } from 'vitest';
import { instant, agentInput } from '../../utils/agent-seed.ts';
import { testContext } from '../../utils/test-context.ts';

const page = { page: 1, pageSize: 20, sortField: 'createdAt', sortDirection: 'ASC' } as const;

describe('AgentService', () => {
  describe('create', () => {
    it('stores the agent in its own workspace with its creation time and opens its endpoints', async () => {
      // Arrange
      const { context, workspaces } = await testContext('http://localhost:4000');

      // Act
      const created = await context.agentService.create(agentInput({ id: 'third-coder' }));

      // Assert
      expect(created).toMatchObject({
        id: 'third-coder',
        workspace: '/srv/workspaces/third-coder',
        createdAt: instant(2),
        updatedAt: instant(2)
      });
      expect(context.agentService.get('third-coder')).toEqual(created);
      expect(workspaces).toContain('/srv/workspaces/third-coder');
      expect(context.agentRuntime.get('third-coder')).toBeDefined();
    });

    it('rejects a harness that is not registered, creating nothing', async () => {
      const { context, workspaces } = await testContext('http://localhost:4000');

      await expect(context.agentService.create(agentInput({ id: 'gemini-coder', harness: 'gemini' }))).rejects.toThrow(
        expect.objectContaining({ reason: 'unknown-harness', agentId: 'gemini-coder' })
      );
      expect(context.agentService.list(page).total).toBe(2);
      expect(workspaces).not.toContain('/srv/workspaces/gemini-coder');
    });

    it('rejects an id already taken, keeping the agent that has it', async () => {
      const { context } = await testContext('http://localhost:4000');

      await expect(context.agentService.create(agentInput({ id: 'first-coder', name: 'Impostor' }))).rejects.toThrow(
        expect.objectContaining({ reason: 'duplicate-id' })
      );
      expect(context.agentService.get('first-coder').name).toBe('First Coder');
    });
  });

  describe('update', () => {
    it('applies the changes with a new update time and reopens the endpoints with them', async () => {
      const { context } = await testContext('http://localhost:4000');

      const updated = context.agentService.update('first-coder', { instructions: 'Write tests first.' });

      expect(updated).toMatchObject({ instructions: 'Write tests first.', harness: 'fake', createdAt: instant(0), updatedAt: instant(2) });
      const card = await context.agentRuntime.get('first-coder')?.requestHandler.getAgentCard();
      expect(card?.name).toBe('First Coder');
    });
  });

  describe('delete', () => {
    it('removes the agent and closes its endpoints', async () => {
      const { context } = await testContext('http://localhost:4000');

      context.agentService.delete('first-coder');

      expect(() => context.agentService.get('first-coder')).toThrow(expect.objectContaining({ reason: 'unknown-id' }));
      expect(context.agentRuntime.get('first-coder')).toBeUndefined();
    });
  });
});
