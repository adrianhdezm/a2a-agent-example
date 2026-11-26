import { TaskState } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { renderEvent } from '../src/render.ts';
import { artifactEvent, taskRef, messageEvent, statusEvent, tagStyle, taskEvent, text } from './utils/a2a-seed.ts';

const compact = { style: tagStyle, verbose: false, now: () => new Date(2026, 10, 25, 9, 30, 5) };
const verbose = { ...compact, verbose: true };

describe('renderEvent', () => {
  describe('compact', () => {
    it.each([
      [
        'progress, dimmed',
        statusEvent(TaskState.TASK_STATE_WORKING, 'Calling find_city {"name":"Lisbon"}'),
        '<dim>  … Calling find_city {"name":"Lisbon"}'
      ],
      [
        "the agent's question, with how to answer",
        statusEvent(TaskState.TASK_STATE_INPUT_REQUIRED, 'Which Springfield?'),
        '<cyan>Agent: Which Springfield?\n<dim>  (answer to continue, or /new to start over)'
      ],
      ['the end of an answer', statusEvent(TaskState.TASK_STATE_COMPLETED), '<green>  ✓ done'],
      [
        'a failure with its reason',
        statusEvent(TaskState.TASK_STATE_FAILED, 'Agent error: error_max_turns'),
        '<red>  ✗ Agent error: error_max_turns'
      ],
      ['a cancellation', statusEvent(TaskState.TASK_STATE_CANCELED, 'Cancelled.'), '<yellow>  ⊘ cancelled'],
      ['a rejection with its reason', statusEvent(TaskState.TASK_STATE_REJECTED, 'Out of scope.'), '<red>  ✗ rejected: Out of scope.'],
      ["the answer from the agent's artifact", artifactEvent([text('Take an umbrella.')]), '<cyan>Agent: Take an umbrella.'],
      ['a plain message reply', messageEvent('Hello!', taskRef), '<cyan>Agent: Hello!']
    ])('shows %s', (_case, event, lines) => {
      expect(renderEvent(event, compact)).toBe(lines);
    });

    it.each([
      ['a working update without text', statusEvent(TaskState.TASK_STATE_WORKING)],
      ['the task itself', taskEvent()]
    ])('shows nothing for %s', (_case, event) => {
      expect(renderEvent(event, compact)).toBeUndefined();
    });
  });

  describe('verbose', () => {
    it('heads each event with the time, the state, the task and the context', () => {
      expect(renderEvent(taskEvent(), verbose)).toBe('<magenta>[09:30:05] SUBMITTED (new task) · task task-1 · context context-1');
      expect(renderEvent(statusEvent(TaskState.TASK_STATE_WORKING), verbose)).toBe(
        '<magenta>[09:30:05] WORKING · task task-1 · context context-1'
      );
    });

    it('says when a task is final, after its last state', () => {
      expect(renderEvent(statusEvent(TaskState.TASK_STATE_COMPLETED), verbose)?.split('\n')).toEqual([
        '<magenta>[09:30:05] COMPLETED · task task-1 · context context-1',
        '<green>  ✓ done',
        '<dim>  the task is final; the next message starts a new one'
      ]);
    });

    it('names the artifact above its content', () => {
      expect(renderEvent(artifactEvent([text('Take an umbrella.')]), verbose)?.split('\n')).toEqual([
        '<magenta>[09:30:05] artifact "forecast" · task task-1 · context context-1',
        '<cyan>Agent: Take an umbrella.'
      ]);
    });
  });
});
