import { TaskState } from '@a2a-js/sdk';
import { TaskNotCancelableError } from '@a2a-js/sdk/errors';
import { AgentEvent } from '@a2a-js/sdk/server';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import type { AgentDefinition } from '@a2a-agent-example/agent-registry';
import type { Harness, Session, TurnEndedEvent } from '@a2a-agent-example/harness-core';
import { messageText, resultArtifact, statusUpdate, submittedTask } from './a2a-events.ts';
import type { TaskIds } from './a2a-events.ts';

/** Where the executor keeps the harness session id of each A2A context. A `Map` is the in-memory one. */
export type SessionIdStore = Pick<Map<string, string>, 'get' | 'set'>;

export interface HarnessExecutorOptions {
  agent: AgentDefinition;
  harness: Harness;
  sessions: SessionIdStore;
}

interface TurnResult {
  state: TaskState;
  text: string;
}

/**
 * The bridge between A2A and one agent's harness: each message runs one turn of the harness session of its
 * `contextId`, published as submitted → working (with each agent message) → a `result` artifact → completed or failed.
 */
export class HarnessExecutor implements AgentExecutor {
  readonly #agent: AgentDefinition;
  readonly #harness: Harness;
  readonly #sessions: SessionIdStore;

  constructor({ agent, harness, sessions }: HarnessExecutorOptions) {
    this.#agent = agent;
    this.#harness = harness;
    this.#sessions = sessions;
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
    const config = { workspace: this.#agent.workspace, instructions: this.#agent.instructions, model: this.#agent.model };
    const sessionId = this.#sessions.get(contextId);
    return sessionId === undefined ? this.#harness.startSession(config) : this.#harness.resumeSession(sessionId, config);
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
