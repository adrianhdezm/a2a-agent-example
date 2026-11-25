import { Role, TaskState } from '@a2a-js/sdk';
import type { StreamResponse } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { renderEvent } from '../src/render.ts';

// Tags each styled span with its style, so a test can see which style a line uses without terminal codes.
const style = (format: string, text: string) => `<${format}>${text}`;

const text = (value: string) => ({
  content: { $case: 'text' as const, value },
  metadata: undefined,
  filename: '',
  mediaType: 'text/plain'
});

function status(state: TaskState, message?: string): StreamResponse {
  return {
    payload: {
      $case: 'statusUpdate',
      value: {
        taskId: 'task-1',
        contextId: 'context-1',
        status: {
          state,
          message:
            message === undefined
              ? undefined
              : {
                  messageId: 'm-1',
                  contextId: 'context-1',
                  taskId: 'task-1',
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

describe('renderEvent', () => {
  it.each([
    [
      'progress, dimmed',
      status(TaskState.TASK_STATE_WORKING, 'Calling find_city {"name":"Lisbon"}'),
      '<dim>  … Calling find_city {"name":"Lisbon"}'
    ],
    [
      "the agent's question, with how to answer",
      status(TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?'),
      '<cyan>Agent: Which Springfield?\n<dim>  (answer to continue, or /new to start over)'
    ],
    ['the end of an answer', status(TaskState.TASK_STATE_COMPLETED), '<green>  ✓ done'],
    [
      'a failure with its reason',
      status(TaskState.TASK_STATE_FAILED, 'Agent error: error_max_turns'),
      '<red>  ✗ Agent error: error_max_turns'
    ],
    ['a cancellation', status(TaskState.TASK_STATE_CANCELED, 'Cancelled.'), '<yellow>  ⊘ cancelled']
  ])('shows %s', (_case, event, line) => {
    expect(renderEvent(event, style)).toBe(line);
  });

  it("shows the answer from the agent's artifact", () => {
    const event: StreamResponse = {
      payload: {
        $case: 'artifactUpdate',
        value: {
          taskId: 'task-1',
          contextId: 'context-1',
          artifact: {
            artifactId: 'a-1',
            name: 'forecast',
            description: '',
            parts: [text('Take an umbrella.')],
            metadata: undefined,
            extensions: []
          },
          append: false,
          lastChunk: true,
          metadata: undefined
        }
      }
    };

    expect(renderEvent(event, style)).toBe('<cyan>Agent: Take an umbrella.');
  });

  it('shows only the text of an artifact that also carries other parts', () => {
    const map = {
      content: { $case: 'url' as const, value: 'https://example.com/map.png' },
      metadata: undefined,
      filename: 'map.png',
      mediaType: 'image/png'
    };
    const event: StreamResponse = {
      payload: {
        $case: 'artifactUpdate',
        value: {
          taskId: 'task-1',
          contextId: 'context-1',
          artifact: {
            artifactId: 'a-1',
            name: 'forecast',
            description: '',
            parts: [text('Rain all day.'), map, text('Take an umbrella.')],
            metadata: undefined,
            extensions: []
          },
          append: false,
          lastChunk: true,
          metadata: undefined
        }
      }
    };

    expect(renderEvent(event, style)).toBe('<cyan>Agent: Rain all day.\nTake an umbrella.');
  });

  it.each([
    ['a working update without text', status(TaskState.TASK_STATE_WORKING)],
    [
      'the task itself',
      { payload: { $case: 'task', value: { id: 't', contextId: 'c', status: undefined, artifacts: [], history: [], metadata: undefined } } }
    ]
  ] as [string, StreamResponse][])('shows nothing for %s', (_case, event) => {
    expect(renderEvent(event, style)).toBeUndefined();
  });
});
