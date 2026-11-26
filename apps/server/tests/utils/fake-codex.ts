import type { CodexOptions, ThreadEvent, ThreadOptions, TurnOptions } from '@openai/codex-sdk';
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
 * A Codex SDK stand-in whose n-th run streams `script(run)[n]`, the last entry repeating. Like the SDK's, a run on an
 * aborted signal fails.
 */
export function fakeCodex(script: ThreadEvent[][] | ((run: CodexRun) => ThreadEvent[])): FakeCodex {
  const runs: CodexRun[] = [];
  const factory: CodexFactory = (options) => {
    const thread = (resumed: string | undefined, threadOptions: ThreadOptions | undefined): CodexThread => ({
      runStreamed: (input, turnOptions) => {
        turnOptions?.signal?.throwIfAborted();
        const run = { input, resumed, turnOptions, options, threadOptions };
        runs.push(run);
        const events = typeof script === 'function' ? script(run) : (script[Math.min(runs.length, script.length) - 1] ?? []);
        // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
        async function* stream(): AsyncIterable<ThreadEvent> {
          yield* events;
        }
        return Promise.resolve({ events: stream() });
      }
    });
    const client: CodexClient = {
      startThread: (threadOptions) => thread(undefined, threadOptions),
      resumeThread: (id, threadOptions) => thread(id, threadOptions)
    };
    return client;
  };
  return { factory, runs };
}
