import { TaskState } from '@a2a-js/sdk';
import type { Message, StreamResponse, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import { renderParts } from './parts.ts';
import type { Style } from './style.ts';

export interface RenderOptions {
  style: Style;
  /** Add timestamps, task and context ids, and the state changes the compact view leaves out. */
  verbose: boolean;
  /** The clock for the timestamps. */
  now: () => Date;
}

const finalStates = new Set<TaskState>([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED
]);

function stateName(state: TaskState | undefined): string {
  return TaskState[state ?? TaskState.TASK_STATE_UNSPECIFIED].replace('TASK_STATE_', '');
}

// The line verbose mode prints above an event: when it arrived, and which task and context it belongs to.
function header(what: string, ids: { taskId: string; contextId: string }, { style, now }: RenderOptions): string {
  return style('magenta', `[${now().toTimeString().slice(0, 8)}] ${what} · task ${ids.taskId} · context ${ids.contextId}`);
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
  return [header(stateName(state), update, options), ...(line === undefined ? [] : [line]), ...final].join('\n');
}

function renderTask(task: Task, options: RenderOptions): string | undefined {
  return options.verbose
    ? header(`${stateName(task.status?.state)} (new task)`, { taskId: task.id, contextId: task.contextId }, options)
    : undefined;
}

function renderArtifact(update: TaskArtifactUpdateEvent, options: RenderOptions): string {
  const line = `${options.style('cyan', 'Agent:')} ${renderParts(update.artifact?.parts, options.style)}`;
  return options.verbose ? `${header(`artifact "${update.artifact?.name ?? ''}"`, update, options)}\n${line}` : line;
}

function renderMessage(message: Message, options: RenderOptions): string {
  const line = `${options.style('cyan', 'Agent:')} ${renderParts(message.parts, options.style)}`;
  return options.verbose ? `${header('message', message, options)}\n${line}` : line;
}

/** The line or lines to print for one event the agent streams back; nothing for events with nothing to show. */
export function renderEvent(response: StreamResponse, options: RenderOptions): string | undefined {
  const payload = response.payload;
  switch (payload?.$case) {
    case 'task':
      return renderTask(payload.value, options);
    case 'statusUpdate':
      return renderStatus(payload.value, options);
    case 'artifactUpdate':
      return renderArtifact(payload.value, options);
    case 'message':
      return renderMessage(payload.value, options);
    default:
      return undefined;
  }
}
