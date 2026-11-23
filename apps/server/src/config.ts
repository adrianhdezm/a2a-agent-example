import { ConfigError } from './errors/config-error.ts';

/** What the server needs from its environment. */
export interface ServerConfig {
  port: number;
  anthropicApiKey: string;
  codexApiKey: string;
}

type Environment = Record<string, string | undefined>;

/** Reads the configuration once, throwing for any variable that is missing or unusable: there are no fallbacks. */
export function readConfig(env: Environment): ServerConfig {
  return {
    port: readPort(env),
    anthropicApiKey: required(env, 'ANTHROPIC_API_KEY'),
    codexApiKey: required(env, 'CODEX_API_KEY')
  };
}

function required(env: Environment, variable: string): string {
  const value = env[variable];
  if (value === undefined || value === '') {
    throw new ConfigError({ reason: 'missing', variable });
  }
  return value;
}

function readPort(env: Environment): number {
  const port = Number(required(env, 'PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError({ reason: 'invalid', variable: 'PORT', expected: 'an integer from 1 to 65535' });
  }
  return port;
}
