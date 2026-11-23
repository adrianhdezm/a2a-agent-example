import { DuplicateHarnessError } from './errors/duplicate-harness-error.ts';
import { UnknownHarnessError } from './errors/unknown-harness-error.ts';
import type { Harness } from './harness.ts';

/** The harnesses agents can run on, by name. */
export class HarnessRegistry {
  readonly #harnesses = new Map<string, Harness>();

  /** Adds a harness under its name; throws `DuplicateHarnessError` if the name is taken. */
  register(harness: Harness): void {
    if (this.#harnesses.has(harness.name)) {
      throw new DuplicateHarnessError(harness.name);
    }
    this.#harnesses.set(harness.name, harness);
  }

  has(name: string): boolean {
    return this.#harnesses.has(name);
  }

  /** Returns the harness registered as `name`; throws `UnknownHarnessError` if there is none. */
  get(name: string): Harness {
    const harness = this.#harnesses.get(name);
    if (harness === undefined) {
      throw new UnknownHarnessError(name);
    }
    return harness;
  }
}
