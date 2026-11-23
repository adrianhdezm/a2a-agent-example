/** Text the agent produced during a turn. */
export interface AgentMessageEvent {
  type: 'agent.message';
  text: string;
}

export type TurnOutcome = 'completed' | 'failed';

/** The last event of every turn. */
export interface TurnEndedEvent {
  type: 'turn.ended';
  outcome: TurnOutcome;
  /** The agent's final answer, when the harness reports one. */
  finalText?: string;
  /** What went wrong, when the turn failed. */
  error?: string;
}

/**
 * A normalized event from any harness, tagged by `type`. New kinds (`tool.started`, `tool.finished`, `usage`,
 * `approval.needed`) join this union; consumers ignore kinds they do not handle.
 */
export type HarnessEvent = AgentMessageEvent | TurnEndedEvent;
