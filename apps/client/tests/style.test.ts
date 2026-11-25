import { describe, expect, it } from 'vitest';
import { plainStyle } from '../src/style.ts';

describe('style', () => {
  it('leaves text as it is in the plain style', () => {
    expect(plainStyle('red', 'Request failed')).toBe('Request failed');
  });
});
