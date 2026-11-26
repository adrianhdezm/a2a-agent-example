import type { Part } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { renderPart, renderParts } from '../src/parts.ts';
import { tagStyle, text } from './utils/a2a-seed.ts';

const part = (content: Part['content'], mediaType = '', filename = ''): Part => ({ content, metadata: undefined, filename, mediaType });

describe('parts', () => {
  it.each([
    ['text as it is', text('Take an umbrella.'), 'Take an umbrella.'],
    [
      'a link with its type',
      part({ $case: 'url', value: 'https://example.com/map.png' }, 'image/png'),
      '<blue>[link] https://example.com/map.png<dim>, image/png'
    ],
    [
      'raw bytes by size, type and name',
      part({ $case: 'raw', value: Buffer.from('abcd') }, 'image/png', 'map.png'),
      '<blue>[4 bytes, image/png, map.png]'
    ],
    ['data as indented JSON', part({ $case: 'data', value: { tempC: 15 } }), '<yellow>[data]\n{\n  "tempC": 15\n}']
  ])('renders %s', (_case, value, rendered) => {
    expect(renderPart(value, tagStyle)).toBe(rendered);
  });

  it('renders nothing for a part without content', () => {
    expect(renderPart(part(undefined), tagStyle)).toBeUndefined();
  });

  it('renders every part, one after the other', () => {
    expect(renderParts([text('Rain all day.'), part(undefined), text('Take an umbrella.')], tagStyle)).toBe(
      'Rain all day.\nTake an umbrella.'
    );
    expect(renderParts(undefined, tagStyle)).toBe('');
  });
});
