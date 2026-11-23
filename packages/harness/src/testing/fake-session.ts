import type { HarnessEvent } from '../harness-event.ts';
import { Session } from '../session.ts';

/** A session that yields a scripted list of events each turn, and records the inputs it was given. */
export class FakeSession extends Session {
  readonly inputs: string[] = [];
  readonly #events: readonly HarnessEvent[];
  readonly #idAfterFirstTurn: string;

  constructor(id: string | undefined, idAfterFirstTurn: string, events: readonly HarnessEvent[]) {
    super(id);
    this.#idAfterFirstTurn = idAfterFirstTurn;
    this.#events = events;
  }

  // Async to match the SDK drivers, though nothing here waits.
  // eslint-disable-next-line @typescript-eslint/require-await
  override async *runTurn(input: string): AsyncIterable<HarnessEvent> {
    this.inputs.push(input);
    this.id ??= this.#idAfterFirstTurn;
    yield* this.#events;
  }
}
