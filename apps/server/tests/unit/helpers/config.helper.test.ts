import { describe, expect, it } from 'vitest';
import { readConfig } from '../../../src/helpers/config.helper.ts';

const env = { PORT: '4000', ANTHROPIC_API_KEY: 'sk-ant-test', CODEX_API_KEY: 'sk-codex-test' };

describe('readConfig', () => {
  it('reads the port and both API keys', () => {
    expect(readConfig(env)).toEqual({ port: 4000, anthropicApiKey: 'sk-ant-test', codexApiKey: 'sk-codex-test' });
  });

  it.each(['PORT', 'ANTHROPIC_API_KEY', 'CODEX_API_KEY'])('throws naming %s when it is unset or empty', (variable) => {
    expect(() => readConfig({ ...env, [variable]: undefined })).toThrow(
      expect.objectContaining({ name: 'ConfigError', reason: 'missing', variable })
    );
    expect(() => readConfig({ ...env, [variable]: '' })).toThrow(
      expect.objectContaining({ name: 'ConfigError', reason: 'missing', variable })
    );
  });

  it.each(['four thousand', '4000.5', '0', '70000'])('rejects the port %j', (port) => {
    expect(() => readConfig({ ...env, PORT: port })).toThrow(
      expect.objectContaining({
        name: 'ConfigError',
        reason: 'invalid',
        variable: 'PORT',
        message: 'PORT must be an integer from 1 to 65535'
      })
    );
  });
});
