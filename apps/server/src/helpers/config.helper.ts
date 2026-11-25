import { ConfigError } from '../models/config.model.ts';

type Environment = Record<string, string | undefined>;

/** Reads a required variable; unset or empty throws a `ConfigError`, since configuration has no fallback values. */
export function requireVariable(env: Environment, variable: string): string {
  const value = env[variable];
  if (value === undefined || value === '') {
    throw new ConfigError(variable, 'is not set');
  }
  return value;
}

/** Reads `PORT` as an integer from 1 to 65535. */
export function readPort(env: Environment): number {
  const port = Number(requireVariable(env, 'PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT', 'must be an integer from 1 to 65535');
  }
  return port;
}
