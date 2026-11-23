import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/args.ts';
import { UsageError } from '../src/errors/usage-error.ts';

describe('parseArgs', () => {
  it('reads the agent id and the prompt', () => {
    expect(parseArgs(['claude-coder', "Write hello.py that prints 'Hello, A2A!'"])).toEqual({
      agentId: 'claude-coder',
      prompt: "Write hello.py that prints 'Hello, A2A!'"
    });
  });

  it('joins an unquoted prompt from the words after the id', () => {
    expect(parseArgs(['codex-coder', 'Write', 'hello.py'])).toEqual({ agentId: 'codex-coder', prompt: 'Write hello.py' });
  });

  it.each([[[]], [['claude-coder']], [['claude-coder', '  ']]])('throws a UsageError for %j', (args) => {
    expect(() => parseArgs(args)).toThrow(UsageError);
  });
});
