import { describe, expect, it } from 'vitest';
import { readPort } from '../../../src/helpers/config.helper.ts';
import { ConfigError } from '../../../src/models/config.model.ts';

describe('config.helper', () => {
  it.each([undefined, ''])('throws a ConfigError naming PORT when it is set to %j', (value) => {
    expect(() => readPort({ PORT: value })).toThrow(expect.objectContaining({ name: 'ConfigError', variable: 'PORT' }));
  });

  it('reads the port as a number', () => {
    expect(readPort({ PORT: '41241' })).toBe(41241);
  });

  it.each(['forty', '4.5', '0', '70000'])('rejects the port %j', (port) => {
    expect(() => readPort({ PORT: port })).toThrow(ConfigError);
  });
});
