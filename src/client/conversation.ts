import { randomUUID } from 'node:crypto';
import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse } from '@a2a-js/sdk';
import { textPart } from '../shared/a2a-text.ts';

// States after which a task takes no more messages; the next message starts a new task in the same context.
const finalStates = new Set<TaskState>([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED
]);

/**
 * One conversation with the agent, as the client sees it: the context every message joins, and the task a message
 * continues while the agent waits for an answer (input-required). The agent's events keep both up to date.
 */
export class Conversation {
  #contextId: string | undefined;
  #taskId: string | undefined;

  /** The task the agent is working on or waiting in, if any. */
  get taskId(): string | undefined {
    return this.#taskId;
  }

  get contextId(): string | undefined {
    return this.#contextId;
  }

  /** The request that sends `text` in this conversation. */
  request(text: string): SendMessageRequest {
    return {
      tenant: '',
      message: {
        messageId: randomUUID(),
        contextId: this.#contextId ?? '',
        taskId: this.#taskId ?? '',
        role: Role.ROLE_USER,
        parts: [textPart(text)],
        metadata: undefined,
        extensions: [],
        referenceTaskIds: []
      },
      configuration: undefined,
      metadata: undefined
    };
  }

  /** Follows the conversation from one event the agent streams back. */
  observe(response: StreamResponse): void {
    const payload = response.payload;
    if (payload?.$case === 'task') {
      this.#contextId = payload.value.contextId;
      this.#taskId = payload.value.id;
    } else if (payload?.$case === 'statusUpdate') {
      this.#contextId = payload.value.contextId;
      const state = payload.value.status?.state;
      this.#taskId = state !== undefined && finalStates.has(state) ? undefined : payload.value.taskId;
    }
  }

  /** Starts over: the next message opens a new context. */
  reset(): void {
    this.#contextId = undefined;
    this.#taskId = undefined;
  }
}
