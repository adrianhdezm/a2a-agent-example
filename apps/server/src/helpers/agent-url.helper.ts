import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import type { AgentDefinition, AgentSummary } from '../models/agent.model.ts';

/** Where an agent's endpoints live on the server, relative to its base URL. */
export interface AgentPaths {
  /** `/agents/<id>`, the agent itself, and the prefix of every endpoint it has. */
  base: string;
  /** `/agents/<id>/.well-known/agent-card.json`. */
  card: string;
  /** `/agents/<id>/a2a/jsonrpc`. */
  jsonRpc: string;
}

export function agentPaths(agentId: string): AgentPaths {
  const base = `/agents/${agentId}`;
  return { base, card: `${base}/${AGENT_CARD_PATH}`, jsonRpc: `${base}/a2a/jsonrpc` };
}

/** Joins a server's base URL and an absolute path, whether or not the base URL ends in a slash. */
export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export function summarizeAgent(definition: AgentDefinition, baseUrl: string): AgentSummary {
  const { id, name, description, harness } = definition;
  return { id, name, description, harness, cardUrl: joinUrl(baseUrl, agentPaths(id).card) };
}
