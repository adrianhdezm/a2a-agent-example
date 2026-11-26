import { ConfigError } from '../models/config.model.ts';
import type { RunnerChoice } from '../models/config.model.ts';

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

/**
 * Reads which runner an agent runs on: `<prefix>_RUNNER`, which must be set, and `<prefix>_MODEL`, which may be left
 * unset for the runner's own default. Which names and models are valid is the runner's to say, when the agent starts.
 */
export function readRunner(env: Environment, prefix: string): RunnerChoice {
  const name = env[`${prefix}_RUNNER`];
  if (name === undefined || name === '') {
    throw new ConfigError(`${prefix}_RUNNER`, 'is not set: claude, codex or pi');
  }
  const model = env[`${prefix}_MODEL`];
  return model === undefined || model === '' ? { name } : { name, model };
}
