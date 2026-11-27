import { Role, TaskState } from '@a2a-js/sdk';
import type { SendMessageRequest, StreamResponse } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import type { Client } from '@a2a-js/sdk/client';
import { z } from 'zod';
import { partsText, textPart } from '../helpers/a2a-message.helper.ts';
import { defineTool } from '../helpers/tool.helper.ts';
import { ToolError } from '../models/runner.model.ts';
import type { AgentTool } from '../models/runner.model.ts';

/** Connects to the A2A agent at `url`: the A2A SDK's client from its card, unless a test hands in its own. */
export type ConnectAgent = (url: string) => Promise<Pick<Client, 'sendMessageStream' | 'cancelTask'>>;

/** Which other agent a tool asks, and what the model is told about it. */
export interface AskAgentOptions {
  /** The tool's name, such as `ask_weather_agent`. */
  name: string;
  /** The other agent's name as the model reads it, such as "Weather Agent". */
  agentName: string;
  /** What it knows, for the tool's description: "the weather now and for the next 7 days, anywhere". */
  knows: string;
  /** Its A2A URL. */
  url: string;
  connect?: ConnectAgent;
}

/** The other agent's conversation for one A2A context: its context, and its task while it waits for an answer. */
interface Conversation {
  contextId: string;
  taskId: string;
}

/** What one question saw of the other agent's task: its ids, its answer so far, and how it ended. */
interface Seen {
  contextId: string;
  /** Empty until the other agent reports its task. */
  taskId: string;
  answer: string;
  end?: { state: TaskState; text: string };
}

const endStates = new Set([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_INPUT_REQUIRED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED
]);

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

/** Notes what one streamed event says of the task in `seen`. */
export function track(seen: Seen, event: StreamResponse): void {
  const { payload } = event;
  if (payload?.$case === 'task') {
    seen.contextId = payload.value.contextId;
    seen.taskId = payload.value.id;
  } else if (payload?.$case === 'artifactUpdate') {
    seen.answer += partsText(payload.value.artifact?.parts);
  } else if (payload?.$case === 'message') {
    seen.end = { state: TaskState.TASK_STATE_COMPLETED, text: partsText(payload.value.parts) };
  } else if (payload?.$case === 'statusUpdate') {
    const { status } = payload.value;
    const state = status?.state ?? TaskState.TASK_STATE_UNSPECIFIED;
    if (endStates.has(state)) {
      seen.end = { state, text: partsText(status?.message?.parts) };
    }
  }
}

/**
 * A tool that asks another A2A agent a question, for any runner. Each A2A context keeps a conversation of its own with
 * the other agent, so follow-up questions keep its context, and an answer to its question continues its task.
 * Aborting the turn cancels the other agent's task.
 */
export function askAgentTool(options: AskAgentOptions): AgentTool {
  const connect = options.connect ?? connectFromCard;
  let client: ReturnType<ConnectAgent> | undefined;
  const conversations = new Map<string, Conversation>();
  return defineTool({
    name: options.name,
    description: `Asks the ${options.agentName}, another agent, one question in plain words. It knows ${options.knows}.`,
    input: z.object({ question: z.string().min(1).describe(`Your question for the ${options.agentName}`) }),
    async run({ question: text }, { contextId, signal }) {
      // Connected on the first question, not before: the other agent may be served by the server that is starting.
      client ??= connect(options.url);
      const agent = await client;
      const waiting = conversations.get(contextId);
      const seen: Seen = { contextId: waiting?.contextId ?? '', taskId: '', answer: '' };
      const stream = agent.sendMessageStream(question(text, waiting), { signal });
      try {
        for await (const event of stream) {
          track(seen, event);
        }
      } finally {
        if (signal.aborted && seen.taskId !== '') {
          await agent.cancelTask({ tenant: '', id: seen.taskId, metadata: undefined }).catch(() => undefined);
        }
      }
      // Only a task that waits for an answer is continued; otherwise the next question starts one in the context.
      const { end } = seen;
      const waits = end?.state === TaskState.TASK_STATE_INPUT_REQUIRED;
      conversations.set(contextId, { contextId: seen.contextId, taskId: waits ? seen.taskId : '' });

      // The model is told the answer, or the other agent's question and how to answer it; a failure is a tool error.
      if (end?.state === TaskState.TASK_STATE_COMPLETED) {
        return seen.answer || end.text;
      }
      if (waits) {
        return `The ${options.agentName} asks: ${end.text}\nIf you cannot answer from what you know, ask the user, then call ${options.name} again with their answer.`;
      }
      const why = end === undefined || end.text === '' ? 'it ended without an answer' : end.text;
      throw new ToolError(`The ${options.agentName} could not answer: ${why}`);
    }
  });
}
