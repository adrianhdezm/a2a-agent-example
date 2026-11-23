import { describe, expect, it } from 'vitest';
import { AgentStore } from '../../../src/stores/agent.store.ts';
import { agent, instant } from '../../utils/agent-seed.ts';

const firstPage = { page: 1, pageSize: 20, sortField: 'createdAt', sortDirection: 'ASC' } as const;

function storeWith(...agents: ReturnType<typeof agent>[]): AgentStore {
  const store = new AgentStore();
  for (const stored of agents) {
    store.create(stored);
  }
  return store;
}

describe('AgentStore', () => {
  it('returns a created agent by id', () => {
    const stored = agent();

    expect(storeWith(stored).get('claude-coder')).toBe(stored);
  });

  it('rejects a second agent under an id already taken', () => {
    const store = storeWith(agent());

    expect(() => {
      store.create(agent());
    }).toThrow(expect.objectContaining({ name: 'AgentError', reason: 'duplicate-id', agentId: 'claude-coder' }));
  });

  it.each([
    ['get', (store: AgentStore) => store.get('missing')],
    [
      'update',
      (store: AgentStore) => {
        store.update(agent({ id: 'missing' }));
      }
    ],
    [
      'delete',
      (store: AgentStore) => {
        store.delete('missing');
      }
    ]
  ])('throws an unknown-id error from %s for an id no agent has', (_method, call) => {
    expect(() => {
      call(new AgentStore());
    }).toThrow(expect.objectContaining({ reason: 'unknown-id', agentId: 'missing' }));
  });

  it('replaces an agent on update and forgets it on delete', () => {
    const store = storeWith(agent());

    store.update(agent({ instructions: 'Write tests first.' }));
    expect(store.get('claude-coder').instructions).toBe('Write tests first.');

    store.delete('claude-coder');
    expect(store.list(firstPage).total).toBe(0);
  });

  describe('list', () => {
    const store = storeWith(
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
      expect(store.list({ ...firstPage, sortField, sortDirection }).items.map(({ id }) => id)).toEqual(ids);
    });

    it('answers one page with the totals of the whole list', () => {
      const page = store.list({ ...firstPage, page: 2, pageSize: 2 });

      expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
      expect(page.items.map(({ id }) => id)).toEqual(['charlie']);
    });

    it('answers an empty page past the end', () => {
      expect(store.list({ ...firstPage, page: 5 })).toMatchObject({ items: [], total: 3, totalPages: 1 });
    });
  });
});
