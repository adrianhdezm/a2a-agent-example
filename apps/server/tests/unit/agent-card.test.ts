import { describe, expect, it } from 'vitest';
import { buildAgentCard } from '../../src/agent-card.ts';
import { agentDefinition } from '../utils/agent-definition-seed.ts';

describe('buildAgentCard', () => {
  it('describes the agent with one JSON-RPC interface on protocol 1.0 at its own endpoint', () => {
    const card = buildAgentCard(agentDefinition(), 'http://localhost:4000');

    expect(card).toMatchObject({ name: 'Claude Coder', description: 'Writes and edits code in its workspace.' });
    expect(card.supportedInterfaces).toEqual([
      { url: 'http://localhost:4000/agents/claude-coder/a2a/jsonrpc', protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it('advertises each skill of the definition with text in and out', () => {
    const card = buildAgentCard(agentDefinition(), 'http://localhost:4000');

    expect(card.skills).toEqual([
      {
        id: 'write-code',
        name: 'Write code',
        description: 'Writes a small program to a file in the workspace.',
        tags: ['code'],
        examples: ["Write hello.py that prints 'Hello, A2A!'"],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
        securityRequirements: []
      }
    ]);
  });

  it('declares no streaming and no push notifications', () => {
    const card = buildAgentCard(agentDefinition(), 'http://localhost:4000');

    expect(card.capabilities).toMatchObject({ streaming: false, pushNotifications: false });
  });
});
