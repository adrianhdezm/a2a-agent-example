import type { ThreadEvent } from '@openai/codex-sdk';
import type { HarnessEvent } from '@a2a-agent-example/harness';

/** The thread id an event announces: `thread.started` carries it; any other event gives undefined. */
export function codexThreadId(event: ThreadEvent): string | undefined {
  return event.type === 'thread.started' ? event.thread_id : undefined;
}

/**
 * The harness events one Codex SDK event stands for: an `agent.message` for a completed agent-message item, a
 * `turn.ended` for `turn.completed` and `turn.failed`, and nothing for every other event.
 */
export function translateCodexEvent(event: ThreadEvent): HarnessEvent[] {
  switch (event.type) {
    case 'item.completed':
      return event.item.type === 'agent_message' ? [{ type: 'agent.message', text: event.item.text }] : [];
    case 'turn.completed':
      return [{ type: 'turn.ended', outcome: 'completed' }];
    case 'turn.failed':
      return [{ type: 'turn.ended', outcome: 'failed', error: event.error.message }];
    default:
      return [];
  }
}
