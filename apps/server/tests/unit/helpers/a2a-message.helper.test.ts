import { TaskState } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import type { Part } from '@a2a-js/sdk';
import { forecastArtifact, partsText, statusUpdate, textPart } from '../../../src/helpers/a2a-message.helper.ts';

const taskRef = { taskId: 'task-1', contextId: 'context-1' };

describe('a2a-message.helper', () => {
  it('holds an answer as one complete text artifact named forecast', () => {
    const update = forecastArtifact(taskRef, 'Take an umbrella.');

    expect(update).toMatchObject({ ...taskRef, append: false, lastChunk: true });
    expect(update.artifact).toMatchObject({ name: 'forecast', parts: [{ content: { $case: 'text', value: 'Take an umbrella.' } }] });
  });

  it('carries text on a status update as an agent message, and none without text', () => {
    expect(statusUpdate(taskRef, TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?').status?.message?.parts).toEqual([
      expect.objectContaining({ content: { $case: 'text', value: 'Which Springfield?' } })
    ]);
    expect(statusUpdate(taskRef, TaskState.TASK_STATE_COMPLETED).status?.message).toBeUndefined();
  });

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
    expect(partsText(undefined)).toBe('');
  });
});
