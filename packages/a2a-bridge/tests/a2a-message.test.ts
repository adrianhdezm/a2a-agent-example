import { Role } from '@a2a-js/sdk';
import type { Message } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { messageText, resultArtifact, textPart } from '../src/a2a-message.ts';

const ids = { taskId: 'task-1', contextId: 'context-1' };

describe('a2a-message', () => {
  describe('messageText', () => {
    it('joins the text parts of a message and leaves the other parts out', () => {
      const message: Message = {
        messageId: 'message-1',
        ...ids,
        role: Role.ROLE_USER,
        parts: [
          textPart('Write hello.py'),
          {
            content: { $case: 'url', value: 'https://example.com/spec.md' },
            metadata: undefined,
            filename: 'spec.md',
            mediaType: 'text/markdown'
          },
          textPart('in Python 3')
        ],
        metadata: undefined,
        extensions: [],
        referenceTaskIds: []
      };

      expect(messageText(message)).toBe('Write hello.py\n\nin Python 3');
    });
  });

  describe('resultArtifact', () => {
    it('holds the text as one complete artifact named result', () => {
      const update = resultArtifact(ids, 'Created hello.py');

      expect(update).toMatchObject({ ...ids, append: false, lastChunk: true });
      expect(update.artifact).toMatchObject({
        name: 'result',
        parts: [{ content: { $case: 'text', value: 'Created hello.py' }, mediaType: 'text/plain' }]
      });
    });
  });
});
