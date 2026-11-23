import type { Harness, SessionConfig } from '@a2a-agent-example/harness';
import type { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { HarnessExecutor } from './harness-executor.ts';
import type { TurnLogger } from './harness-executor.ts';

/** What the host needs to run one agent. */
export interface HostedAgent {
  card: AgentCard;
  /** The harness every turn of the agent runs on. */
  harness: Harness;
  sessionConfig: SessionConfig;
  logger?: TurnLogger;
}

// What outlives a change to the agent: its tasks and the harness session of each A2A context.
interface AgentState {
  taskStore: InMemoryTaskStore;
  sessions: Map<string, string>;
  requestHandler: DefaultRequestHandler;
}

/**
 * Runs agents on harnesses behind the A2A SDK, by an id the app chooses: each one gets a request handler with its
 * own task store and sessions, rebuilt on a change without losing either. It serves no transport; the app puts one in
 * front of each request handler (`@a2a-agent-example/a2a-bridge/express` has Express's).
 */
export class AgentHost {
  readonly #agents = new Map<string, AgentState>();

  /**
   * Opens the agent, or reopens it after a change: the card and the executor follow the new agent, while its tasks
   * and sessions carry over, so a conversation goes on with the new instructions.
   */
  open(id: string, { card, harness, sessionConfig, logger }: HostedAgent): DefaultRequestHandler {
    const previous = this.#agents.get(id);
    const taskStore = previous?.taskStore ?? new InMemoryTaskStore();
    const sessions = previous?.sessions ?? new Map<string, string>();
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions, logger });
    const requestHandler = new DefaultRequestHandler(card, taskStore, executor);
    this.#agents.set(id, { taskStore, sessions, requestHandler });
    return requestHandler;
  }

  /** The agent's request handler, or undefined when it is not open. */
  get(id: string): DefaultRequestHandler | undefined {
    return this.#agents.get(id)?.requestHandler;
  }

  /** Closes the agent, dropping its tasks and sessions; tasks already running finish on their own. */
  close(id: string): void {
    this.#agents.delete(id);
  }
}
