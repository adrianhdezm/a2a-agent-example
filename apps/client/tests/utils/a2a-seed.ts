import { Role, TaskState } from '@a2a-js/sdk';
import type { Part, StreamResponse } from '@a2a-js/sdk';

export const taskRef = { taskId: 'task-1', contextId: 'context-1' };

export function text(value: string): Part {
  return { content: { $case: 'text', value }, metadata: undefined, filename: '', mediaType: 'text/plain' };
}

export function taskEvent(id = taskRef.taskId, contextId = taskRef.contextId): StreamResponse {
  return {
    payload: {
      $case: 'task',
      value: {
        id,
        contextId,
        status: { state: TaskState.TASK_STATE_SUBMITTED, message: undefined, timestamp: undefined },
        artifacts: [],
        history: [],
        metadata: undefined
      }
    }
  };
}

export function statusEvent(state: TaskState, message?: string, taskId = taskRef.taskId): StreamResponse {
  return {
    payload: {
      $case: 'statusUpdate',
      value: {
        taskId,
        contextId: taskRef.contextId,
        status: {
          state,
          message:
            message === undefined
              ? undefined
              : {
                  messageId: 'm-1',
                  ...taskRef,
                  role: Role.ROLE_AGENT,
                  parts: [text(message)],
                  metadata: undefined,
                  extensions: [],
                  referenceTaskIds: []
                },
          timestamp: undefined
        },
        metadata: undefined
      }
    }
  };
}

export function artifactEvent(parts: Part[]): StreamResponse {
  return {
    payload: {
      $case: 'artifactUpdate',
      value: {
        ...taskRef,
        artifact: { artifactId: 'a-1', name: 'forecast', description: '', parts, metadata: undefined, extensions: [] },
        append: false,
        lastChunk: true,
        metadata: undefined
      }
    }
  };
}

export function messageEvent(value: string, messageIds: { taskId: string; contextId: string }): StreamResponse {
  return {
    payload: {
      $case: 'message',
      value: {
        messageId: 'm-2',
        ...messageIds,
        role: Role.ROLE_AGENT,
        parts: [text(value)],
        metadata: undefined,
        extensions: [],
        referenceTaskIds: []
      }
    }
  };
}

/** Tags each styled span with its style, so a test sees which style a line uses without terminal codes. */
export const tagStyle = (format: string, value: string) => `<${format}>${value}`;
