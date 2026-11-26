import { describe, expect, it } from 'vitest';
import { readTurnEnd, turnEndInstructions } from '../../../src/prompts/turn-end.prompt.ts';

describe('turn-end.prompt', () => {
  it('asks for one of the two markers on the last line', () => {
    expect(turnEndInstructions).toContain('"COMPLETED" or "AWAITING_USER_INPUT"');
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
