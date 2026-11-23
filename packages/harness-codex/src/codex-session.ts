import type { ThreadOptions } from '@openai/codex-sdk';
import { Session } from '@a2a-agent-example/harness-core';
import type { HarnessEvent, SessionConfig } from '@a2a-agent-example/harness-core';
import type { CodexClient, CodexThread, CreateCodexClient } from './codex-client.ts';
import { codexThreadId, translateCodexEvent } from './codex-translation.ts';

export interface CodexSessionSettings {
  apiKey: string;
  createCodex: CreateCodexClient;
}

/** A Codex SDK thread: started or resumed on the first turn, run with `runStreamed` once per turn. */
export class CodexSession extends Session {
  readonly #config: SessionConfig;
  readonly #codex: CodexClient;
  #thread: CodexThread | undefined;

  constructor(id: string | undefined, config: SessionConfig, settings: CodexSessionSettings) {
    super(id);
    this.#config = config;
    // Codex takes no per-thread system prompt: the instructions go in as the client's `developer_instructions`.
    this.#codex = settings.createCodex({ apiKey: settings.apiKey, config: { developer_instructions: config.instructions } });
  }

  override async *runTurn(input: string): AsyncIterable<HarnessEvent> {
    try {
      yield* this.#translate(await this.#threadFor().runStreamed(input));
    } catch (error) {
      yield { type: 'turn.ended', outcome: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  }

  async *#translate(turn: Awaited<ReturnType<CodexThread['runStreamed']>>): AsyncIterable<HarnessEvent> {
    let lastText: string | undefined;
    for await (const sdkEvent of turn.events) {
      this.id = codexThreadId(sdkEvent) ?? this.id;
      for (const event of translateCodexEvent(sdkEvent)) {
        if (event.type === 'turn.ended') {
          // Codex's own final response is the turn's last agent message.
          yield event.outcome === 'completed' ? { ...event, finalText: lastText } : event;
          return;
        }
        lastText = event.text;
        yield event;
      }
    }
    yield { type: 'turn.ended', outcome: 'failed', error: 'The Codex turn ended without a result' };
  }

  #threadFor(): CodexThread {
    this.#thread ??=
      this.id === undefined ? this.#codex.startThread(this.#threadOptions()) : this.#codex.resumeThread(this.id, this.#threadOptions());
    return this.#thread;
  }

  #threadOptions(): ThreadOptions {
    return {
      workingDirectory: this.#config.workspace,
      sandboxMode: 'workspace-write',
      model: this.#config.model,
      // An agent's workspace is a plain folder, not necessarily a git checkout.
      skipGitRepoCheck: true
    };
  }
}
