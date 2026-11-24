import { describe, expect, it } from 'vitest';
import { readTurnEnd, weatherInstructions } from '../../../src/prompts/weather.prompt.ts';

describe('weather.prompt', () => {
  describe('weatherInstructions', () => {
    it("dates the instructions and asks for the turn's marker on the last line", () => {
      const instructions = weatherInstructions(new Date('2026-11-24T10:00:00Z'));

      expect(instructions).toContain('Today is 2026-11-24 (UTC)');
      expect(instructions).toContain('"COMPLETED" or "AWAITING_USER_INPUT"');
    });
  });

  describe('readTurnEnd', () => {
    it.each([
      ['an answer', 'Take an umbrella: 85% chance of rain.\nCOMPLETED', 'completed', 'Take an umbrella: 85% chance of rain.'],
      [
        'a question',
        'Springfield, Illinois or Springfield, Missouri?\n  awaiting_user_input  \n',
        'input-required',
        'Springfield, Illinois or Springfield, Missouri?'
      ],
      ['an answer without a marker', 'Sunny all week.', 'completed', 'Sunny all week.']
    ])('reads %s', (_case, answer, outcome, text) => {
      expect(readTurnEnd(answer)).toEqual({ outcome, text });
    });
  });
});
