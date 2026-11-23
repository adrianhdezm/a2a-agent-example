import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessEvent } from '@a2a-agent-example/harness';

/** The session id a message announces: the `system`/`init` message carries it; any other message gives undefined. */
export function claudeSessionId(message: SDKMessage): string | undefined {
  if (message.type === 'system' && message.subtype === 'init') {
    return message.session_id;
  }
  return undefined;
}

/**
 * The harness events one Claude Agent SDK message stands for: an `agent.message` per text block of an `assistant`
 * message, a `turn.ended` for the `result` message, and nothing for every other message.
 */
export function translateClaudeMessage(message: SDKMessage): HarnessEvent[] {
  if (message.type === 'assistant') {
    return message.message.content.flatMap((block) => (block.type === 'text' ? [{ type: 'agent.message', text: block.text }] : []));
  }
  if (message.type === 'result') {
    if (message.subtype === 'success') {
      return [{ type: 'turn.ended', outcome: 'completed', finalText: message.result }];
    }
    return [{ type: 'turn.ended', outcome: 'failed', error: message.errors.join('\n') || message.subtype }];
  }
  return [];
}
