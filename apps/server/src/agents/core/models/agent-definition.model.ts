import type { AgentCard } from '@a2a-js/sdk';
import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import type { AnswerArtifact } from '../helpers/a2a-message.helper.ts';

/**
 * Everything that makes one agent itself, which the core needs to serve and run it: its card, its prompt, its tools,
 * and what it calls its answer. The tools are in the Claude Agent SDK's form, the only runner so far.
 */
export interface AgentDefinition {
  /** The agent's A2A card, served under `baseUrl`. */
  card: (baseUrl: string) => AgentCard;
  /** The system prompt, built per turn so it can carry today's date. */
  systemPrompt: () => string;
  /** The in-process MCP servers with the agent's tools, and the tool names it may call without asking. */
  mcpServers: Record<string, McpServerConfig>;
  allowedTools: string[];
  /** The most model round trips one turn may take. */
  maxTurns: number;
  answerArtifact: AnswerArtifact;
}
