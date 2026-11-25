import { randomUUID } from 'node:crypto';
import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse, TaskStatusUpdateEvent } from '@a2a-js/sdk';

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
        parts: [{ content: { $case: 'text', value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' }],
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
    switch (payload?.$case) {
      case 'task':
        this.#follow(payload.value.contextId, payload.value.id);
        break;
      case 'statusUpdate':
        this.#followStatus(payload.value);
        break;
      case 'message':
        // An agent may answer with a plain message, which carries the ids it chose when it has any.
        this.#follow(payload.value.contextId || this.#contextId, payload.value.taskId || this.#taskId);
        break;
    }
  }

  #followStatus({ contextId, taskId, status }: TaskStatusUpdateEvent): void {
    const state = status?.state;
    this.#follow(contextId, state !== undefined && finalStates.has(state) ? undefined : taskId);
  }

  #follow(contextId: string | undefined, taskId: string | undefined): void {
    this.#contextId = contextId;
    this.#taskId = taskId;
  }

  /** Starts over: the next message opens a new context. */
  reset(): void {
    this.#contextId = undefined;
    this.#taskId = undefined;
  }
}
