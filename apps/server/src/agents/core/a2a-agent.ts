import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { TurnAgentExecutor } from './executors/turn-agent.executor.ts';
import type { A2aAgent, AgentDefinition } from './models/a2a-agent.model.ts';
import { SessionStore } from './stores/session.store.ts';

// core's entry point: what an agent needs from core, and nothing else. Everything below it is core's own.
export type { A2aAgent, AgentCardBase } from './models/a2a-agent.model.ts';
export type { TurnEvent, TurnOutcome } from './models/turn.model.ts';
export { partsText, textPart } from './helpers/a2a-message.helper.ts';
export { runClaudeTurn } from './runners/claude.runner.ts';
export type { ClaudeQuery, ClaudeTurnSettings } from './runners/claude.runner.ts';
export { runCodexTurn } from './runners/codex.runner.ts';
export type { CodexConsultant, CodexFactory, CodexTurnSettings } from './runners/codex.runner.ts';

/**
 * An agent ready to serve under `baseUrl`, built from its definition: its card with the JSON-RPC endpoint it is served
 * at, under `/agents/<id>/`, a `TurnAgentExecutor` with sessions of its own, and an A2A request handler with a task
 * store of its own, so no two agents share a conversation or a task.
 */
export function createA2aAgent({ id, card, runTurn, answerArtifact }: AgentDefinition, baseUrl: string): A2aAgent {
  const root = `/agents/${id}`;
  const paths = { card: `${root}/.well-known/agent-card.json`, jsonRpc: `${root}/a2a/jsonrpc` };
  const origin = baseUrl.replace(/\/+$/, '');
  // The card says where the agent is served, so it is filled in here, where the paths are chosen.
  const servedCard: AgentCard = {
    ...card,
    supportedInterfaces: [
      { url: `${origin}${paths.jsonRpc}`, protocolBinding: 'JSONRPC', tenant: '', protocolVersion: A2A_PROTOCOL_VERSION }
    ]
  };
  const executor = new TurnAgentExecutor({ runTurn, sessions: new SessionStore(), answerArtifact });
  return {
    card: servedCard,
    requestHandler: new DefaultRequestHandler(servedCard, new InMemoryTaskStore(), executor),
    paths,
    // With the trailing slash, an A2A client resolves the default card path beneath it rather than beside it.
    url: `${origin}${root}/`
  };
}
