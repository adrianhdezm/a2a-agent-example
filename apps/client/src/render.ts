import { TaskState } from '@a2a-js/sdk';
import type { Part, StreamResponse, TaskStatus, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import { renderParts } from './parts.ts';
import type { Style } from './style.ts';

export interface RenderOptions {
  style: Style;
  /** Add timestamps, task and context ids, and the state changes the compact view leaves out. */
  verbose: boolean;
  /** The clock for the timestamps. */
  now: () => Date;
}

// Which task, in which conversation (context), an event belongs to.
interface TaskRef {
  taskId: string;
  contextId: string;
}

const finalStates = new Set<TaskState>([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED
]);

function stateName(status: TaskStatus | undefined): string {
  return TaskState[status?.state ?? TaskState.TASK_STATE_UNSPECIFIED].replace('TASK_STATE_', '');
}

// The line verbose mode prints above an event: when it arrived, and which task and context it belongs to.
function header(what: string, taskRef: TaskRef, { style, now }: RenderOptions): string {
  return style('magenta', `[${now().toTimeString().slice(0, 8)}] ${what} · task ${taskRef.taskId} · context ${taskRef.contextId}`);
}

function compactStatus(state: TaskState | undefined, text: string, style: Style): string | undefined {
  switch (state) {
    case TaskState.TASK_STATE_WORKING:
      return text === '' ? undefined : style('dim', `  … ${text}`);
    case TaskState.TASK_STATE_INPUT_REQUIRED:
      return `${style('cyan', 'Agent:')} ${text}\n${style('dim', '  (answer to continue, or /new to start over)')}`;
    case TaskState.TASK_STATE_COMPLETED:
      return style('green', '  ✓ done');
    case TaskState.TASK_STATE_FAILED:
      return style('red', `  ✗ ${text || 'failed'}`);
    case TaskState.TASK_STATE_CANCELED:
      return style('yellow', '  ⊘ cancelled');
    case TaskState.TASK_STATE_REJECTED:
      return style('red', `  ✗ rejected${text === '' ? '' : `: ${text}`}`);
    default:
      return undefined;
  }
}

function renderStatus(update: TaskStatusUpdateEvent, options: RenderOptions): string | undefined {
  const state = update.status?.state;
  const line = compactStatus(state, renderParts(update.status?.message?.parts, options.style), options.style);
  if (!options.verbose) {
    return line;
  }
  const final =
    state !== undefined && finalStates.has(state) ? [options.style('dim', '  the task is final; the next message starts a new one')] : [];
  return [header(stateName(update.status), update, options), ...(line === undefined ? [] : [line]), ...final].join('\n');
}

// What the agent answers, as an artifact or a message, headed in verbose mode by where it came from.
function renderAnswer(what: string, taskRef: TaskRef, parts: Part[] | undefined, options: RenderOptions): string {
  const line = `${options.style('cyan', 'Agent:')} ${renderParts(parts, options.style)}`;
  return options.verbose ? `${header(what, taskRef, options)}\n${line}` : line;
}

/** The line or lines to print for one event the agent streams back; nothing for events with nothing to show. */
export function renderEvent(response: StreamResponse, options: RenderOptions): string | undefined {
  const payload = response.payload;
  switch (payload?.$case) {
    case 'task': {
      const task = payload.value;
      return options.verbose
        ? header(`${stateName(task.status)} (new task)`, { taskId: task.id, contextId: task.contextId }, options)
        : undefined;
    }
    case 'statusUpdate':
      return renderStatus(payload.value, options);
    case 'artifactUpdate':
      return renderAnswer(`artifact "${payload.value.artifact?.name ?? ''}"`, payload.value, payload.value.artifact?.parts, options);
    case 'message':
      return renderAnswer('message', payload.value, payload.value.parts, options);
    default:
      return undefined;
  }
}
