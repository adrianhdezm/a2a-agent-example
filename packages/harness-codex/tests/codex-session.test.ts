import type { CodexOptions, ThreadEvent, ThreadOptions } from '@openai/codex-sdk';
import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import { describe, expect, it } from 'vitest';
import type { CodexClient, CodexThread } from '../src/codex-client.ts';
import { CodexSession } from '../src/codex-session.ts';
import {
  agentMessageCompleted,
  fileChangeCompleted,
  threadId,
  threadStarted,
  turnCompleted,
  turnFailed,
  turnStarted
} from './fixtures/codex-events.ts';

const config = { workspace: '/srv/workspaces/codex-coder', instructions: 'You write small programs.' };

function fakeCodex(events: ThreadEvent[]) {
  const created: CodexOptions[] = [];
  const started: ThreadOptions[] = [];
  const resumed: { id: string; options: ThreadOptions }[] = [];
  const inputs: string[] = [];
  const thread: CodexThread = {
    id: null,
    // eslint-disable-next-line @typescript-eslint/require-await -- async to match the SDK
    runStreamed: async (input) => {
      inputs.push(input);
      return { events: toAsync(events) };
    }
  };
  const client: CodexClient = {
    startThread: (options) => {
      started.push(options);
      return thread;
    },
    resumeThread: (id, options) => {
      resumed.push({ id, options });
      return thread;
    }
  };
  const createCodex = (options: CodexOptions) => {
    created.push(options);
    return client;
  };
  return { created, started, resumed, inputs, createCodex };
}

// eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
async function* toAsync<T>(items: T[]): AsyncIterable<T> {
  yield* items;
}

async function collect(iterable: AsyncIterable<HarnessEvent>): Promise<HarnessEvent[]> {
  const collected: HarnessEvent[] = [];
  for await (const event of iterable) {
    collected.push(event);
  }
  return collected;
}

describe('CodexSession', () => {
  it('starts a thread in the workspace, saves its id and ends with the last agent message', async () => {
    // Arrange
    const codex = fakeCodex([threadStarted, turnStarted, fileChangeCompleted, agentMessageCompleted, turnCompleted]);
    const session = new CodexSession(undefined, config, { apiKey: 'test-key', createCodex: codex.createCodex });

    // Act
    const events = await collect(session.runTurn('Write hello.py'));

    // Assert
    const text = "Created hello.py, which prints 'Hello, A2A!'.";
    expect(events).toEqual([
      { type: 'agent.message', text },
      { type: 'turn.ended', outcome: 'completed', finalText: text }
    ]);
    expect(session.id).toBe(threadId);
    expect(codex.inputs).toEqual(['Write hello.py']);
    expect(codex.started).toEqual([{ workingDirectory: config.workspace, sandboxMode: 'workspace-write', skipGitRepoCheck: true }]);
  });

  it('hands the API key and the instructions to the Codex client', () => {
    const codex = fakeCodex([]);

    new CodexSession(undefined, config, { apiKey: 'test-key', createCodex: codex.createCodex });

    expect(codex.created).toEqual([{ apiKey: 'test-key', config: { developer_instructions: config.instructions } }]);
  });

  it('resumes the thread by its id', async () => {
    const codex = fakeCodex([turnStarted, agentMessageCompleted, turnCompleted]);
    const session = new CodexSession(threadId, config, { apiKey: 'test-key', createCodex: codex.createCodex });

    await collect(session.runTurn('And now a test'));

    expect(codex.started).toEqual([]);
    expect(codex.resumed.map(({ id }) => id)).toEqual([threadId]);
  });

  it('ends the turn failed when Codex reports turn.failed', async () => {
    const codex = fakeCodex([threadStarted, turnFailed]);
    const session = new CodexSession(undefined, config, { apiKey: 'test-key', createCodex: codex.createCodex });

    const events = await collect(session.runTurn('Write hello.py'));

    expect(events).toEqual([{ type: 'turn.ended', outcome: 'failed', error: 'stream disconnected before completion' }]);
  });

  it('ends the turn failed when the stream stops without a turn result', async () => {
    const codex = fakeCodex([threadStarted, turnStarted]);
    const session = new CodexSession(undefined, config, { apiKey: 'test-key', createCodex: codex.createCodex });

    const events = await collect(session.runTurn('Write hello.py'));

    expect(events).toEqual([{ type: 'turn.ended', outcome: 'failed', error: 'The Codex turn ended without a result' }]);
  });
});
