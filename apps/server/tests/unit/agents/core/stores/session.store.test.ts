import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../../../../src/agents/core/stores/session.store.ts';

describe('SessionStore', () => {
  it('returns the session saved for a context, and none for a context without one', () => {
    const store = new SessionStore();

    store.set('context-1', 'session-1');

    expect(store.get('context-1')).toBe('session-1');
    expect(store.get('context-2')).toBeUndefined();
  });

  it('keeps the latest session of a context', () => {
    const store = new SessionStore();
    store.set('context-1', 'session-1');

    store.set('context-1', 'session-2');

    expect(store.get('context-1')).toBe('session-2');
  });
});
