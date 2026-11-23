/** Thrown at start when a required environment variable is unset or empty. */
export class MissingEnvironmentVariableError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(`${variable} is not set: add it to the root .env (see .env.example)`);
    this.name = 'MissingEnvironmentVariableError';
    this.variable = variable;
  }
}
