import { createSdkMcpServer, query as sdkQuery, tool } from '@anthropic-ai/claude-agent-sdk';
import type { Options, OutputFormat, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { answerJsonSchema, readAnswer, toolCallProgress } from '../helpers/answer.helper.ts';
import { runTool } from '../helpers/tool.helper.ts';
import type { Runner, ToolContext, TurnAgent } from '../models/runner.model.ts';
import type { TurnEvent, TurnRequest } from '../models/turn.model.ts';

/** The shape of the SDK's `query()` the turn uses, so tests can hand it recorded messages. */
export type ClaudeQuery = (params: { prompt: string; options: Options }) => AsyncIterable<SDKMessage>;

/**
 * What the Claude runner runs with: the model, or Claude Code's default, and the SDK's `query()` unless a test hands
 * in its own. Claude's credentials are not among them: the SDK signs in the way Claude Code does.
 */
export interface ClaudeRunnerOptions {
  model?: string;
  query?: ClaudeQuery;
}

// The in-process MCP server the agent's tools are offered on; Claude sees them as `mcp__agent__<tool>`.
const serverName = 'agent';
const toolPrefix = `mcp__${serverName}__`;

const answerFormat: OutputFormat = { type: 'json_schema', schema: answerJsonSchema() };

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
      return [toolCallProgress(block.name.replace(toolPrefix, ''), block.input)];
    });
  }
  if (message.type === 'result') {
    return message.subtype === 'success'
      ? [readAnswer(message.structured_output)]
      : [{ type: 'result', ok: false, error: message.errors.join('\n') || message.subtype }];
  }
  return [];
}

/** The agent's tools on an in-process MCP server, each told the turn's context when it runs. */
function toolServer(agent: TurnAgent, context: ToolContext) {
  const tools = agent.tools.map((agentTool) =>
    tool(agentTool.name, agentTool.description, agentTool.input.shape, async (input) => {
      const result = await runTool(agentTool, input, context);
      return { content: [{ type: 'text' as const, text: result.text }], ...(result.isError ? { isError: true } : {}) };
    })
  );
  return createSdkMcpServer({ name: serverName, version: '0.1.0', tools });
}

/**
 * The SDK options for one turn: the agent's own tools only, no built-in ones, none of the machine's settings, and an
 * answer in the structured format.
 */
export function claudeOptions(agent: TurnAgent, request: TurnRequest, model?: string): Options {
  const context = { contextId: request.contextId, signal: request.abortController.signal };
  return {
    ...(model === undefined ? {} : { model }),
    systemPrompt: agent.instructions(new Date()),
    resume: request.sessionId,
    abortController: request.abortController,
    mcpServers: agent.tools.length === 0 ? {} : { [serverName]: toolServer(agent, context) },
    // No built-in tools (files, shell, web): the agent works only through its own.
    tools: [],
    allowedTools: agent.tools.map(({ name }) => `${toolPrefix}${name}`),
    // An agent served to others must not pick up the CLAUDE.md files or settings of whatever machine runs it.
    settingSources: [],
    maxTurns: agent.maxSteps,
    outputFormat: answerFormat
  };
}

/** The Claude Agent SDK as a runner: one `query()` per turn, its tools in this process. */
export function claudeRunner({ model, query = sdkQuery }: ClaudeRunnerOptions = {}): Runner {
  return {
    name: 'claude',
    async *runTurn(agent, request) {
      const options = claudeOptions(agent, request, model);
      const messages = query({ prompt: request.prompt, options });
      for await (const message of messages) {
        yield* translateClaudeMessage(message);
      }
    }
  };
}
