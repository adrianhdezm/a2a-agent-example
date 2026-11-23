import { Codex } from '@openai/codex-sdk';
import { Harness } from '@a2a-agent-example/harness-core';
import type { SessionConfig } from '@a2a-agent-example/harness-core';
import type { CreateCodexClient } from './codex-client.ts';
import { CodexSession } from './codex-session.ts';

export interface CodexHarnessOptions {
  apiKey: string;
  /** Builds the SDK's Codex client unless a test hands in its own. */
  createCodex?: CreateCodexClient;
}

/** The `codex` harness: agents run on the Codex SDK. */
export class CodexHarness extends Harness {
  readonly #options: Required<CodexHarnessOptions>;

  constructor({ apiKey, createCodex = (options) => new Codex(options) }: CodexHarnessOptions) {
    super('codex');
    this.#options = { apiKey, createCodex };
  }

  override startSession(config: SessionConfig): CodexSession {
    return new CodexSession(undefined, config, this.#options);
  }

  override resumeSession(id: string, config: SessionConfig): CodexSession {
    return new CodexSession(id, config, this.#options);
  }
}
