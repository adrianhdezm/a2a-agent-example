import { ConfigError } from '../models/config.model.ts';

type Environment = Record<string, string | undefined>;

/** Reads `PORT` as an integer from 1 to 65535. Unset or empty throws a `ConfigError`: configuration has no fallback values. */
export function readPort(env: Environment): number {
  const value = env.PORT;
  if (value === undefined || value === '') {
    throw new ConfigError('PORT', 'is not set');
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT', 'must be an integer from 1 to 65535');
  }
  return port;
}
