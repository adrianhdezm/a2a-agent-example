import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';
import type { AgentDefinition } from './agent-definition.ts';
import { agentPaths, joinUrl } from './agent-paths.ts';

const textModes = ['text/plain'];

/** The A2A 1.0 Agent Card of one agent served under `baseUrl`, with its one JSON-RPC interface. */
export function buildAgentCard(definition: AgentDefinition, baseUrl: string): AgentCard {
  return {
    name: definition.name,
    description: definition.description,
    supportedInterfaces: [
      {
        url: joinUrl(baseUrl, agentPaths(definition.id).jsonRpc),
        protocolBinding: 'JSONRPC',
        tenant: '',
        protocolVersion: A2A_PROTOCOL_VERSION
      }
    ],
    provider: undefined,
    version: '0.0.0',
    capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: textModes,
    defaultOutputModes: textModes,
    skills: definition.skills.map((skill) => ({
      ...skill,
      inputModes: textModes,
      outputModes: textModes,
      securityRequirements: []
    })),
    signatures: []
  };
}
