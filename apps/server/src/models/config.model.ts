/** Thrown at start when an environment variable is missing or unusable; the message says what to fix in `.env`. */
export class ConfigError extends Error {
  readonly variable: string;

  constructor(variable: string, problem: string) {
    super(`${variable} ${problem}: set it in .env (see .env.example)`);
    this.name = 'ConfigError';
    this.variable = variable;
  }
}

/** A runner as configuration names it, for an agent's entry point to resolve. */
export interface RunnerChoice {
  name: string;
  model?: string;
}
