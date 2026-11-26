import type { AgentCard } from '@a2a-js/sdk';
import type { DefaultRequestHandler } from '@a2a-js/sdk/server';
import type { AnswerArtifact } from '../helpers/a2a-message.helper.ts';
import type { RunTurn } from './turn.model.ts';

/**
 * The part of an agent's card the agent writes: what the agent is (its name, skills and capabilities). The factory builds
 * the full card on it, adding where the agent is served.
 */
export type AgentCardBase = Omit<AgentCard, 'supportedInterfaces'>;

/**
 * What one agent supplies to be served over A2A: the id it is served under (`/agents/<id>/`), its card base, how it runs
 * a turn, and what it calls its answer.
 */
export interface AgentDefinition {
  id: string;
  card: AgentCardBase;
  runTurn: RunTurn;
  answerArtifact: AnswerArtifact;
}

/**
 * An agent ready to serve: its card, the A2A SDK's request handler for it, the paths to mount the two endpoints at, and
 * the URL an A2A client is given to reach it, under which its card is found at `.well-known/agent-card.json`.
 */
export interface A2aAgent {
  card: AgentCard;
  requestHandler: DefaultRequestHandler;
  paths: { card: string; jsonRpc: string };
  url: string;
}
