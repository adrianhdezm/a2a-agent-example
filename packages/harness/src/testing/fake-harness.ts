import { Harness } from '../harness.ts';
import type { HarnessEvent } from '../harness-event.ts';
import type { SessionConfig } from '../session-config.ts';
import { FakeSession } from './fake-session.ts';

export interface ResumedSession {
  id: string;
  config: SessionConfig;
}

/**
 * A harness for tests: every session it hands out yields `events` each turn, and a new session takes the id
 * `fake-session-<n>` after its first turn. It records what it was asked to start and resume.
 */
export class FakeHarness extends Harness {
  readonly started: SessionConfig[] = [];
  readonly resumed: ResumedSession[] = [];
  readonly sessions: FakeSession[] = [];
  readonly #events: readonly HarnessEvent[];

  constructor(name: string, events: readonly HarnessEvent[]) {
    super(name);
    this.#events = events;
  }

  override startSession(config: SessionConfig): FakeSession {
    this.started.push(config);
    return this.#track(new FakeSession(undefined, `fake-session-${String(this.started.length)}`, this.#events));
  }

  override resumeSession(id: string, config: SessionConfig): FakeSession {
    this.resumed.push({ id, config });
    return this.#track(new FakeSession(id, id, this.#events));
  }

  #track(session: FakeSession): FakeSession {
    this.sessions.push(session);
    return session;
  }
}
