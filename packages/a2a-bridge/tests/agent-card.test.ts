import { describe, expect, it } from 'vitest';
import { buildAgentCard } from '../src/agent-card.ts';
import type { AgentCardInput } from '../src/agent-card.ts';

const input: AgentCardInput = {
  name: 'Claude Coder',
  description: 'Writes and edits code in its workspace.',
  url: 'http://localhost:4000/agents/claude-coder/a2a/jsonrpc',
  skills: [
    {
      id: 'write-code',
      name: 'Write code',
      description: 'Writes a small program to a file in the workspace.',
      tags: ['code'],
      examples: ["Write hello.py that prints 'Hello, A2A!'"]
    }
  ]
};

describe('buildAgentCard', () => {
  it('describes the agent with one JSON-RPC interface on protocol 1.0 at the given URL', () => {
    const card = buildAgentCard(input);

    expect(card).toMatchObject({ name: 'Claude Coder', description: 'Writes and edits code in its workspace.', version: '0.0.0' });
    expect(card.supportedInterfaces).toEqual([
      { url: 'http://localhost:4000/agents/claude-coder/a2a/jsonrpc', protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it('advertises each skill with text in and out', () => {
    expect(buildAgentCard(input).skills).toEqual([
      { ...input.skills[0], inputModes: ['text/plain'], outputModes: ['text/plain'], securityRequirements: [] }
    ]);
  });

  it('declares what the executor can do: no streaming and no push notifications', () => {
    expect(buildAgentCard(input).capabilities).toMatchObject({ streaming: false, pushNotifications: false });
  });

  it("carries the agent's own version when the app gives one", () => {
    expect(buildAgentCard({ ...input, version: '2.1.0' }).version).toBe('2.1.0');
  });
});
