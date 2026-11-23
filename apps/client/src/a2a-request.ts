import { randomUUID } from 'node:crypto';
import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, SendMessageResult } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';

/** What the smoke test prints: the final task state and the text of its artifacts. */
export interface AskResult {
  state: string;
  artifactText: string;
}

/** A request carrying one user text message in a new context. */
export function userTextRequest(prompt: string): SendMessageRequest {
  return {
    tenant: '',
    message: {
      messageId: randomUUID(),
      contextId: '',
      taskId: '',
      role: Role.ROLE_USER,
      parts: [{ content: { $case: 'text', value: prompt }, metadata: undefined, filename: '', mediaType: 'text/plain' }],
      metadata: undefined,
      extensions: [],
      referenceTaskIds: []
    },
    configuration: undefined,
    metadata: undefined
  };
}

/** Reads the final state and the artifact text of a task; a direct message reply has no task state. */
export function describeResult(result: SendMessageResult): AskResult {
  if (!('artifacts' in result)) {
    return { state: 'MESSAGE', artifactText: '' };
  }
  const texts = result.artifacts.flatMap(({ parts }) => parts.flatMap(({ content }) => (content?.$case === 'text' ? [content.value] : [])));
  return { state: TaskState[result.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED], artifactText: texts.join('\n\n') };
}

/** Sends `prompt` to the agent whose card is at `cardUrl` and waits for the task to end. */
export async function sendPrompt(cardUrl: string, prompt: string): Promise<AskResult> {
  // An empty path: the card URL is already the full address of the card.
  const client = await new ClientFactory().createFromUrl(cardUrl, '');
  return describeResult(await client.sendMessage(userTextRequest(prompt)));
}
