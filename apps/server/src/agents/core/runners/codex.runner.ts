import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Codex } from '@openai/codex-sdk';
import type { CodexOptions, ThreadEvent, ThreadItem, ThreadOptions, TurnOptions } from '@openai/codex-sdk';
import { z } from 'zod';
import type { TurnEvent, TurnRequest } from '../models/turn.model.ts';

/** The part of a Codex SDK `Thread` a turn uses: its id, and one streamed run. */
export interface CodexThread {
  readonly id: string | null;
  runStreamed: (input: string, options?: TurnOptions) => Promise<{ events: AsyncIterable<ThreadEvent> }>;
}

/** The part of the SDK's `Codex` a turn uses, so tests can hand in threads that stream recorded events. */
export interface CodexClient {
  startThread: (options?: ThreadOptions) => CodexThread;
  resumeThread: (id: string, options?: ThreadOptions) => CodexThread;
}

/** Makes the Codex client for one turn: the SDK's `new Codex(options)` unless a test hands in its own. */
export type CodexFactory = (options: CodexOptions) => CodexClient;

/**
 * Someone a Codex turn may ask on the way to its answer, such as another A2A agent. Codex has no tools, so it asks by
 * ending a run with the `consult` outcome; the runner asks, and hands the reply back to Codex in the same thread.
 */
export interface CodexConsultant {
  /** Who Codex asks, as its instructions and the answer format name it: "Weather Agent". */
  name: string;
  /**
   * Asks one question in the conversation of the Codex thread `threadId`, so follow-up questions in that thread
   * continue it. Streams its progress and ends with a `result`: the reply, or the consultant's own question.
   */
  ask: (question: string, conversation: { threadId: string; signal: AbortSignal }) => AsyncIterable<TurnEvent>;
}

/**
 * What a Codex turn runs with: the agent's instructions, who it may consult, and the SDK's `Codex` unless a test hands
 * in its own. Codex's credentials are not among them: the Codex CLI signs in from the server's environment.
 */
export interface CodexTurnSettings {
  /** The developer instructions, built per turn so they can carry today's date. */
  instructions: () => string;
  consultant?: CodexConsultant;
  /** The most questions one turn may put to the consultant. */
  maxConsultations: number;
  codex?: CodexFactory;
}

// How every run must end, read back with zod. `consult` is offered to Codex only when it has a consultant.
const answerSchema = z.object({ outcome: z.enum(['completed', 'input-required', 'consult']), text: z.string() });

type CodexAnswer = z.infer<typeof answerSchema>;

/**
 * The answer format of one run, which the Codex CLI enforces, in the JSON Schema the OpenAI API reads in strict mode:
 * every property required, no others allowed, and no `$schema` keyword.
 */
export function codexAnswerSchema(consultant?: string): Record<string, unknown> {
  const outcomes: [string, ...string[]] = ['completed', 'input-required'];
  let outcome = 'completed when you have answered; input-required when you need the user to tell you more first';
  let text = 'Your answer, or your question to the user, written for the user to read';
  if (consultant !== undefined) {
    outcomes.push('consult');
    outcome += `; consult when you need to ask the ${consultant} something first`;
    text += `; for consult, your question to the ${consultant}`;
  }
  const schema = z.strictObject({ outcome: z.enum(outcomes).describe(outcome), text: z.string().describe(text) });
  const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-7' });
  return jsonSchema;
}

/** One step of a Codex run: a turn event to pass on, or the run's final answer, which the runner acts on. */
export type CodexStep = TurnEvent | { type: 'answer'; answer: CodexAnswer };

/**
 * What one Codex SDK event stands for. The thread id is the session; reasoning, commands, and errors Codex recovers
 * from are progress. The answer is the last agent message, which carries the structured format as JSON, read once the
 * run completes; a failed run ends the turn with its error.
 */
export function translateCodexEvent(event: ThreadEvent, lastMessage: string | undefined): CodexStep | undefined {
  switch (event.type) {
    case 'thread.started':
      return { type: 'session', sessionId: event.thread_id };
    case 'item.completed':
      return translateItem(event.item);
    case 'turn.completed':
      return readAnswer(lastMessage);
    case 'turn.failed':
      return { type: 'result', ok: false, error: event.error.message };
    case 'error':
      // Not the end: Codex reports its reconnect attempts this way and carries on. A run ends only in `turn.failed`.
      return { type: 'progress', text: `Codex: ${event.message}` };
    default:
      return undefined;
  }
}

function translateItem(item: ThreadItem): TurnEvent | undefined {
  if (item.type === 'reasoning' && item.text.trim() !== '') {
    return { type: 'progress', text: item.text.trim() };
  }
  if (item.type === 'command_execution') {
    return { type: 'progress', text: `Running ${item.command}` };
  }
  return item.type === 'error' ? { type: 'progress', text: `Codex: ${item.message}` } : undefined;
}

function readAnswer(text: string | undefined): CodexStep {
  let json: unknown;
  try {
    json = JSON.parse(text ?? '');
  } catch {
    json = undefined;
  }
  const answer = answerSchema.safeParse(json);
  return answer.success
    ? { type: 'answer', answer: answer.data }
    : { type: 'result', ok: false, error: 'the answer did not match its output format' };
}

// Codex works in a folder of its own, created once and left empty: no project files, no AGENTS.md, nothing to change.
let emptyFolder: string | undefined;
function workingDirectory(): string {
  emptyFolder ??= mkdtempSync(join(tmpdir(), 'codex-agent-'));
  return emptyFolder;
}

/**
 * The thread options of every turn. Codex has no switch that removes its built-in shell, so it is held to a read-only
 * sandbox in an empty folder, with no network, no web search and nothing it may ask approval for: it answers from
 * what it knows and what its consultant tells it.
 */
export function codexThreadOptions(): ThreadOptions {
  return {
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
    workingDirectory: workingDirectory(),
    skipGitRepoCheck: true
  };
}

/** The Codex client options of one turn: the instructions, dated, as developer instructions, and no project docs. */
export function codexOptions(settings: CodexTurnSettings): CodexOptions {
  return { config: { developer_instructions: settings.instructions(), project_doc_max_bytes: 0 } };
}

/** What the runner tells Codex its consultant replied, as the next input in the thread. */
function consultantReply(name: string, reply: TurnEvent | undefined): string {
  if (reply?.type !== 'result') {
    return `The ${name} did not answer.`;
  }
  if (!reply.ok) {
    return `The ${name} could not answer: ${reply.error}`;
  }
  return reply.outcome === 'input-required' ? `The ${name} asks you:\n${reply.text}` : `The ${name} answered:\n${reply.text}`;
}

/** The thread of the session to resume, or a new one, on a Codex client made for this turn. */
function openThread(settings: CodexTurnSettings, sessionId: string | undefined): CodexThread {
  const codex = (settings.codex ?? ((options) => new Codex(options)))(codexOptions(settings));
  const threadOptions = codexThreadOptions();
  return sessionId === undefined ? codex.startThread(threadOptions) : codex.resumeThread(sessionId, threadOptions);
}

/** One run of the thread: yields its session, progress and any failure, and returns its answer if it has one. */
async function* runOnce(thread: CodexThread, input: string, options: TurnOptions): AsyncGenerator<TurnEvent, CodexAnswer | undefined> {
  const { events } = await thread.runStreamed(input, options);
  let lastMessage: string | undefined;
  for await (const event of events) {
    if (event.type === 'item.completed' && event.item.type === 'agent_message') {
      lastMessage = event.item.text;
    }
    const step = translateCodexEvent(event, lastMessage);
    if (step?.type === 'answer') {
      return step.answer;
    }
    if (step !== undefined) {
      yield step;
    }
    if (step?.type === 'result') {
      return undefined;
    }
  }
  return undefined;
}

/** Asks the consultant one question, yields its progress as Codex's, and returns its reply as the next input. */
async function* askConsultant(
  consultant: CodexConsultant,
  question: string,
  conversation: { threadId: string; signal: AbortSignal }
): AsyncGenerator<TurnEvent, string> {
  yield { type: 'progress', text: `Asking the ${consultant.name}: ${question}` };
  const replies = consultant.ask(question, conversation);
  let reply: TurnEvent | undefined;
  for await (const event of replies) {
    if (event.type === 'progress') {
      yield { type: 'progress', text: `${consultant.name}: ${event.text}` };
    } else if (event.type === 'result') {
      reply = event;
    }
  }
  conversation.signal.throwIfAborted();
  return consultantReply(consultant.name, reply);
}

/**
 * Runs one Codex turn and yields what it reports; aborting the request's controller stops it. A run that ends in
 * `consult` has the runner ask the consultant, stream its progress, and run the thread again with the reply, until
 * Codex answers the user or asks them something.
 */
export async function* runCodexTurn(settings: CodexTurnSettings, request: TurnRequest): AsyncIterable<TurnEvent> {
  const thread = openThread(settings, request.sessionId);
  const { consultant, maxConsultations } = settings;
  const { signal } = request.abortController;
  const outputSchema = codexAnswerSchema(consultant?.name);
  let input = request.prompt;
  for (let consultations = 0; ; consultations += 1) {
    const answer = yield* runOnce(thread, input, { outputSchema, signal });
    if (answer === undefined) {
      return;
    }
    if (answer.outcome !== 'consult') {
      yield { type: 'result', ok: true, outcome: answer.outcome, text: answer.text };
      return;
    }
    if (consultant === undefined || thread.id === null) {
      yield { type: 'result', ok: false, error: 'Codex asked to consult, with no one to consult' };
      return;
    }
    if (consultations >= maxConsultations) {
      yield { type: 'result', ok: false, error: `Codex asked the ${consultant.name} more than ${String(maxConsultations)} times` };
      return;
    }
    input = yield* askConsultant(consultant, answer.text, { threadId: thread.id, signal });
  }
}
