/** What one agent turn reports, reduced to what the A2A side needs. */
export type TurnEvent =
  /** The Claude session the turn runs in; the next turn in the same conversation resumes it. */
  | { type: 'session'; sessionId: string }
  /** Something the agent is doing on the way to its answer: text before a tool call, or the call itself. */
  | { type: 'progress'; text: string }
  /** The end of the turn: the answer, or why there is none. */
  | { type: 'result'; ok: true; text: string }
  | { type: 'result'; ok: false; error: string };

export interface TurnRequest {
  prompt: string;
  /** The Claude session to resume; a new one starts without it. */
  sessionId?: string;
  abortController: AbortController;
}

/** Runs one agent turn: the Claude client with its settings bound, or a fake in tests. */
export type RunTurn = (request: TurnRequest) => AsyncIterable<TurnEvent>;
