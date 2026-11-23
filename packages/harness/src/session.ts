import type { HarnessEvent } from './harness-event.ts';

/** One conversation with an agent on a harness, run one turn at a time. */
export abstract class Session {
  /** The harness's own session id: known after the first turn, or from the start when the session was resumed. */
  id: string | undefined;

  constructor(id: string | undefined) {
    this.id = id;
  }

  /** Runs one turn with the user's input, yielding events until (and including) `turn.ended`. */
  abstract runTurn(input: string): AsyncIterable<HarnessEvent>;
}
