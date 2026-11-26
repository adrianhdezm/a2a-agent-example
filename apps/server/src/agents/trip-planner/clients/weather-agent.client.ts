import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse, TaskStatus } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import type { Client } from '@a2a-js/sdk/client';
import { partsText, textPart } from '../../core/a2a-agent.ts';
import type { CodexConsultant, TurnEvent } from '../../core/a2a-agent.ts';

/** Connects to the A2A agent at `url`: the A2A SDK's client from its card, unless a test hands in its own. */
export type ConnectAgent = (url: string) => Promise<Pick<Client, 'sendMessageStream' | 'cancelTask'>>;

/** The weather agent's conversation for one Codex thread: its context, and its task while it waits for an answer. */
interface Conversation {
  contextId: string;
  taskId: string;
}

const connectFromCard: ConnectAgent = (url) => new ClientFactory().createFromUrl(url);

/** The question as an A2A message, in the conversation's context and waiting task when it has them. */
function question(text: string, conversation: Conversation | undefined): SendMessageRequest {
  return {
    tenant: '',
    message: {
      messageId: crypto.randomUUID(),
      contextId: conversation?.contextId ?? '',
      taskId: conversation?.taskId ?? '',
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

type ReadStatus = (text: string, answer: string, state: TaskState) => TurnEvent | undefined;

const endedWithoutAnswer: ReadStatus = (text, _answer, state) => ({ type: 'result', ok: false, error: text || TaskState[state] });

// What each state the weather agent reports means for the question: progress, its question, its answer, or no answer.
const statusReaders: Partial<Record<TaskState, ReadStatus>> = {
  [TaskState.TASK_STATE_WORKING]: (text) => (text === '' ? undefined : { type: 'progress', text }),
  [TaskState.TASK_STATE_INPUT_REQUIRED]: (text) => ({ type: 'result', ok: true, outcome: 'input-required', text }),
  [TaskState.TASK_STATE_COMPLETED]: (text, answer) => ({ type: 'result', ok: true, outcome: 'completed', text: answer || text }),
  [TaskState.TASK_STATE_FAILED]: endedWithoutAnswer,
  [TaskState.TASK_STATE_CANCELED]: endedWithoutAnswer,
  [TaskState.TASK_STATE_REJECTED]: endedWithoutAnswer
};

/** What a status update says, as a turn event, given the answer text the artifacts have carried so far. */
function readStatus(status: TaskStatus | undefined, answer: string): TurnEvent | undefined {
  const state = status?.state ?? TaskState.TASK_STATE_UNSPECIFIED;
  return statusReaders[state]?.(partsText(status?.message?.parts), answer, state);
}

/** What one streamed A2A event says, as a turn event, given the answer text the artifacts have carried so far. */
export function readWeatherEvent(event: StreamResponse, answer: string): TurnEvent | undefined {
  const { payload } = event;
  if (payload?.$case === 'message') {
    return { type: 'result', ok: true, outcome: 'completed', text: partsText(payload.value.parts) };
  }
  return payload?.$case === 'statusUpdate' ? readStatus(payload.value.status, answer) : undefined;
}

/** What one question has seen of the weather agent's task: its ids, and the answer text its artifacts carried. */
interface Seen {
  contextId: string;
  taskId?: string;
  answer: string;
}

/** Notes what `event` says of the task in `seen`, and returns it as a turn event. */
function track(seen: Seen, event: StreamResponse): TurnEvent | undefined {
  const { payload } = event;
  if (payload?.$case === 'task') {
    seen.contextId = payload.value.contextId;
    seen.taskId = payload.value.id;
  } else if (payload?.$case === 'artifactUpdate') {
    seen.answer += partsText(payload.value.artifact?.parts);
  }
  return readWeatherEvent(event, seen.answer);
}

/** Where the thread's next question goes: the task, only while it waits for an answer; otherwise a new one in the context. */
function nextConversation(seen: Seen, result: TurnEvent): Conversation {
  const continues = result.type === 'result' && result.ok && result.outcome === 'input-required';
  return { contextId: seen.contextId, taskId: continues ? (seen.taskId ?? '') : '' };
}

/** Cancels the weather agent's task, at best: the question is already given up on. */
async function cancel(agent: Awaited<ReturnType<ConnectAgent>>, taskId: string): Promise<void> {
  await agent.cancelTask({ tenant: '', id: taskId, metadata: undefined }).catch(() => undefined);
}

/**
 * The weather agent, reached over A2A at `url`, as the trip planner's consultant. Each Codex thread gets a weather
 * conversation of its own, so follow-up questions keep its context, and an answer to its question continues its task.
 * Aborting a question cancels the weather agent's task.
 */
export function weatherAgentClient(url: string, connect: ConnectAgent = connectFromCard): CodexConsultant {
  let client: ReturnType<ConnectAgent> | undefined;
  const conversations = new Map<string, Conversation>();
  return {
    name: 'Weather Agent',
    async *ask(text, { threadId, signal }) {
      // Connected on the first question, not before: the weather agent may be served by the server that is starting.
      client ??= connect(url);
      const agent = await client;
      const waiting = conversations.get(threadId);
      const seen: Seen = { contextId: waiting?.contextId ?? '', answer: '' };
      const stream = agent.sendMessageStream(question(text, waiting), { signal });
      try {
        for await (const event of stream) {
          const turnEvent = track(seen, event);
          if (turnEvent?.type === 'result') {
            conversations.set(threadId, nextConversation(seen, turnEvent));
          }
          if (turnEvent !== undefined) {
            yield turnEvent;
          }
        }
      } finally {
        if (signal.aborted && seen.taskId !== undefined) {
          await cancel(agent, seen.taskId);
        }
      }
    }
  };
}
