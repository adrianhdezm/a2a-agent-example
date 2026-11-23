import { Role, TaskState } from '@a2a-js/sdk';
import type { Message, Task } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { describeResult, userTextRequest } from '../src/a2a-request.ts';

function textPart(value: string) {
  return { content: { $case: 'text' as const, value }, metadata: undefined, filename: '', mediaType: 'text/plain' };
}

describe('a2a-request', () => {
  describe('userTextRequest', () => {
    it('carries the prompt as the one text part of a user message in a new context', () => {
      const request = userTextRequest('Write hello.py');

      expect(request.message).toMatchObject({ role: Role.ROLE_USER, contextId: '', taskId: '', parts: [textPart('Write hello.py')] });
    });
  });

  describe('describeResult', () => {
    it('reads the final state and the text of the artifacts of a task', () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: { state: TaskState.TASK_STATE_COMPLETED, message: undefined, timestamp: undefined },
        artifacts: [
          {
            artifactId: 'artifact-1',
            name: 'result',
            description: '',
            parts: [textPart('Created hello.py')],
            metadata: undefined,
            extensions: []
          }
        ],
        history: [],
        metadata: undefined
      };

      expect(describeResult(task)).toEqual({ state: 'TASK_STATE_COMPLETED', artifactText: 'Created hello.py' });
    });

    it('reports a direct message reply as having no task', () => {
      const message: Message = {
        messageId: 'message-1',
        contextId: 'context-1',
        taskId: '',
        role: Role.ROLE_AGENT,
        parts: [textPart('Hello')],
        metadata: undefined,
        extensions: [],
        referenceTaskIds: []
      };

      expect(describeResult(message)).toEqual({ state: 'MESSAGE', artifactText: '' });
    });
  });
});
