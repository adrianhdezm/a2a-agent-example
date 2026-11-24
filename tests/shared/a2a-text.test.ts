import type { Part } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { partsText, textPart } from '../../src/shared/a2a-text.ts';

describe('a2a-text', () => {
  it('makes a plain-text part', () => {
    expect(textPart('Take an umbrella.')).toEqual({
      content: { $case: 'text', value: 'Take an umbrella.' },
      metadata: undefined,
      filename: '',
      mediaType: 'text/plain'
    });
  });

  it('reads the text parts, one per line, leaving the others out', () => {
    const parts: Part[] = [
      textPart('Lisbon tomorrow?'),
      { content: { $case: 'url', value: 'https://example.com/map.png' }, metadata: undefined, filename: 'map.png', mediaType: 'image/png' },
      textPart('And on Friday?')
    ];

    expect(partsText(parts)).toBe('Lisbon tomorrow?\nAnd on Friday?');
  });

  it('reads no parts as no text', () => {
    expect(partsText(undefined)).toBe('');
  });
});
