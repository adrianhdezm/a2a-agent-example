import { A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import type { AgentCard } from '@a2a-js/sdk';

/** Where an agent's A2A endpoints live on the server. */
export const agentPaths = { card: '/.well-known/agent-card.json', jsonRpc: '/a2a/jsonrpc' } as const;

/** The card entry for an agent's JSON-RPC endpoint on A2A 1.0, served under `baseUrl`. */
export function jsonRpcInterface(baseUrl: string): AgentCard['supportedInterfaces'][number] {
  return {
    url: `${baseUrl.replace(/\/+$/, '')}${agentPaths.jsonRpc}`,
    protocolBinding: 'JSONRPC',
    tenant: '',
    protocolVersion: A2A_PROTOCOL_VERSION
  };
}
