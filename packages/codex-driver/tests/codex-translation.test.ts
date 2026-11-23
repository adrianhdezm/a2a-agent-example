import type { ThreadEvent } from '@openai/codex-sdk';
import { describe, expect, it } from 'vitest';
import { codexThreadId, translateCodexEvent } from '../src/codex-translation.ts';
import {
  agentMessageCompleted,
  agentMessageStarted,
  fileChangeCompleted,
  reasoningCompleted,
  threadId,
  threadStarted,
  turnCompleted,
  turnFailed,
  turnStarted
} from './fixtures/codex-events.ts';

describe('codex-translation', () => {
  describe('codexThreadId', () => {
    it('reads the thread id from thread.started', () => {
      expect(codexThreadId(threadStarted)).toBe(threadId);
    });

    it('gives undefined for any other event', () => {
      expect(codexThreadId(turnStarted)).toBeUndefined();
    });
  });

  describe('translateCodexEvent', () => {
    it('emits an agent.message for a completed agent-message item', () => {
      expect(translateCodexEvent(agentMessageCompleted)).toEqual([
        { type: 'agent.message', text: "Created hello.py, which prints 'Hello, A2A!'." }
      ]);
    });

    it('ends the turn completed for turn.completed', () => {
      expect(translateCodexEvent(turnCompleted)).toEqual([{ type: 'turn.ended', outcome: 'completed' }]);
    });

    it('ends the turn failed with the error message for turn.failed', () => {
      expect(translateCodexEvent(turnFailed)).toEqual([
        { type: 'turn.ended', outcome: 'failed', error: 'stream disconnected before completion' }
      ]);
    });

    it.each<[string, ThreadEvent]>([
      ['thread.started', threadStarted],
      ['turn.started', turnStarted],
      ['a started agent message', agentMessageStarted],
      ['a reasoning item', reasoningCompleted],
      ['a file change', fileChangeCompleted]
    ])('emits nothing for %s', (_name, event) => {
      expect(translateCodexEvent(event)).toEqual([]);
    });
  });
});
