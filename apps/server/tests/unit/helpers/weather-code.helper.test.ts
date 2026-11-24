import { describe, expect, it } from 'vitest';
import { describeWeatherCode } from '../../../src/helpers/weather-code.helper.ts';

describe('describeWeatherCode', () => {
  it.each([
    [0, 'clear sky'],
    [61, 'light rain'],
    [95, 'thunderstorm'],
    [42, 'weather code 42']
  ])('describes code %i as %j', (code, words) => {
    expect(describeWeatherCode(code)).toBe(words);
  });
});
