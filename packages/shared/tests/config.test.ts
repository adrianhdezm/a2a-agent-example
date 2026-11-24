import { describe, expect, it } from 'vitest';
import { readPort, requireVariable } from '../src/config.ts';
import { ConfigError } from '../src/errors/config-error.ts';

describe('config', () => {
  it('reads a variable that is set', () => {
    expect(requireVariable({ ANTHROPIC_API_KEY: 'sk-ant-test' }, 'ANTHROPIC_API_KEY')).toBe('sk-ant-test');
  });

  it.each([undefined, ''])('throws a ConfigError naming a variable set to %j', (value) => {
    expect(() => requireVariable({ ANTHROPIC_API_KEY: value }, 'ANTHROPIC_API_KEY')).toThrow(
      expect.objectContaining({ name: 'ConfigError', variable: 'ANTHROPIC_API_KEY' })
    );
  });

  it('reads the port as a number', () => {
    expect(readPort({ PORT: '41241' })).toBe(41241);
  });

  it.each(['forty', '4.5', '0', '70000'])('rejects the port %j', (port) => {
    expect(() => readPort({ PORT: port })).toThrow(ConfigError);
  });
});
