import type { McpServerConfig, Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { TurnEvent, TurnRequest } from '../models/turn.model.ts';

/** The shape of the SDK's `query()` the turn uses, so tests can hand it recorded messages. */
export type ClaudeQuery = (params: { prompt: string; options: Options }) => AsyncIterable<SDKMessage>;

export interface ClaudeTurnSettings {
  apiKey: string;
  /** The system prompt, built per turn so it can carry today's date. */
  systemPrompt: () => string;
  /** The in-process MCP server with the agent's tools, and the tool names Claude may call without asking. */
  mcpServers: Record<string, McpServerConfig>;
  allowedTools: string[];
  /** The most model round trips one turn may take. */
  maxTurns: number;
  query: ClaudeQuery;
}

/**
 * The turn events one SDK message stands for. An assistant message that calls tools reports its text and its calls
 * as progress; one that does not is the answer, which the `result` message carries, so it reports nothing.
 */
export function translateClaudeMessage(message: SDKMessage): TurnEvent[] {
  if (message.type === 'system' && message.subtype === 'init') {
    return [{ type: 'session', sessionId: message.session_id }];
  }
  if (message.type === 'assistant') {
    const blocks = message.message.content;
    if (!blocks.some((block) => block.type === 'tool_use')) {
      return [];
    }
    return blocks.flatMap((block): TurnEvent[] => {
      if (block.type === 'text' && block.text.trim() !== '') {
        return [{ type: 'progress', text: block.text.trim() }];
      }
      if (block.type !== 'tool_use') {
        return [];
      }
      const tool = block.name.replace(/^mcp__[^_]+__/, '');
      return [{ type: 'progress', text: `Calling ${tool} ${JSON.stringify(block.input)}` }];
    });
  }
  if (message.type === 'result') {
    return message.subtype === 'success'
      ? [{ type: 'result', ok: true, text: message.result }]
      : [{ type: 'result', ok: false, error: message.errors.join('\n') || message.subtype }];
  }
  return [];
}

/** The SDK options for one turn: the agent's own tools only, no built-in ones, and none of the machine's settings. */
export function claudeOptions(settings: ClaudeTurnSettings, request: TurnRequest): Options {
  return {
    systemPrompt: settings.systemPrompt(),
    resume: request.sessionId,
    abortController: request.abortController,
    mcpServers: settings.mcpServers,
    // No built-in tools (files, shell, web): the agent works only through its own.
    tools: [],
    allowedTools: settings.allowedTools,
    // An agent served to others must not pick up the CLAUDE.md files or settings of whatever machine runs it.
    settingSources: [],
    maxTurns: settings.maxTurns,
    // The SDK replaces the child process's environment with this one, so it keeps the rest of ours (PATH, HOME).
    env: { ...process.env, ANTHROPIC_API_KEY: settings.apiKey }
  };
}

/** Runs one Claude turn and yields what it reports; aborting the request's controller stops it. */
export async function* runClaudeTurn(settings: ClaudeTurnSettings, request: TurnRequest): AsyncIterable<TurnEvent> {
  const options = claudeOptions(settings, request);
  const messages = settings.query({ prompt: request.prompt, options });
  for await (const message of messages) {
    yield* translateClaudeMessage(message);
  }
}
