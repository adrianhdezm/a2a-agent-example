import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessEvent } from '@a2a-agent-example/harness';
import { describe, expect, it } from 'vitest';
import { ClaudeSession } from '../src/claude-session.ts';
import { assistantMessage, initMessage, sessionId, successResult } from './fixtures/claude-messages.ts';

const config = { workspace: '/srv/workspaces/claude-coder', instructions: 'You write small programs.' };

function fakeQuery(messages: SDKMessage[]) {
  const calls: { prompt: string; options: Options }[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- async to match the SDK's stream
  async function* query(params: { prompt: string; options: Options }): AsyncIterable<SDKMessage> {
    calls.push(params);
    yield* messages;
  }
  return { calls, query };
}

async function collect(iterable: AsyncIterable<HarnessEvent>): Promise<HarnessEvent[]> {
  const collected: HarnessEvent[] = [];
  for await (const event of iterable) {
    collected.push(event);
  }
  return collected;
}

describe('ClaudeSession', () => {
  it('runs a turn as one query with the agent settings and saves the announced session id', async () => {
    // Arrange
    const { calls, query } = fakeQuery([initMessage, assistantMessage, successResult]);
    const session = new ClaudeSession(undefined, config, { apiKey: 'test-key', maxTurns: 7, query });

    // Act
    const events = await collect(session.runTurn('Write hello.py'));

    // Assert
    expect(events.at(-1)).toMatchObject({ type: 'turn.ended', outcome: 'completed' });
    expect(session.id).toBe(sessionId);
    expect(calls[0]?.prompt).toBe('Write hello.py');
    expect(calls[0]?.options).toMatchObject({
      cwd: config.workspace,
      resume: undefined,
      systemPrompt: config.instructions,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
      permissionMode: 'acceptEdits',
      maxTurns: 7,
      env: { ANTHROPIC_API_KEY: 'test-key' }
    });
  });

  it('resumes a session by passing its id to the query', async () => {
    const { calls, query } = fakeQuery([successResult]);
    const session = new ClaudeSession(sessionId, config, { apiKey: 'test-key', maxTurns: 7, query });

    await collect(session.runTurn('And now a test'));

    expect(calls[0]?.options.resume).toBe(sessionId);
  });

  it('ends the turn failed when the query stops without a result', async () => {
    const { query } = fakeQuery([initMessage]);
    const session = new ClaudeSession(undefined, config, { apiKey: 'test-key', maxTurns: 7, query });

    const events = await collect(session.runTurn('Write hello.py'));

    expect(events).toEqual([{ type: 'turn.ended', outcome: 'failed', error: 'The Claude query ended without a result' }]);
  });

  it('ends the turn failed with the message of an error the query throws', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await, require-yield -- a stream that fails before its first message
    async function* query(): AsyncIterable<SDKMessage> {
      throw new Error('spawn claude ENOENT');
    }
    const session = new ClaudeSession(undefined, config, { apiKey: 'test-key', maxTurns: 7, query });

    const events = await collect(session.runTurn('Write hello.py'));

    expect(events).toEqual([{ type: 'turn.ended', outcome: 'failed', error: 'spawn claude ENOENT' }]);
  });
});
