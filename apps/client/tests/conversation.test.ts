import { Role, TaskState } from '@a2a-js/sdk';
import type { StreamResponse } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../src/conversation.ts';

function task(id: string, contextId: string): StreamResponse {
  return {
    payload: {
      $case: 'task',
      value: { id, contextId, status: undefined, artifacts: [], history: [], metadata: undefined }
    }
  };
}

function status(taskId: string, contextId: string, state: TaskState): StreamResponse {
  return {
    payload: {
      $case: 'statusUpdate',
      value: { taskId, contextId, status: { state, message: undefined, timestamp: undefined }, metadata: undefined }
    }
  };
}

describe('Conversation', () => {
  it('sends the first message in no context and no task, as the user text', () => {
    const message = new Conversation().request('Lisbon tomorrow?').message;

    expect(message).toMatchObject({ contextId: '', taskId: '', parts: [{ content: { $case: 'text', value: 'Lisbon tomorrow?' } }] });
  });

  it('continues the task the agent is waiting in, so the answer reaches its question', () => {
    const conversation = new Conversation();
    conversation.observe(task('task-1', 'context-1'));
    conversation.observe(status('task-1', 'context-1', TaskState.TASK_STATE_INPUT_REQUIRED));

    expect(conversation.request('Illinois').message).toMatchObject({ contextId: 'context-1', taskId: 'task-1' });
  });

  it.each([TaskState.TASK_STATE_COMPLETED, TaskState.TASK_STATE_FAILED, TaskState.TASK_STATE_CANCELED])(
    'starts a new task in the same context once a task ends in state %i',
    (state) => {
      const conversation = new Conversation();
      conversation.observe(task('task-1', 'context-1'));
      conversation.observe(status('task-1', 'context-1', state));

      expect(conversation.request('And on Friday?').message).toMatchObject({ contextId: 'context-1', taskId: '' });
      expect(conversation.taskId).toBeUndefined();
    }
  );

  it('starts over in a new context after reset', () => {
    const conversation = new Conversation();
    conversation.observe(task('task-1', 'context-1'));

    conversation.reset();

    expect(conversation.request('Paris today?').message).toMatchObject({ contextId: '', taskId: '' });
  });

  it('follows the ids of a plain message reply, keeping its own where the message has none', () => {
    const conversation = new Conversation();
    conversation.observe(task('task-1', 'context-1'));

    conversation.observe({
      payload: {
        $case: 'message',
        value: {
          messageId: 'm-1',
          contextId: '',
          taskId: 'task-2',
          role: Role.ROLE_AGENT,
          parts: [],
          metadata: undefined,
          extensions: [],
          referenceTaskIds: []
        }
      }
    });

    expect(conversation.request('Thanks').message).toMatchObject({ contextId: 'context-1', taskId: 'task-2' });
  });
});
