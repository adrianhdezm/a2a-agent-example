import { describe, expect, it } from 'vitest';
import { weatherInstructions } from '../../../src/prompts/weather.prompt.ts';

describe('weather.prompt', () => {
  it('dates the instructions, so "tomorrow" means something', () => {
    const instructions = weatherInstructions(new Date('2026-11-24T10:00:00Z'));

    expect(instructions).toContain('Today is 2026-11-24 (UTC)');
  });
});
