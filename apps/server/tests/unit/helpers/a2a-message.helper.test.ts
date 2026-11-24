import { TaskState } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { forecastArtifact, statusUpdate } from '../../../src/helpers/a2a-message.helper.ts';

const ids = { taskId: 'task-1', contextId: 'context-1' };

describe('a2a-message.helper', () => {
  it('holds an answer as one complete text artifact named forecast', () => {
    const update = forecastArtifact(ids, 'Take an umbrella.');

    expect(update).toMatchObject({ ...ids, append: false, lastChunk: true });
    expect(update.artifact).toMatchObject({ name: 'forecast', parts: [{ content: { $case: 'text', value: 'Take an umbrella.' } }] });
  });

  it('carries text on a status update as an agent message, and none without text', () => {
    expect(statusUpdate(ids, TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?').status?.message?.parts).toEqual([
      expect.objectContaining({ content: { $case: 'text', value: 'Which Springfield?' } })
    ]);
    expect(statusUpdate(ids, TaskState.TASK_STATE_COMPLETED).status?.message).toBeUndefined();
  });
});
