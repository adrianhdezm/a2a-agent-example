import { describe, expect, it } from 'vitest';
import { AgentRegistry } from '../../../src/registries/agent.registry.ts';
import { agent, instant } from '../../utils/agent-seed.ts';

const firstPage = { page: 1, pageSize: 20, sortField: 'createdAt', sortDirection: 'ASC' } as const;

function registryWith(...agents: ReturnType<typeof agent>[]): AgentRegistry {
  const registry = new AgentRegistry();
  for (const stored of agents) {
    registry.create(stored);
  }
  return registry;
}

describe('AgentRegistry', () => {
  it('returns a created agent by id', () => {
    const stored = agent();

    expect(registryWith(stored).get('claude-coder')).toBe(stored);
  });

  it('rejects a second agent under an id already taken', () => {
    const registry = registryWith(agent());

    expect(() => {
      registry.create(agent());
    }).toThrow(expect.objectContaining({ name: 'AgentError', reason: 'duplicate-id', agentId: 'claude-coder' }));
  });

  it.each([
    ['get', (registry: AgentRegistry) => registry.get('missing')],
    [
      'update',
      (registry: AgentRegistry) => {
        registry.update(agent({ id: 'missing' }));
      }
    ],
    [
      'delete',
      (registry: AgentRegistry) => {
        registry.delete('missing');
      }
    ]
  ])('throws an unknown-id error from %s for an id no agent has', (_method, call) => {
    expect(() => {
      call(new AgentRegistry());
    }).toThrow(expect.objectContaining({ reason: 'unknown-id', agentId: 'missing' }));
  });

  it('replaces an agent on update and forgets it on delete', () => {
    const registry = registryWith(agent());

    registry.update(agent({ instructions: 'Write tests first.' }));
    expect(registry.get('claude-coder').instructions).toBe('Write tests first.');

    registry.delete('claude-coder');
    expect(registry.list(firstPage).total).toBe(0);
  });

  describe('list', () => {
    const registry = registryWith(
      agent({ id: 'bravo', name: 'Alpha', createdAt: instant(2) }),
      agent({ id: 'alpha', name: 'Charlie', createdAt: instant(1) }),
      agent({ id: 'charlie', name: 'Alpha', createdAt: instant(3) })
    );

    it.each([
      ['createdAt', 'ASC', ['alpha', 'bravo', 'charlie']],
      ['createdAt', 'DESC', ['charlie', 'bravo', 'alpha']],
      ['id', 'DESC', ['charlie', 'bravo', 'alpha']],
      ['name', 'ASC', ['bravo', 'charlie', 'alpha']]
    ] as const)('sorts by %s %s, the id breaking ties', (sortField, sortDirection, ids) => {
      expect(registry.list({ ...firstPage, sortField, sortDirection }).items.map(({ id }) => id)).toEqual(ids);
    });

    it('answers one page with the totals of the whole list', () => {
      const page = registry.list({ ...firstPage, page: 2, pageSize: 2 });

      expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
      expect(page.items.map(({ id }) => id)).toEqual(['charlie']);
    });

    it('answers an empty page past the end', () => {
      expect(registry.list({ ...firstPage, page: 5 })).toMatchObject({ items: [], total: 3, totalPages: 1 });
    });
  });
});
