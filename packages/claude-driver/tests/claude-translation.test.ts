import { describe, expect, it } from 'vitest';
import { claudeSessionId, translateClaudeMessage } from '../src/claude-translation.ts';
import {
  assistantMessage,
  executionErrorResult,
  initMessage,
  maxTurnsResult,
  sessionId,
  successResult
} from './fixtures/claude-messages.ts';

describe('claude-translation', () => {
  describe('claudeSessionId', () => {
    it('reads the session id from the system init message', () => {
      expect(claudeSessionId(initMessage)).toBe(sessionId);
    });

    it('gives undefined for any other message', () => {
      expect(claudeSessionId(assistantMessage)).toBeUndefined();
    });
  });

  describe('translateClaudeMessage', () => {
    it('emits an agent.message for each text block of an assistant message, skipping tool calls', () => {
      expect(translateClaudeMessage(assistantMessage)).toEqual([
        { type: 'agent.message', text: "I'll create hello.py." },
        { type: 'agent.message', text: 'Done.' }
      ]);
    });

    it('ends the turn completed with the final text for a success result', () => {
      expect(translateClaudeMessage(successResult)).toEqual([
        { type: 'turn.ended', outcome: 'completed', finalText: "Created hello.py, which prints 'Hello, A2A!'." }
      ]);
    });

    it.each([
      ['error_during_execution', executionErrorResult, 'API Error: 401 invalid x-api-key'],
      ['error_max_turns', maxTurnsResult, 'error_max_turns']
    ])('ends the turn failed for an %s result', (_subtype, message, error) => {
      expect(translateClaudeMessage(message)).toEqual([{ type: 'turn.ended', outcome: 'failed', error }]);
    });

    it('emits nothing for the init message', () => {
      expect(translateClaudeMessage(initMessage)).toEqual([]);
    });
  });
});
