import type { CodexOptions, ThreadEvent, ThreadOptions } from '@openai/codex-sdk';

// The parts of the SDK's Codex and Thread classes the driver uses, so tests can hand it recorded events.

export interface CodexThread {
  readonly id: string | null;
  runStreamed(input: string): Promise<{ events: AsyncIterable<ThreadEvent> }>;
}

export interface CodexClient {
  startThread(options: ThreadOptions): CodexThread;
  resumeThread(id: string, options: ThreadOptions): CodexThread;
}

export type CreateCodexClient = (options: CodexOptions) => CodexClient;
