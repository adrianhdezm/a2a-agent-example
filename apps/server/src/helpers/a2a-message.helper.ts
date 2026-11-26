import { randomUUID } from 'node:crypto';
import { Role, TaskState } from '@a2a-js/sdk';
import type { Message, Part, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';

/** Which task, in which conversation (context): what every A2A event of one execution points to. */
export interface TaskRef {
  taskId: string;
  contextId: string;
}

/** A plain-text A2A 1.0 part. */
export function textPart(text: string): Part {
  return { content: { $case: 'text', value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' };
}

/** The text of some parts, one line per text part; parts that are not text are left out. */
export function partsText(parts: readonly Part[] | undefined): string {
  return (parts ?? []).flatMap(({ content }) => (content?.$case === 'text' ? [content.value] : [])).join('\n');
}

export function agentMessage(taskRef: TaskRef, text: string): Message {
  return {
    messageId: randomUUID(),
    ...taskRef,
    role: Role.ROLE_AGENT,
    parts: [textPart(text)],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: []
  };
}

/** A new task in `TASK_STATE_SUBMITTED`, holding the user's message. */
export function submittedTask(taskRef: TaskRef, userMessage: Message): Task {
  return {
    id: taskRef.taskId,
    contextId: taskRef.contextId,
    status: { state: TaskState.TASK_STATE_SUBMITTED, message: undefined, timestamp: new Date().toISOString() },
    artifacts: [],
    history: [userMessage],
    metadata: undefined
  };
}

/** A status update to `state`, carrying `text` as an agent message when given. */
export function statusUpdate(taskRef: TaskRef, state: TaskState, text?: string): TaskStatusUpdateEvent {
  return {
    ...taskRef,
    status: { state, message: text === undefined ? undefined : agentMessage(taskRef, text), timestamp: new Date().toISOString() },
    metadata: undefined
  };
}

/** What an agent calls the artifact that holds its answer. */
export interface AnswerArtifact {
  name: string;
  description: string;
}

/** The agent's answer as one complete text artifact, named and described as `answer` says. */
export function answerArtifact(taskRef: TaskRef, text: string, answer: AnswerArtifact): TaskArtifactUpdateEvent {
  return {
    ...taskRef,
    artifact: {
      artifactId: randomUUID(),
      name: answer.name,
      description: answer.description,
      parts: [textPart(text)],
      metadata: undefined,
      extensions: []
    },
    append: false,
    lastChunk: true,
    metadata: undefined
  };
}
