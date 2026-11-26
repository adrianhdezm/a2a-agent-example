/**
 * The Claude session of each A2A context, kept in memory: the agent's only state besides the SDK's task store. A
 * store that outlives a restart replaces it behind the same `get` and `set`.
 */
export class SessionStore {
  readonly #sessions = new Map<string, string>();

  /** The Claude session the context's last turn ran in, or undefined before its first turn. */
  get(contextId: string): string | undefined {
    return this.#sessions.get(contextId);
  }

  set(contextId: string, sessionId: string): void {
    this.#sessions.set(contextId, sessionId);
  }
}
