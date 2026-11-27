import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CodexOptions, ThreadEvent, ThreadOptions, TurnOptions } from '@openai/codex-sdk';
import type { CodexClient, CodexFactory, CodexThread } from '../../src/agents/core/runners/codex.runner.ts';

/** One run Codex was asked for: its input, the thread it resumed, and what it was started with. */
export interface CodexRun {
  input: string;
  resumed: string | undefined;
  turnOptions: TurnOptions | undefined;
  options: CodexOptions;
  threadOptions: ThreadOptions | undefined;
}

export interface FakeCodex {
  factory: CodexFactory;
  /** Every run, in order. */
  runs: CodexRun[];
}

/**
 * A Codex SDK stand-in whose n-th run streams `script(run)[n]`, the last entry repeating. Like the SDK's, a run on an
 * aborted signal fails.
 */
export function fakeCodex(script: ThreadEvent[][] | ((run: CodexRun) => ThreadEvent[])): FakeCodex {
  const runs: CodexRun[] = [];
  const factory: CodexFactory = (options) => {
    const thread = (resumed: string | undefined, threadOptions: ThreadOptions | undefined): CodexThread => ({
      runStreamed: (input, turnOptions) => {
        turnOptions?.signal?.throwIfAborted();
        const run = { input, resumed, turnOptions, options, threadOptions };
        runs.push(run);
        const events = typeof script === 'function' ? script(run) : (script[Math.min(runs.length, script.length) - 1] ?? []);
        // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
        async function* stream(): AsyncIterable<ThreadEvent> {
          yield* events;
        }
        return Promise.resolve({ events: stream() });
      }
    });
    const client: CodexClient = {
      startThread: (threadOptions) => thread(undefined, threadOptions),
      resumeThread: (id, threadOptions) => thread(id, threadOptions)
    };
    return client;
  };
  return { factory, runs };
}

/** One step of a scripted Codex run: call one of the agent's tools over its MCP endpoint, or answer. */
export type CodexStep = { call: string; arguments: Record<string, unknown> } | { answer: { outcome: string; text: string } };

/** One run of the MCP-calling fake: its input, the thread it resumed, the tools URL it was given, and what the tools said. */
export interface McpCodexRun {
  input: string;
  resumed: string | undefined;
  toolsUrl: string | undefined;
  toolResults: string[];
}

/** The tools URL a Codex client was configured with, as the Codex runner writes it. */
function toolsUrlOf(options: CodexOptions): string | undefined {
  const servers = options.config?.mcp_servers as { agent?: { url?: string } } | undefined;
  return servers?.agent?.url;
}

/** Calls one tool at `url` over MCP, as the Codex CLI does, and gives back its text. */
async function callOverMcp(url: string, name: string, args: Record<string, unknown>): Promise<string> {
  const client = new Client({ name: 'fake-codex', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  try {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text?: string }[];
    return content.map(({ text }) => text ?? '').join('');
  } finally {
    await client.close();
  }
}

/**
 * A Codex stand-in that behaves as the Codex CLI does towards our server: its n-th run plays `script[n]`, and each tool
 * call in it goes over MCP to the tools URL the runner configured, so the agent's tools really run. Threads keep their
 * ids across runs, as the CLI keeps them.
 */
export function mcpCallingCodex(script: CodexStep[][]): { factory: CodexFactory; runs: McpCodexRun[] } {
  const runs: McpCodexRun[] = [];
  let threads = 0;
  const factory: CodexFactory = (options) => {
    const thread = (resumed: string | undefined): CodexThread => ({
      runStreamed: (input, turnOptions) => {
        turnOptions?.signal?.throwIfAborted();
        const run: McpCodexRun = { input, resumed, toolsUrl: toolsUrlOf(options), toolResults: [] };
        runs.push(run);
        const steps = script[runs.length - 1] ?? [];
        const id = resumed ?? `thread-${String((threads += 1))}`;
        async function* stream(): AsyncIterable<ThreadEvent> {
          yield { type: 'thread.started', thread_id: id };
          for (const [index, step] of steps.entries()) {
            if ('answer' in step) {
              yield {
                type: 'item.completed',
                item: { id: `item_${String(index)}`, type: 'agent_message', text: JSON.stringify(step.answer) }
              };
              continue;
            }
            const item = {
              id: `item_${String(index)}`,
              type: 'mcp_tool_call' as const,
              server: 'agent',
              tool: step.call,
              arguments: step.arguments
            };
            yield { type: 'item.started', item: { ...item, status: 'in_progress' } };
            run.toolResults.push(await callOverMcp(run.toolsUrl ?? '', step.call, step.arguments));
            yield { type: 'item.completed', item: { ...item, status: 'completed' } };
          }
          yield {
            type: 'turn.completed',
            usage: { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 }
          };
        }
        return Promise.resolve({ events: stream() });
      }
    });
    return { startThread: () => thread(undefined), resumeThread: (id) => thread(id) };
  };
  return { factory, runs };
}
