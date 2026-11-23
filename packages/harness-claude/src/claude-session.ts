import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { Session } from '@a2a-agent-example/harness-core';
import type { HarnessEvent, SessionConfig } from '@a2a-agent-example/harness-core';
import { claudeSessionId, translateClaudeMessage } from './claude-translation.ts';

/** The shape of the SDK's `query()` this driver uses, so tests can hand it recorded messages. */
export type ClaudeQuery = (params: { prompt: string; options: Options }) => AsyncIterable<SDKMessage>;

export interface ClaudeSessionSettings {
  apiKey: string;
  maxTurns: number;
  query: ClaudeQuery;
}

const allowedTools = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];

/** A Claude Agent SDK session: one `query()` per turn, resumed by the session id the first turn announced. */
export class ClaudeSession extends Session {
  readonly #config: SessionConfig;
  readonly #settings: ClaudeSessionSettings;

  constructor(id: string | undefined, config: SessionConfig, settings: ClaudeSessionSettings) {
    super(id);
    this.#config = config;
    this.#settings = settings;
  }

  override async *runTurn(input: string): AsyncIterable<HarnessEvent> {
    let ended = false;
    try {
      for await (const message of this.#settings.query({ prompt: input, options: this.#options() })) {
        this.id = claudeSessionId(message) ?? this.id;
        for (const event of translateClaudeMessage(message)) {
          ended ||= event.type === 'turn.ended';
          yield event;
        }
      }
    } catch (error) {
      yield { type: 'turn.ended', outcome: 'failed', error: error instanceof Error ? error.message : String(error) };
      return;
    }
    if (!ended) {
      yield { type: 'turn.ended', outcome: 'failed', error: 'The Claude query ended without a result' };
    }
  }

  #options(): Options {
    return {
      cwd: this.#config.workspace,
      resume: this.id,
      systemPrompt: this.#config.instructions,
      model: this.#config.model,
      allowedTools,
      permissionMode: 'acceptEdits',
      maxTurns: this.#settings.maxTurns,
      // The SDK replaces the child process's environment with this one, so it keeps the rest of ours (PATH, HOME).
      env: { ...process.env, ANTHROPIC_API_KEY: this.#settings.apiKey }
    };
  }
}
