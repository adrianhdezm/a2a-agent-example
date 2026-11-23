import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';

/** One thing an agent can do, as its card advertises it. */
export interface AgentCardSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

/** What an app knows about an agent; the rest of the card is what `HarnessExecutor` can do. */
export interface AgentCardInput {
  name: string;
  description: string;
  skills: AgentCardSkill[];
  /** Where the app serves the agent's JSON-RPC endpoint. */
  url: string;
  /** The agent's own version; `0.0.0` when the app does not version its agents. */
  version?: string;
}

const textModes = ['text/plain'];

/**
 * The A2A 1.0 Agent Card of an agent run by `HarnessExecutor`: one JSON-RPC interface at `url`, and the capabilities
 * the executor has (text in and out, no streaming, no push notifications), which change here when it changes.
 */
export function buildAgentCard({ name, description, skills, url, version = '0.0.0' }: AgentCardInput): AgentCard {
  return {
    name,
    description,
    supportedInterfaces: [{ url, protocolBinding: 'JSONRPC', tenant: '', protocolVersion: A2A_PROTOCOL_VERSION }],
    provider: undefined,
    version,
    capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: textModes,
    defaultOutputModes: textModes,
    skills: skills.map((skill) => ({ ...skill, inputModes: textModes, outputModes: textModes, securityRequirements: [] })),
    signatures: []
  };
}
