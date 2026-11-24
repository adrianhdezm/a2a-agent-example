import { randomUUID } from 'node:crypto';
import { Role, TaskState } from '@a2a-js/sdk';
import type { Message, Part, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';

/** The task and context every event of one execution belongs to. */
export interface TaskIds {
  taskId: string;
  contextId: string;
}

export function textPart(text: string): Part {
  return { content: { $case: 'text', value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' };
}

/** The text of a message: its text parts, in order, separated by blank lines; other parts are left out. */
export function messageText(message: Message): string {
  return message.parts.flatMap((part) => (part.content?.$case === 'text' ? [part.content.value] : [])).join('\n\n');
}

export function agentMessage(ids: TaskIds, text: string): Message {
  return {
    messageId: randomUUID(),
    ...ids,
    role: Role.ROLE_AGENT,
    parts: [textPart(text)],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: []
  };
}

/** A new task in `TASK_STATE_SUBMITTED`, holding the user's message. */
export function submittedTask(ids: TaskIds, userMessage: Message): Task {
  return {
    id: ids.taskId,
    contextId: ids.contextId,
    status: { state: TaskState.TASK_STATE_SUBMITTED, message: undefined, timestamp: new Date().toISOString() },
    artifacts: [],
    history: [userMessage],
    metadata: undefined
  };
}

/** A status update to `state`, carrying `text` as an agent message when given. */
export function statusUpdate(ids: TaskIds, state: TaskState, text?: string): TaskStatusUpdateEvent {
  return {
    ...ids,
    status: { state, message: text === undefined ? undefined : agentMessage(ids, text), timestamp: new Date().toISOString() },
    metadata: undefined
  };
}

/** The agent's answer as one complete text artifact named `forecast`. */
export function forecastArtifact(ids: TaskIds, text: string): TaskArtifactUpdateEvent {
  return {
    ...ids,
    artifact: {
      artifactId: randomUUID(),
      name: 'forecast',
      description: "The weather agent's answer",
      parts: [textPart(text)],
      metadata: undefined,
      extensions: []
    },
    append: false,
    lastChunk: true,
    metadata: undefined
  };
}
