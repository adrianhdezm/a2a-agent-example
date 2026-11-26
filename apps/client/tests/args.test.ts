import { describe, expect, it } from 'vitest';
import { cardBaseUrl, parseCliArgs } from '../src/args.ts';
import { UsageError } from '../src/errors/usage-error.ts';

describe('parseCliArgs', () => {
  it('reads nothing as the default agent, compact', () => {
    expect(parseCliArgs([])).toEqual({ url: undefined, cardPath: undefined, verbose: false, help: false });
  });

  it('reads the url and every flag', () => {
    expect(parseCliArgs(['http://localhost:9999', '--card-path', 'card.json', '--verbose'])).toEqual({
      url: 'http://localhost:9999',
      cardPath: 'card.json',
      verbose: true,
      help: false
    });
  });

  it('reads --help', () => {
    expect(parseCliArgs(['--help']).help).toBe(true);
  });

  it.each([
    ['an unknown flag', ['--transport', 'GRPC']],
    ['two urls', ['http://a', 'http://b']],
    ['a flag missing its value', ['--card-path']]
  ])('throws a UsageError for %s', (_case, args) => {
    expect(() => parseCliArgs(args)).toThrow(UsageError);
  });
});

describe('cardBaseUrl', () => {
  it('ends the url with a slash, so the default card path resolves beneath it', () => {
    expect(cardBaseUrl('http://localhost:41241/agents/weather', undefined)).toBe('http://localhost:41241/agents/weather/');
    expect(cardBaseUrl('http://localhost:41241/agents/weather/', undefined)).toBe('http://localhost:41241/agents/weather/');
  });

  it('takes the url as it is when a card path is given', () => {
    expect(cardBaseUrl('https://example.com/my-card.json', '')).toBe('https://example.com/my-card.json');
  });
});
