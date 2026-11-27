import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { TurnAgentExecutor } from './executors/turn-agent.executor.ts';
import { toolsMcpHandler } from './handlers/tools-mcp.handler.ts';
import type { A2aAgent, AgentDefinition } from './models/a2a-agent.model.ts';
import type { Runner, RunnerConfig } from './models/runner.model.ts';
import { claudeRunner } from './runners/claude.runner.ts';
import { codexRunner } from './runners/codex.runner.ts';
import { SessionStore } from './stores/session.store.ts';

// core's entry point: what an agent needs from core, and nothing else. Everything below it is core's own.
export type { A2aAgent, AgentCardBase } from './models/a2a-agent.model.ts';
export type { AgentSpec, AgentTool, Runner, RunnerConfig, ToolContext } from './models/runner.model.ts';
export { ToolError } from './models/runner.model.ts';
export { defineTool } from './helpers/tool.helper.ts';
export { claudeRunner } from './runners/claude.runner.ts';
export { codexRunner } from './runners/codex.runner.ts';
export { askAgentTool } from './tools/ask-agent.tool.ts';
export type { ConnectAgent } from './tools/ask-agent.tool.ts';

/** The runners configuration can name, each from its config: the strategies an agent can be run with. */
const runnersByName: Record<string, (config: RunnerConfig) => Runner> = {
  claude: ({ model }) => claudeRunner({ model }),
  codex: ({ model }) => codexRunner({ model })
};

/** The runner configuration names, or the runner itself when a test hands one in. */
export function resolveRunner(choice: Runner | RunnerConfig): Runner {
  if ('runTurn' in choice) {
    return choice;
  }
  const create = runnersByName[choice.name];
  if (create === undefined) {
    throw new Error(`Unknown runner "${choice.name}": use ${Object.keys(runnersByName).join(', ')}`);
  }
  return create(choice);
}

/**
 * An agent ready to serve under `baseUrl`, built from its definition, at `/agents/<id>/`: its card with the JSON-RPC
 * endpoint there, its tools over MCP for runners that need them, and a `TurnAgentExecutor` that runs its spec on its
 * runner, with sessions of its own, behind an A2A request handler with a task store of its own, so no two agents share
 * a conversation or a task.
 */
export function createA2aAgent({ id, card, spec, runner, answerArtifact }: AgentDefinition, baseUrl: string): A2aAgent {
  const root = `/agents/${id}`;
  const paths = { card: `${root}/.well-known/agent-card.json`, jsonRpc: `${root}/a2a/jsonrpc`, mcp: `${root}/mcp` };
  const origin = baseUrl.replace(/\/+$/, '');
  // The card says where the agent is served, so it is filled in here, where the paths are chosen.
  const servedCard: AgentCard = {
    ...card,
    supportedInterfaces: [
      { url: `${origin}${paths.jsonRpc}`, protocolBinding: 'JSONRPC', tenant: '', protocolVersion: A2A_PROTOCOL_VERSION }
    ]
  };
  const agent = { ...spec, toolsUrl: (contextId: string) => `${origin}${paths.mcp}/${encodeURIComponent(contextId)}` };
  const executor = new TurnAgentExecutor({ runner, agent, sessions: new SessionStore(), answerArtifact });
  return {
    card: servedCard,
    requestHandler: new DefaultRequestHandler(servedCard, new InMemoryTaskStore(), executor),
    toolsHandler: toolsMcpHandler(spec.tools),
    paths,
    // With the trailing slash, an A2A client resolves the default card path beneath it rather than beside it.
    url: `${origin}${root}/`
  };
}
