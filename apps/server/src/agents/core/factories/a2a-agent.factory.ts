import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { TurnAgentExecutor } from '../executors/turn-agent.executor.ts';
import type { A2aAgent, AgentDefinition } from '../models/a2a-agent.model.ts';
import { SessionStore } from '../stores/session.store.ts';

/**
 * An agent ready to serve under `baseUrl`, built from its definition: its card with the JSON-RPC endpoint it is served
 * at, a `TurnAgentExecutor` with sessions of its own, and an A2A request handler with a task store of its own, so no
 * two agents share a conversation or a task.
 */
export function createA2aAgent({ card, runTurn, answerArtifact }: AgentDefinition, baseUrl: string): A2aAgent {
  const paths = { card: '/.well-known/agent-card.json', jsonRpc: '/a2a/jsonrpc' };
  // The card says where the agent is served, so it is filled in here, where the paths are chosen.
  const servedCard: AgentCard = {
    ...card,
    supportedInterfaces: [
      {
        url: `${baseUrl.replace(/\/+$/, '')}${paths.jsonRpc}`,
        protocolBinding: 'JSONRPC',
        tenant: '',
        protocolVersion: A2A_PROTOCOL_VERSION
      }
    ]
  };
  const executor = new TurnAgentExecutor({ runTurn, sessions: new SessionStore(), answerArtifact });
  return { card: servedCard, requestHandler: new DefaultRequestHandler(servedCard, new InMemoryTaskStore(), executor), paths };
}
