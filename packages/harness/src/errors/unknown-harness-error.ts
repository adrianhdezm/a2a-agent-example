/** Thrown when no harness is registered under the requested name. */
export class UnknownHarnessError extends Error {
  readonly harnessName: string;

  constructor(harnessName: string) {
    super(`No harness is registered as "${harnessName}"`);
    this.name = 'UnknownHarnessError';
    this.harnessName = harnessName;
  }
}
