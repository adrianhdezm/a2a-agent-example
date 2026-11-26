import { describe, expect, it } from 'vitest';
import { readPort, readRunner } from '../../../src/helpers/config.helper.ts';
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

  describe('readRunner', () => {
    it.each([undefined, ''])('throws a ConfigError naming <prefix>_RUNNER when it is set to %j', (value) => {
      expect(() => readRunner({ WEATHER_AGENT_RUNNER: value }, 'WEATHER_AGENT')).toThrow(
        expect.objectContaining({ name: 'ConfigError', variable: 'WEATHER_AGENT_RUNNER' })
      );
    });

    it('reads the runner, and the model when one is set', () => {
      expect(readRunner({ WEATHER_AGENT_RUNNER: 'codex', WEATHER_AGENT_MODEL: '' }, 'WEATHER_AGENT')).toEqual({ name: 'codex' });
      expect(readRunner({ TRIP_PLANNER_RUNNER: 'pi', TRIP_PLANNER_MODEL: 'anthropic/claude-sonnet-4-6' }, 'TRIP_PLANNER')).toEqual({
        name: 'pi',
        model: 'anthropic/claude-sonnet-4-6'
      });
    });
  });
});
