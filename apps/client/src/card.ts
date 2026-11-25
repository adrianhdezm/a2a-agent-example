import type { AgentCard } from '@a2a-js/sdk';
import type { Style } from './style.ts';

const bindingNames: Record<string, string> = { JSONRPC: 'JSON-RPC', 'HTTP+JSON': 'REST', GRPC: 'gRPC' };

/** What the CLI shows of an agent when it connects: who it is, how it is reached, and what to ask it. */
export function renderCard(card: AgentCard, style: Style): string {
  const interfaces = card.supportedInterfaces.map(
    ({ url, protocolBinding, protocolVersion }) => `${bindingNames[protocolBinding] ?? protocolBinding} at ${url} (A2A ${protocolVersion})`
  );
  const skills = card.skills.flatMap((skill) => [
    `  ${style('bold', skill.name)}: ${skill.description}`,
    ...skill.examples.map((example) => style('dim', `    e.g. ${example}`))
  ]);
  return [
    `${style('green', card.name)} ${style('dim', `v${card.version}`)}`,
    card.description,
    `  Endpoint:  ${interfaces.join('; ') || 'none'}`,
    `  Streaming: ${card.capabilities?.streaming === true ? 'yes' : 'no'}`,
    ...(skills.length > 0 ? ['  Skills:', ...skills.map((line) => `  ${line}`)] : [])
  ].join('\n');
}
