import type { ThreadEvent } from '@openai/codex-sdk';

// Sample events in the shape the Codex SDK streams for one trip-planner run, from `codex exec --json`.

export const threadId = '019a6f3e-4b1c-7d22-9e8f-5a0b1c2d3e4f';

export const started: ThreadEvent = { type: 'thread.started', thread_id: threadId };

export const turnStarted: ThreadEvent = { type: 'turn.started' };

export const reasoning: ThreadEvent = {
  type: 'item.completed',
  item: { id: 'item_0', type: 'reasoning', text: '**Checking the forecast for Lisbon**' }
};

export const command: ThreadEvent = {
  type: 'item.completed',
  item: { id: 'item_1', type: 'command_execution', command: 'date', aggregated_output: '', exit_code: 0, status: 'completed' }
};

/** The run's final agent message, carrying `answer` as the JSON its output schema asks for. */
export function message(answer: unknown): ThreadEvent {
  return { type: 'item.completed', item: { id: 'item_2', type: 'agent_message', text: JSON.stringify(answer) } };
}

export const completed: ThreadEvent = {
  type: 'turn.completed',
  usage: { input_tokens: 1200, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 80, reasoning_output_tokens: 40 }
};

export const failed: ThreadEvent = { type: 'turn.failed', error: { message: 'stream disconnected before completion' } };

/** One whole run that ends with `answer`; the first run of a thread starts with `thread.started`. */
export function run(answer: unknown, first = true): ThreadEvent[] {
  return [...(first ? [started] : []), turnStarted, reasoning, message(answer), completed];
}
