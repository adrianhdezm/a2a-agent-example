/** How a turn ends: the question is answered, or the agent needs the user to tell it more. */
export type TurnOutcome = 'completed' | 'input-required';

/** What one agent turn reports, reduced to what the A2A side needs. */
export type TurnEvent =
  /** The SDK session the turn runs in (a Claude session, a Codex thread); the next turn in the conversation resumes it. */
  | { type: 'session'; sessionId: string }
  /** Something the agent is doing on the way to its answer: text before a tool call, or the call itself. */
  | { type: 'progress'; text: string }
  /** The end of the turn: the answer or the agent's question, or why there is none. */
  | { type: 'result'; ok: true; outcome: TurnOutcome; text: string }
  | { type: 'result'; ok: false; error: string };

export interface TurnRequest {
  prompt: string;
  /** The SDK session to resume; a new one starts without it. */
  sessionId?: string;
  abortController: AbortController;
}

/** Runs one agent turn: a runner with its settings bound, or a fake in tests. */
export type RunTurn = (request: TurnRequest) => AsyncIterable<TurnEvent>;
