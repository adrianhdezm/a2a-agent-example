import { TaskState } from '@a2a-js/sdk';
import { AgentEvent } from '@a2a-js/sdk/server';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { forecastArtifact, partsText, statusUpdate, submittedTask } from '../helpers/a2a-message.helper.ts';
import type { TaskIds } from '../helpers/a2a-message.helper.ts';
import { logger } from '../logger.ts';
import type { RunTurn } from '../models/turn.model.ts';
import { readTurnEnd } from '../prompts/weather.prompt.ts';
import type { SessionStore } from '../stores/session.store.ts';

/** How a turn ended, as the task's final state and the text that goes with it. */
interface TurnEnd {
  state: TaskState;
  text: string;
}

/**
 * The weather agent behind A2A. Each message runs one Claude turn in the Claude session of its `contextId`, so a
 * conversation keeps its history; the turn streams as `WORKING` updates and ends `COMPLETED` with a `forecast`
 * artifact, `INPUT_REQUIRED` with the agent's question, `FAILED`, or `CANCELED`.
 */
export class WeatherAgentExecutor implements AgentExecutor {
  readonly #runTurn: RunTurn;
  readonly #sessions: SessionStore;
  readonly #running = new Map<string, AbortController>();

  constructor(runTurn: RunTurn, sessions: SessionStore) {
    this.#runTurn = runTurn;
    this.#sessions = sessions;
  }

  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const ids = { taskId: context.taskId, contextId: context.contextId };
    eventBus.publish(AgentEvent.task(context.task ?? submittedTask(ids, context.userMessage)));
    eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, TaskState.TASK_STATE_WORKING, 'Looking into it…')));
    const abortController = new AbortController();
    this.#running.set(ids.taskId, abortController);
    try {
      const end = await this.#runOneTurn(ids, partsText(context.userMessage.parts), abortController, eventBus);
      this.#publishEnd(ids, end, eventBus);
    } catch (error) {
      const end = abortController.signal.aborted
        ? { state: TaskState.TASK_STATE_CANCELED, text: 'Cancelled.' }
        : { state: TaskState.TASK_STATE_FAILED, text: `Agent error: ${error instanceof Error ? error.message : String(error)}` };
      this.#publishEnd(ids, end, eventBus);
    } finally {
      this.#running.delete(ids.taskId);
      eventBus.finished();
    }
  }

  /** Stops the task's running turn; `execute` then ends the task `CANCELED`. */
  cancelTask(taskId: string): Promise<void> {
    this.#running.get(taskId)?.abort();
    return Promise.resolve();
  }

  async #runOneTurn(ids: TaskIds, prompt: string, abortController: AbortController, eventBus: ExecutionEventBus): Promise<TurnEnd> {
    for await (const event of this.#runTurn({ prompt, sessionId: this.#sessions.get(ids.contextId), abortController })) {
      switch (event.type) {
        case 'session':
          this.#sessions.set(ids.contextId, event.sessionId);
          break;
        case 'progress':
          eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, TaskState.TASK_STATE_WORKING, event.text)));
          break;
        case 'result': {
          if (!event.ok) {
            return { state: TaskState.TASK_STATE_FAILED, text: `Agent error: ${event.error}` };
          }
          const answer = readTurnEnd(event.text);
          return answer.outcome === 'completed'
            ? { state: TaskState.TASK_STATE_COMPLETED, text: answer.text || 'Done.' }
            : { state: TaskState.TASK_STATE_INPUT_REQUIRED, text: answer.text };
        }
      }
    }
    if (abortController.signal.aborted) {
      return { state: TaskState.TASK_STATE_CANCELED, text: 'Cancelled.' };
    }
    return { state: TaskState.TASK_STATE_FAILED, text: 'Agent error: the turn ended without an answer' };
  }

  // A completed answer becomes the `forecast` artifact; a question, a failure or a cancellation rides on the status.
  #publishEnd(ids: TaskIds, end: TurnEnd, eventBus: ExecutionEventBus): void {
    const fields = { ...ids, state: TaskState[end.state] };
    if (end.state === TaskState.TASK_STATE_FAILED) {
      logger.warn({ ...fields, error: end.text }, 'turn failed');
    } else {
      logger.info(fields, 'turn ended');
    }
    if (end.state === TaskState.TASK_STATE_COMPLETED) {
      eventBus.publish(AgentEvent.artifactUpdate(forecastArtifact(ids, end.text)));
      eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, end.state)));
      return;
    }
    eventBus.publish(AgentEvent.statusUpdate(statusUpdate(ids, end.state, end.text)));
  }
}
