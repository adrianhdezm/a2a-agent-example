import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Codex } from '@openai/codex-sdk';
import type { CodexOptions, ThreadEvent, ThreadOptions, TurnOptions } from '@openai/codex-sdk';
import { answerJsonSchema, readAnswerText, toolCallProgress } from '../helpers/answer.helper.ts';
import type { Runner, TurnAgent } from '../models/runner.model.ts';
import type { TurnEvent } from '../models/turn.model.ts';

/** The part of a Codex SDK `Thread` a turn uses: one streamed run. */
export interface CodexThread {
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
 * What the Codex runner runs with: the model, or the Codex CLI's default, and the SDK's `Codex` unless a test hands in
 * its own. Codex's credentials are not among them: the Codex CLI signs in from the server's environment.
 */
export interface CodexRunnerOptions {
  model?: string;
  codex?: CodexFactory;
}

// The MCP server the agent's tools are reached on, as Codex's configuration names it.
const serverName = 'agent';

// The OpenAI API reads the schema in strict mode, which has no use for the draft keyword.
const { $schema: _draft, ...outputSchema } = answerJsonSchema();

/**
 * What one Codex SDK event stands for. The thread id is the session; a call to one of the agent's tools, a shell
 * command and an error Codex recovers from are progress. The answer is the last agent message, which carries the
 * structured format as JSON, read once the run completes; a failed run ends the turn with its error.
 */
export function translateCodexEvent(event: ThreadEvent, lastMessage: string | undefined): TurnEvent | undefined {
  switch (event.type) {
    case 'thread.started':
      return { type: 'session', sessionId: event.thread_id };
    case 'item.started':
      if (event.item.type === 'mcp_tool_call') {
        return toolCallProgress(event.item.tool, event.item.arguments);
      }
      return event.item.type === 'command_execution' ? { type: 'progress', text: `Running ${event.item.command}` } : undefined;
    case 'turn.completed':
      return readAnswerText(lastMessage);
    case 'turn.failed':
      return { type: 'result', ok: false, error: event.error.message };
    case 'error':
      // Not the end: Codex reports its reconnect attempts this way and carries on. A run ends only in `turn.failed`.
      return { type: 'progress', text: `Codex: ${event.message}` };
    default:
      return undefined;
  }
}

// Codex works in a folder of its own, created once and left empty: no project files, no AGENTS.md, nothing to change.
let emptyFolder: string | undefined;
function workingDirectory(): string {
  emptyFolder ??= mkdtempSync(join(tmpdir(), 'codex-agent-'));
  return emptyFolder;
}

/**
 * The thread options of every turn. Codex has no switch that removes its built-in shell, so it is held to a read-only
 * sandbox in an empty folder, with no network, no web search and nothing it may ask approval for: it works through
 * the agent's tools, which it reaches over MCP outside the sandbox.
 */
export function codexThreadOptions(model?: string): ThreadOptions {
  return {
    ...(model === undefined ? {} : { model }),
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
    workingDirectory: workingDirectory(),
    skipGitRepoCheck: true
  };
}

/**
 * The Codex client options of one turn: the instructions, dated, as developer instructions, no project docs, and the
 * agent's tools as the one MCP server, at the agent's tools URL for this conversation, limited to those tools.
 */
export function codexOptions(agent: TurnAgent, contextId: string): CodexOptions {
  const config: NonNullable<CodexOptions['config']> = { developer_instructions: agent.instructions(new Date()), project_doc_max_bytes: 0 };
  if (agent.tools.length > 0) {
    config.mcp_servers = { [serverName]: { url: agent.toolsUrl(contextId), enabled_tools: agent.tools.map(({ name }) => name) } };
  }
  return { config };
}

/**
 * The Codex SDK as a runner: one thread run per turn, on a new thread or the session's, its tools reached over MCP.
 * Codex has no step limit of its own, so the runner counts tool calls against the agent's `maxSteps` and stops the run
 * past it.
 */
export function codexRunner({ model, codex = (options) => new Codex(options) }: CodexRunnerOptions = {}): Runner {
  return {
    name: 'codex',
    async *runTurn(agent, request) {
      const client = codex(codexOptions(agent, request.contextId));
      const threadOptions = codexThreadOptions(model);
      const thread =
        request.sessionId === undefined ? client.startThread(threadOptions) : client.resumeThread(request.sessionId, threadOptions);
      // Ending the turn early, past the step limit, stops the Codex CLI too; the turn's own abort still does.
      const ended = new AbortController();
      const signal = AbortSignal.any([request.abortController.signal, ended.signal]);
      const { events } = await thread.runStreamed(request.prompt, { outputSchema, signal });
      // The answer is the last agent message, read when the run completes.
      let lastMessage: string | undefined;
      let toolCalls = 0;
      try {
        for await (const event of events) {
          if (event.type === 'item.completed' && event.item.type === 'agent_message') {
            lastMessage = event.item.text;
          }
          toolCalls += event.type === 'item.started' && event.item.type === 'mcp_tool_call' ? 1 : 0;
          if (toolCalls > agent.maxSteps) {
            yield { type: 'result', ok: false, error: `the turn took more than ${String(agent.maxSteps)} steps` };
            return;
          }
          const turnEvent = translateCodexEvent(event, lastMessage);
          if (turnEvent !== undefined) {
            yield turnEvent;
          }
        }
      } finally {
        ended.abort();
      }
    }
  };
}
