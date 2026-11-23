import type { SessionConfig } from './session-config.ts';
import type { Session } from './session.ts';

/** A coding-agent runtime (an SDK) behind the harness abstraction. */
export abstract class Harness {
  /** The name agents refer to it by in the registry. */
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /** Starts a new session; its id is set once its first turn has run. */
  abstract startSession(config: SessionConfig): Session;

  /** Resumes the session the harness knows by `id`. */
  abstract resumeSession(id: string, config: SessionConfig): Session;
}
