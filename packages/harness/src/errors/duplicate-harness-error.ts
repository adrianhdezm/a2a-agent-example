/** Thrown when a harness is registered under a name already taken. */
export class DuplicateHarnessError extends Error {
  readonly harnessName: string;

  constructor(harnessName: string) {
    super(`A harness is already registered as "${harnessName}"`);
    this.name = 'DuplicateHarnessError';
    this.harnessName = harnessName;
  }
}
