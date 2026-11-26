import { describe, expect, it } from 'vitest';
import { runCommand } from '../src/commands.ts';
import { Conversation } from '../src/conversation.ts';
import { plainStyle } from '../src/style.ts';
import { taskEvent } from './utils/a2a-seed.ts';

function session() {
  const printed: string[] = [];
  const conversation = new Conversation();
  return { printed, conversation, context: { conversation, style: plainStyle, print: (lines: string) => printed.push(lines) } };
}

describe('runCommand', () => {
  it('answers undefined for a line that is a message for the agent', () => {
    expect(runCommand('Lisbon tomorrow?', session().context)).toBeUndefined();
  });

  it('starts a new conversation on /new', () => {
    const { conversation, context, printed } = session();
    conversation.observe(taskEvent());

    expect(runCommand('/new', context)).toBe('continue');
    expect(conversation.contextId).toBeUndefined();
    expect(printed).toEqual(['Started a new conversation.']);
  });

  it('lists every command on /help', () => {
    const { context, printed } = session();

    runCommand('/help', context);

    expect(printed[0]).toMatch(/\/new .*\n.*\/help .*\n.*\/exit /);
  });

  it('ends the session on /exit', () => {
    expect(runCommand('/exit', session().context)).toBe('exit');
  });

  it('reports an unknown command instead of sending it to the agent', () => {
    const { context, printed } = session();

    expect(runCommand('/forecast Lisbon', context)).toBe('continue');
    expect(printed).toEqual(['Unknown command /forecast Lisbon: /help lists the commands.']);
  });
});
