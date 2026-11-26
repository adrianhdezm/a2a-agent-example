import { describe, expect, it } from 'vitest';
import { turnEndInstructions } from '../../../src/prompts/turn-end.prompt.ts';

describe('turn-end.prompt', () => {
  it('asks for one of the two markers on the last line', () => {
    expect(turnEndInstructions).toContain('"COMPLETED" or "AWAITING_USER_INPUT"');
  });
});
