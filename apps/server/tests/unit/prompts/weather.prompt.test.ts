import { describe, expect, it } from 'vitest';
import { turnEndInstructions } from '../../../src/prompts/turn-end.prompt.ts';
import { weatherInstructions } from '../../../src/prompts/weather.prompt.ts';

describe('weather.prompt', () => {
  it('dates the instructions and ends them with the turn-end instructions', () => {
    const instructions = weatherInstructions(new Date('2026-11-24T10:00:00Z'));

    expect(instructions).toContain('Today is 2026-11-24 (UTC)');
    expect(instructions.endsWith(turnEndInstructions)).toBe(true);
  });
});
