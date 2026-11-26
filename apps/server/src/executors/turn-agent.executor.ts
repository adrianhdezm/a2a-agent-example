import { TaskState } from '@a2a-js/sdk';
import { AgentEvent } from '@a2a-js/sdk/server';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { answerArtifact, partsText, statusUpdate, submittedTask } from '../helpers/a2a-message.helper.ts';
import type { AnswerArtifact, TaskRef } from '../helpers/a2a-message.helper.ts';
import { logger } from '../logger.ts';
import type { RunTurn } from '../models/turn.model.ts';
import { completedMarker, inputRequiredMarker } from '../prompts/turn-end.prompt.ts';
import type { SessionStore } from '../stores/session.store.ts';

/** How a turn ended, as the task's final state and the text that goes with it. */
interface TurnEnd {
  state: TaskState;
  text: string;
}

/** What a `TurnAgentExecutor` runs on: how it runs a turn, where it keeps sessions, and what it calls its answer. */
export interface TurnAgentOptions {
  runTurn: RunTurn;
  sessions: SessionStore;
  answerArtifact: AnswerArtifact;
}

/**
 * Any agent that answers in turns, behind A2A. Each message runs one turn in the session of its `contextId`, so a
 * conversation keeps its history; the turn streams as `WORKING` updates and ends `COMPLETED` with the answer as an
 * artifact, `INPUT_REQUIRED` with the agent's question, `FAILED`, or `CANCELED`. The agent's prompt must end with
 * `turnEndInstructions`, whose marker says which.
 */
export class TurnAgentExecutor implements AgentExecutor {
  readonly #runTurn: RunTurn;
  readonly #sessions: SessionStore;
  readonly #answerArtifact: AnswerArtifact;
  readonly #running = new Map<string, AbortController>();

  constructor({ runTurn, sessions, answerArtifact }: TurnAgentOptions) {
    this.#runTurn = runTurn;
    this.#sessions = sessions;
    this.#answerArtifact = answerArtifact;
  }

  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const taskRef = { taskId: context.taskId, contextId: context.contextId };
    eventBus.publish(AgentEvent.task(context.task ?? submittedTask(taskRef, context.userMessage)));
    eventBus.publish(AgentEvent.statusUpdate(statusUpdate(taskRef, TaskState.TASK_STATE_WORKING, 'Looking into it…')));
    const abortController = new AbortController();
    this.#running.set(taskRef.taskId, abortController);
    try {
      const end = await this.#runOneTurn(taskRef, partsText(context.userMessage.parts), abortController, eventBus);
      this.#publishEnd(taskRef, end, eventBus);
    } catch (error) {
      const end = abortController.signal.aborted
        ? { state: TaskState.TASK_STATE_CANCELED, text: 'Cancelled.' }
        : { state: TaskState.TASK_STATE_FAILED, text: `Agent error: ${error instanceof Error ? error.message : String(error)}` };
      this.#publishEnd(taskRef, end, eventBus);
    } finally {
      this.#running.delete(taskRef.taskId);
      eventBus.finished();
    }
  }

  /** Stops the task's running turn; `execute` then ends the task `CANCELED`. */
  cancelTask(taskId: string): Promise<void> {
    this.#running.get(taskId)?.abort();
    return Promise.resolve();
  }

  async #runOneTurn(taskRef: TaskRef, prompt: string, abortController: AbortController, eventBus: ExecutionEventBus): Promise<TurnEnd> {
    const sessionId = this.#sessions.get(taskRef.contextId);
    const turn = this.#runTurn({ prompt, sessionId, abortController });
    for await (const event of turn) {
      switch (event.type) {
        case 'session':
          this.#sessions.set(taskRef.contextId, event.sessionId);
          break;
        case 'progress':
          eventBus.publish(AgentEvent.statusUpdate(statusUpdate(taskRef, TaskState.TASK_STATE_WORKING, event.text)));
          break;
        case 'result': {
          if (!event.ok) {
            return { state: TaskState.TASK_STATE_FAILED, text: `Agent error: ${event.error}` };
          }
          // The answer's last line is the marker turnEndInstructions asks for. An answer without one counts as
          // completed, so a model that forgets the marker still delivers its answer.
          const lines = event.text.trimEnd().split('\n');
          const marker = lines.at(-1)?.trim().toUpperCase();
          const text =
            marker === completedMarker || marker === inputRequiredMarker ? lines.slice(0, -1).join('\n').trim() : event.text.trim();
          return marker === inputRequiredMarker
            ? { state: TaskState.TASK_STATE_INPUT_REQUIRED, text }
            : { state: TaskState.TASK_STATE_COMPLETED, text: text || 'Done.' };
        }
      }
    }
    if (abortController.signal.aborted) {
      return { state: TaskState.TASK_STATE_CANCELED, text: 'Cancelled.' };
    }
    return { state: TaskState.TASK_STATE_FAILED, text: 'Agent error: the turn ended without an answer' };
  }

  // A completed answer becomes the answer artifact; a question, a failure or a cancellation rides on the status.
  #publishEnd(taskRef: TaskRef, end: TurnEnd, eventBus: ExecutionEventBus): void {
    const fields = { ...taskRef, state: TaskState[end.state] };
    if (end.state === TaskState.TASK_STATE_FAILED) {
      logger.warn({ ...fields, error: end.text }, 'turn failed');
    } else {
      logger.info(fields, 'turn ended');
    }
    if (end.state === TaskState.TASK_STATE_COMPLETED) {
      eventBus.publish(AgentEvent.artifactUpdate(answerArtifact(taskRef, end.text, this.#answerArtifact)));
      eventBus.publish(AgentEvent.statusUpdate(statusUpdate(taskRef, end.state)));
      return;
    }
    eventBus.publish(AgentEvent.statusUpdate(statusUpdate(taskRef, end.state, end.text)));
  }
}
