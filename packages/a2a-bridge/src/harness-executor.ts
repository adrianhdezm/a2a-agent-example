import { TaskState } from '@a2a-js/sdk';
import { TaskNotCancelableError } from '@a2a-js/sdk/errors';
import { AgentEvent } from '@a2a-js/sdk/server';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import type { Harness, Session, SessionConfig, TurnEndedEvent } from '@a2a-agent-example/harness';
import { messageText, resultArtifact, statusUpdate, submittedTask } from './a2a-message.ts';
import type { TaskIds } from './a2a-message.ts';

/** Where the executor keeps the harness session id of each A2A context. A `Map` is the in-memory one. */
export type SessionIdStore = Pick<Map<string, string>, 'get' | 'set'>;

/** Where the executor reports how each turn ends; a Pino logger is one. */
export interface TurnLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface HarnessExecutorOptions {
  /** The harness every turn runs on. */
  harness: Harness;
  /** What each session starts or resumes with: the workspace, the instructions, the model. */
  sessionConfig: SessionConfig;
  sessions: SessionIdStore;
  /** Reports each turn's end; nothing is reported without one. */
  logger?: TurnLogger;
}

const silent: TurnLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

interface TurnResult {
  state: TaskState;
  text: string;
}

/**
 * An A2A SDK `AgentExecutor` that runs a harness: each message runs one turn of the harness session of its
 * `contextId`, published as submitted → working (with each agent message) → a `result` artifact → completed or failed.
 */
export class HarnessExecutor implements AgentExecutor {
  readonly #harness: Harness;
  readonly #sessionConfig: SessionConfig;
  readonly #sessions: SessionIdStore;
  readonly #logger: TurnLogger;

  constructor({ harness, sessionConfig, sessions, logger = silent }: HarnessExecutorOptions) {
    this.#harness = harness;
    this.#sessionConfig = sessionConfig;
    this.#sessions = sessions;
    this.#logger = logger;
  }

  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const ids = { taskId: context.taskId, contextId: context.contextId };
    eventBus.publish(AgentEvent.task(context.task ?? submittedTask(ids, context.userMessage)));
    eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, TaskState.TASK_STATE_WORKING)));
    let session: Session | undefined;
    try {
      session = this.#sessionFor(ids.contextId);
      this.#publishResult(ids, await this.#runTurn(session, messageText(context.userMessage), ids, eventBus), eventBus);
    } catch (error) {
      this.#logger.error({ err: error, ...ids }, 'the harness turn threw');
      this.#publishResult(ids, failed(error instanceof Error ? error.message : String(error)), eventBus);
    } finally {
      if (session?.id !== undefined) {
        this.#sessions.set(ids.contextId, session.id);
      }
      eventBus.finished();
    }
  }

  // Cancellation is out of scope for now: every task runs to its end.
  cancelTask(taskId: string): Promise<void> {
    return Promise.reject(new TaskNotCancelableError({ message: `Task ${taskId} cannot be canceled` }));
  }

  #sessionFor(contextId: string): Session {
    const sessionId = this.#sessions.get(contextId);
    return sessionId === undefined
      ? this.#harness.startSession(this.#sessionConfig)
      : this.#harness.resumeSession(sessionId, this.#sessionConfig);
  }

  async #runTurn(session: Session, input: string, ids: TaskIds, eventBus: ExecutionEventBus): Promise<TurnResult> {
    const messages: string[] = [];
    for await (const event of session.runTurn(input)) {
      switch (event.type) {
        case 'agent.message':
          messages.push(event.text);
          eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, TaskState.TASK_STATE_WORKING, event.text)));
          break;
        case 'turn.ended':
          return turnResult(event, messages);
      }
    }
    return failed('The harness ended the turn without a result');
  }

  #publishResult(ids: TaskIds, result: TurnResult, eventBus: ExecutionEventBus): void {
    const fields = { ...ids, state: TaskState[result.state] };
    if (result.state === TaskState.TASK_STATE_FAILED) {
      this.#logger.warn({ ...fields, error: result.text }, 'turn failed');
    } else {
      this.#logger.info(fields, 'turn ended');
    }
    eventBus.publish(AgentEvent.artifactUpdate(resultArtifact(ids, result.text)));
    eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, result.state)));
  }
}

function turnResult(event: TurnEndedEvent, messages: string[]): TurnResult {
  if (event.outcome === 'completed') {
    return { state: TaskState.TASK_STATE_COMPLETED, text: event.finalText ?? messages.join('\n\n') };
  }
  return failed(event.error ?? 'The turn failed');
}

function failed(text: string): TurnResult {
  return { state: TaskState.TASK_STATE_FAILED, text };
}
