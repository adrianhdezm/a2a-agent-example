import type { AgentCard } from '@a2a-js/sdk';
import type { DefaultRequestHandler } from '@a2a-js/sdk/server';
import type { AnswerArtifact } from '../helpers/a2a-message.helper.ts';
import type { RunTurn } from './turn.model.ts';

/**
 * An agent's card as the agent writes it: what the agent is (its name, skills and capabilities), without where it is
 * served, which the factory adds when it serves it.
 */
export type AgentProfile = Omit<AgentCard, 'supportedInterfaces'>;

/** What one agent supplies to be served over A2A: its profile, how it runs a turn, and what it calls its answer. */
export interface AgentDefinition {
  card: AgentProfile;
  runTurn: RunTurn;
  answerArtifact: AnswerArtifact;
}

/** An agent ready to serve: its card, the A2A SDK's request handler for it, and the paths to mount the two endpoints at. */
export interface A2aAgent {
  card: AgentCard;
  requestHandler: DefaultRequestHandler;
  paths: { card: string; jsonRpc: string };
}
