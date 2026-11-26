import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';
import type { McpServerConfig, Options, OutputFormat, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { TurnEvent, TurnOutcome, TurnRequest } from '../models/turn.model.ts';

/** The shape of the SDK's `query()` the turn uses, so tests can hand it recorded messages. */
export type ClaudeQuery = (params: { prompt: string; options: Options }) => AsyncIterable<SDKMessage>;

/**
 * What a Claude turn runs with: the agent's prompt and tools, and the SDK's `query()` unless a test hands in its own.
 * Claude's credentials are not among them: the SDK signs in the way Claude Code does, from the server's environment.
 */
export interface ClaudeTurnSettings {
  /** The system prompt, built per turn so it can carry today's date. */
  systemPrompt: () => string;
  /** The in-process MCP servers with the agent's tools, and the tool names Claude may call without asking. */
  mcpServers: Record<string, McpServerConfig>;
  allowedTools: string[];
  /** The most model round trips one turn may take. */
  maxTurns: number;
  query?: ClaudeQuery;
}

// How every turn must end, enforced by the SDK: whether the question is answered, and the text the user reads.
const answerSchema = z.object({
  outcome: z
    .enum(['completed', 'input-required'])
    .describe('completed when you have answered the question; input-required when you need the user to tell you more first'),
  text: z.string().describe('Your answer, or your question to the user, written for the user to read')
}) satisfies z.ZodType<{ outcome: TurnOutcome; text: string }>;

// The Claude Code CLI validates the schema as JSON Schema draft 7 and rejects zod's default, draft 2020-12.
const answerFormat: OutputFormat = { type: 'json_schema', schema: z.toJSONSchema(answerSchema, { target: 'draft-7' }) };

// The SDK's own tool through which Claude delivers the answer in that format.
const structuredOutputTool = 'StructuredOutput';

/**
 * The turn events one SDK message stands for. An assistant message that calls the agent's tools reports its text
 * and its calls as progress. The answer arrives as a call to `StructuredOutput`, which the `result` message carries,
 * so a message that calls no other tool reports nothing.
 */
export function translateClaudeMessage(message: SDKMessage): TurnEvent[] {
  if (message.type === 'system' && message.subtype === 'init') {
    return [{ type: 'session', sessionId: message.session_id }];
  }
  if (message.type === 'assistant') {
    const blocks = message.message.content;
    const callsTools = blocks.some((block) => block.type === 'tool_use' && block.name !== structuredOutputTool);
    if (!callsTools) {
      return [];
    }
    return blocks.flatMap((block): TurnEvent[] => {
      if (block.type === 'text' && block.text.trim() !== '') {
        return [{ type: 'progress', text: block.text.trim() }];
      }
      if (block.type !== 'tool_use' || block.name === structuredOutputTool) {
        return [];
      }
      const tool = block.name.replace(/^mcp__[^_]+__/, '');
      return [{ type: 'progress', text: `Calling ${tool} ${JSON.stringify(block.input)}` }];
    });
  }
  if (message.type === 'result') {
    if (message.subtype !== 'success') {
      return [{ type: 'result', ok: false, error: message.errors.join('\n') || message.subtype }];
    }
    const answer = answerSchema.safeParse(message.structured_output);
    return answer.success
      ? [{ type: 'result', ok: true, ...answer.data }]
      : [{ type: 'result', ok: false, error: 'the answer did not match its output format' }];
  }
  return [];
}

/**
 * The SDK options for one turn: the agent's own tools only, no built-in ones, none of the machine's settings, and an
 * answer in the structured format above.
 */
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
    outputFormat: answerFormat
    // No env: Claude Code inherits the server's environment, and signs in from it as it would on its own.
  };
}

/** Runs one Claude turn and yields what it reports; aborting the request's controller stops it. */
export async function* runClaudeTurn(settings: ClaudeTurnSettings, request: TurnRequest): AsyncIterable<TurnEvent> {
  const options = claudeOptions(settings, request);
  const query = settings.query ?? sdkQuery;
  const messages = query({ prompt: request.prompt, options });
  for await (const message of messages) {
    yield* translateClaudeMessage(message);
  }
}
