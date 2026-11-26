import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { TurnAgentExecutor } from '../executors/turn-agent.executor.ts';
import { agentPaths } from '../helpers/agent-card.helper.ts';
import type { A2aAgent, AgentDefinition } from '../models/a2a-agent.model.ts';
import { SessionStore } from '../stores/session.store.ts';

/**
 * An agent ready to serve, built from its definition: a `TurnAgentExecutor` with sessions of its own, and an A2A
 * request handler with a task store of its own, so no two agents share a conversation or a task.
 */
export function createA2aAgent({ card, runTurn, answerArtifact }: AgentDefinition): A2aAgent {
  const executor = new TurnAgentExecutor({ runTurn, sessions: new SessionStore(), answerArtifact });
  return { card, requestHandler: new DefaultRequestHandler(card, new InMemoryTaskStore(), executor), paths: agentPaths };
}
