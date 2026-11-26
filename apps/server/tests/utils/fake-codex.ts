import type { ThreadEvent, ThreadOptions, TurnOptions } from '@openai/codex-sdk';
import type { CodexOptions } from '@openai/codex-sdk';
import type { CodexClient, CodexFactory, CodexThread } from '../../src/agents/core/runners/codex.runner.ts';

/** One run Codex was asked for: its input, the thread it resumed, and what it was started with. */
export interface CodexRun {
  input: string;
  resumed: string | undefined;
  turnOptions: TurnOptions | undefined;
  options: CodexOptions;
  threadOptions: ThreadOptions | undefined;
}

export interface FakeCodex {
  factory: CodexFactory;
  /** Every run, in order. */
  runs: CodexRun[];
}

/**
 * A Codex SDK stand-in whose n-th run streams `script[n]`, the last entry repeating. A thread takes its id from the
 * `thread.started` event its first run streams, as the SDK's does.
 */
export function fakeCodex(script: ThreadEvent[][]): FakeCodex {
  const runs: CodexRun[] = [];
  const factory: CodexFactory = (options) => {
    const thread = (resumed: string | undefined, threadOptions: ThreadOptions | undefined): CodexThread => {
      let id = resumed ?? null;
      return {
        get id() {
          return id;
        },
        runStreamed: (input, turnOptions) => {
          runs.push({ input, resumed, turnOptions, options, threadOptions });
          const events = script[Math.min(runs.length, script.length) - 1] ?? [];
          // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
          async function* stream(): AsyncIterable<ThreadEvent> {
            for (const event of events) {
              if (event.type === 'thread.started') {
                id = event.thread_id;
              }
              yield event;
            }
          }
          return Promise.resolve({ events: stream() });
        }
      };
    };
    const client: CodexClient = {
      startThread: (threadOptions) => thread(undefined, threadOptions),
      resumeThread: (id, threadOptions) => thread(id, threadOptions)
    };
    return client;
  };
  return { factory, runs };
}
