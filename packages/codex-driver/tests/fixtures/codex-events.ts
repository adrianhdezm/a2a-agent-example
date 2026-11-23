import type { ThreadEvent } from '@openai/codex-sdk';

// Sample events in the shape the Codex SDK streams for one turn of `runStreamed`.

export const threadId = '0199a213-81c0-7800-8aa1-bbab2a035a53';

export const threadStarted: ThreadEvent = { type: 'thread.started', thread_id: threadId };

export const turnStarted: ThreadEvent = { type: 'turn.started' };

export const reasoningCompleted: ThreadEvent = {
  type: 'item.completed',
  item: { id: 'item_0', type: 'reasoning', text: '**Writing the file**' }
};

export const fileChangeCompleted: ThreadEvent = {
  type: 'item.completed',
  item: { id: 'item_1', type: 'file_change', changes: [{ path: 'hello.py', kind: 'add' }], status: 'completed' }
};

export const agentMessageStarted: ThreadEvent = {
  type: 'item.started',
  item: { id: 'item_2', type: 'agent_message', text: '' }
};

export const agentMessageCompleted: ThreadEvent = {
  type: 'item.completed',
  item: { id: 'item_2', type: 'agent_message', text: "Created hello.py, which prints 'Hello, A2A!'." }
};

export const turnCompleted: ThreadEvent = {
  type: 'turn.completed',
  usage: { input_tokens: 9012, cached_input_tokens: 4096, cache_write_input_tokens: 0, output_tokens: 211, reasoning_output_tokens: 64 }
};

export const turnFailed: ThreadEvent = { type: 'turn.failed', error: { message: 'stream disconnected before completion' } };
