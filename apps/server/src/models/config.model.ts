/** What the server needs from its environment. */
export interface ServerConfig {
  port: number;
  anthropicApiKey: string;
  codexApiKey: string;
}

/** Why an environment variable cannot be used: it is unset or empty, or its value is not one the server accepts. */
export type ConfigErrorDetails = { reason: 'missing'; variable: string } | { reason: 'invalid'; variable: string; expected: string };

function messageFor(details: ConfigErrorDetails): string {
  return details.reason === 'missing'
    ? `${details.variable} is not set: add it to the root .env (see .env.example)`
    : `${details.variable} must be ${details.expected}`;
}

/** Thrown at start by `readConfig`; `reason` and `variable` say what to fix in the root `.env`. */
export class ConfigError extends Error {
  readonly reason: ConfigErrorDetails['reason'];
  readonly variable: string;

  constructor(details: ConfigErrorDetails) {
    super(messageFor(details));
    this.name = 'ConfigError';
    this.reason = details.reason;
    this.variable = details.variable;
  }
}
