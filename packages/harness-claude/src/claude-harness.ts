import { query } from '@anthropic-ai/claude-agent-sdk';
import { Harness } from '@a2a-agent-example/harness-core';
import type { SessionConfig } from '@a2a-agent-example/harness-core';
import { ClaudeSession } from './claude-session.ts';
import type { ClaudeQuery } from './claude-session.ts';

export interface ClaudeHarnessOptions {
  apiKey: string;
  /** The most agentic turns (model round trips) one harness turn may take. */
  maxTurns: number;
  /** The SDK's `query()` unless a test hands in its own. */
  query?: ClaudeQuery;
}

/** The `claude` harness: agents run on the Claude Agent SDK. */
export class ClaudeHarness extends Harness {
  readonly #options: Required<ClaudeHarnessOptions>;

  constructor({ apiKey, maxTurns, query: claudeQuery = query }: ClaudeHarnessOptions) {
    super('claude');
    this.#options = { apiKey, maxTurns, query: claudeQuery };
  }

  override startSession(config: SessionConfig): ClaudeSession {
    return new ClaudeSession(undefined, config, this.#options);
  }

  override resumeSession(id: string, config: SessionConfig): ClaudeSession {
    return new ClaudeSession(id, config, this.#options);
  }
}
