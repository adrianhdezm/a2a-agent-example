/** Thrown at start when an environment variable is set to a value the server cannot use. */
export class InvalidEnvironmentVariableError extends Error {
  readonly variable: string;

  constructor(variable: string, expected: string) {
    super(`${variable} must be ${expected}`);
    this.name = 'InvalidEnvironmentVariableError';
    this.variable = variable;
  }
}
