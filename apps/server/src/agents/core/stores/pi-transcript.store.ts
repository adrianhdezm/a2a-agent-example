import type { AgentMessage } from '@mariozechner/pi-agent-core';

/**
 * The transcript of each Pi session, kept in memory. Pi keeps no sessions of its own, unlike the Claude and Codex
 * SDKs, so the Pi runner keeps them here; a store that outlives a restart replaces it behind the same `get` and `set`.
 */
export class PiTranscriptStore {
  readonly #transcripts = new Map<string, AgentMessage[]>();

  /** The session's messages so far, or none for a new or unknown session. */
  get(sessionId: string): AgentMessage[] {
    return this.#transcripts.get(sessionId) ?? [];
  }

  set(sessionId: string, messages: AgentMessage[]): void {
    this.#transcripts.set(sessionId, messages);
  }
}
