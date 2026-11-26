import { randomUUID } from 'node:crypto';
import { agentLoop } from '@mariozechner/pi-agent-core';
import type { AgentContext, AgentEvent, AgentMessage, AgentTool as PiTool, StreamFn } from '@mariozechner/pi-agent-core';
import { getModels, getProviders } from '@mariozechner/pi-ai';
import type { Api, Message, Model } from '@mariozechner/pi-ai';
import { z } from 'zod';
import { answerJsonSchema, malformedAnswer, readAnswer, toolCallProgress } from '../helpers/answer.helper.ts';
import { runTool } from '../helpers/tool.helper.ts';
import type { Runner, ToolContext, TurnAgent } from '../models/runner.model.ts';
import type { TurnEvent } from '../models/turn.model.ts';
import { PiTranscriptStore } from '../stores/pi-transcript.store.ts';

/**
 * What the Pi runner runs with: the model, as `provider/model` or as a pi-ai model, and Pi's stream function unless a
 * test hands in its own. The provider's key comes from the server's environment, as pi-ai reads it.
 */
export interface PiRunnerOptions {
  model: string | Model<Api>;
  streamFn?: StreamFn;
}

// The tool through which the model delivers its answer: Pi has no structured output, so the answer is a tool call.
const answerTool = 'answer';

const { $schema: _draft, ...answerParameters } = answerJsonSchema();

/** A model named `provider/model`, such as `anthropic/claude-sonnet-4-6`, from pi-ai's catalogue. */
export function piModel(name: string): Model<Api> {
  const [provider = '', ...id] = name.split('/');
  const modelId = id.join('/');
  const known = getProviders().find((candidate) => candidate === provider);
  const model = known === undefined ? undefined : getModels(known).find((candidate) => candidate.id === modelId);
  if (model === undefined) {
    throw new Error(`Pi knows no model "${name}": name one as provider/model, such as anthropic/claude-sonnet-4-6`);
  }
  return model;
}

/** The agent's tools as Pi tools, each told the turn's context when it runs, and the answer tool, which ends the turn. */
function piTools(agent: TurnAgent, context: ToolContext, answers: unknown[]): PiTool[] {
  const tools = agent.tools.map((tool): PiTool => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.input),
    execute: async (_id, input) => {
      const result = await runTool(tool, input, context);
      if (result.isError) {
        // Pi reports a thrown error to the model as a failed call.
        throw new Error(result.text);
      }
      return { content: [{ type: 'text', text: result.text }], details: undefined };
    }
  }));
  const answer: PiTool = {
    name: answerTool,
    label: answerTool,
    description: 'Ends your turn with your answer, or your question to the user. Call it once, last, on every turn.',
    parameters: answerParameters,
    execute: (_id, input) => {
      answers.push(input);
      return Promise.resolve({ content: [{ type: 'text', text: 'Delivered.' }], details: undefined, terminate: true });
    }
  };
  return [...tools, answer];
}

/**
 * The turn events one Pi event stands for. An assistant message that calls the agent's tools reports its text and its
 * calls as progress, as the Claude runner does; the call to `answer` reports nothing, since it is the end.
 */
export function translatePiEvent(event: AgentEvent): TurnEvent[] {
  if (event.type !== 'message_end' || event.message.role !== 'assistant') {
    return [];
  }
  const blocks = event.message.content;
  if (!blocks.some((block) => block.type === 'toolCall' && block.name !== answerTool)) {
    return [];
  }
  return blocks.flatMap((block): TurnEvent[] => {
    if (block.type === 'text' && block.text.trim() !== '') {
      return [{ type: 'progress', text: block.text.trim() }];
    }
    return block.type === 'toolCall' && block.name !== answerTool ? [toolCallProgress(block.name, block.arguments)] : [];
  });
}

/** How the turn ended: the last answer given, or else why there is none. An aborted turn reports nothing. */
function turnEnd(answers: unknown[], messages: AgentMessage[], steps: { taken: number; max: number }): TurnEvent | undefined {
  if (answers.length > 0) {
    return readAnswer(answers.at(-1));
  }
  const last = messages.findLast((message) => message.role === 'assistant');
  if (last?.stopReason === 'aborted') {
    return undefined;
  }
  if (last?.stopReason === 'error') {
    return { type: 'result', ok: false, error: last.errorMessage ?? 'the model failed' };
  }
  return {
    type: 'result',
    ok: false,
    error: steps.taken >= steps.max ? `the turn took more than ${String(steps.max)} steps` : malformedAnswer
  };
}

const llmRoles = new Set(['user', 'assistant', 'toolResult']);

/**
 * Pi as a runner: one agent loop per turn, its tools in this process, over the session's transcript, which the runner
 * keeps since Pi keeps none. The loop stops after the agent's `maxSteps` model round trips.
 */
export function piRunner({ model, streamFn }: PiRunnerOptions): Runner {
  const resolved = typeof model === 'string' ? piModel(model) : model;
  const transcripts = new PiTranscriptStore();
  return {
    name: 'pi',
    async *runTurn(agent, request) {
      const sessionId = request.sessionId ?? randomUUID();
      yield { type: 'session', sessionId };
      const { signal } = request.abortController;
      const answers: unknown[] = [];
      const history = transcripts.get(sessionId);
      const context: AgentContext = {
        systemPrompt: agent.instructions(new Date()),
        messages: history,
        tools: piTools(agent, { contextId: request.contextId, signal }, answers)
      };
      const steps = { taken: 0, max: agent.maxSteps };
      const config = {
        model: resolved,
        convertToLlm: (messages: AgentMessage[]) => messages.filter((message): message is Message => llmRoles.has(message.role)),
        shouldStopAfterTurn: () => (steps.taken += 1) >= steps.max,
        toolExecution: 'sequential' as const
      };
      const prompt: AgentMessage = { role: 'user', content: request.prompt, timestamp: Date.now() };
      const stream = agentLoop([prompt], context, config, signal, streamFn);
      for await (const event of stream) {
        yield* translatePiEvent(event);
      }
      const messages = await stream.result();
      transcripts.set(sessionId, [...history, ...messages]);
      const end = turnEnd(answers, messages, steps);
      if (end !== undefined) {
        yield end;
      }
    }
  };
}
