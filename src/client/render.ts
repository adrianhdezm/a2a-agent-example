import { TaskState } from '@a2a-js/sdk';
import type { StreamResponse } from '@a2a-js/sdk';
import { partsText } from '../shared/a2a-text.ts';

/** The styles the CLI uses; `node:util`'s `styleText` in a terminal, plain text in tests. */
export type Style = (format: 'dim' | 'cyan' | 'green' | 'yellow' | 'red', text: string) => string;

function renderStatus(state: TaskState | undefined, text: string, style: Style): string | undefined {
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
    default:
      return undefined;
  }
}

/** The line or lines to print for one event the agent streams back; nothing for events with nothing to show. */
export function renderEvent(response: StreamResponse, style: Style): string | undefined {
  const payload = response.payload;
  switch (payload?.$case) {
    case 'statusUpdate':
      return renderStatus(payload.value.status?.state, partsText(payload.value.status?.message?.parts), style);
    case 'artifactUpdate':
      return `${style('cyan', 'Agent:')} ${partsText(payload.value.artifact?.parts)}`;
    case 'message':
      return `${style('cyan', 'Agent:')} ${partsText(payload.value.parts)}`;
    default:
      return undefined;
  }
}
