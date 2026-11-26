import { describe, expect, it } from 'vitest';
import { answerJsonSchema, readAnswer, readAnswerText, toolCallProgress } from '../../../../../src/agents/core/helpers/answer.helper.ts';

const malformed = { type: 'result', ok: false, error: 'the answer did not match its output format' };

describe('answer.helper', () => {
  it('describes the answer as strict JSON Schema draft 7: an outcome and a text, both required, nothing else', () => {
    expect(answerJsonSchema()).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { outcome: { enum: ['completed', 'input-required'] }, text: { type: 'string' } },
      required: ['outcome', 'text'],
      additionalProperties: false
    });
  });

  it.each([
    ['an answer', { outcome: 'completed', text: 'Sunny.' }, { type: 'result', ok: true, outcome: 'completed', text: 'Sunny.' }],
    ['a question', { outcome: 'input-required', text: 'Where?' }, { type: 'result', ok: true, outcome: 'input-required', text: 'Where?' }],
    ['another outcome', { outcome: 'maybe', text: 'Hm.' }, malformed],
    ['an extra field', { outcome: 'completed', text: 'Sunny.', mood: 'happy' }, malformed],
    ['nothing', undefined, malformed]
  ])('reads %s', (_case, value, event) => {
    expect(readAnswer(value)).toEqual(event);
  });

  it('reads an answer handed back as JSON text, and anything else as not in the format', () => {
    expect(readAnswerText('{"outcome":"completed","text":"Sunny."}')).toEqual({
      type: 'result',
      ok: true,
      outcome: 'completed',
      text: 'Sunny.'
    });
    expect(readAnswerText('Sunny.')).toEqual(malformed);
    expect(readAnswerText(undefined)).toEqual(malformed);
  });

  it('words a tool call the same for every runner', () => {
    expect(toolCallProgress('find_city', { name: 'Lisbon' })).toEqual({ type: 'progress', text: 'Calling find_city {"name":"Lisbon"}' });
  });
});
