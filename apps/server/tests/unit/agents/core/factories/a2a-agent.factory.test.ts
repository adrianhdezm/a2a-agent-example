import { describe, expect, it } from 'vitest';
import { createA2aAgent } from '../../../../../src/agents/core/factories/a2a-agent.factory.ts';
import type { AgentCardBase } from '../../../../../src/agents/core/models/a2a-agent.model.ts';
import type { TurnEvent } from '../../../../../src/agents/core/models/turn.model.ts';

// eslint-disable-next-line @typescript-eslint/require-await -- a turn that is never run
async function* runTurn(): AsyncIterable<TurnEvent> {
  yield* [];
}

const card = { name: 'Test Agent' } as AgentCardBase;
const definition = { card, runTurn, answerArtifact: { name: 'answer', description: 'The answer' } };

describe('createA2aAgent', () => {
  it('adds to the card the JSON-RPC endpoint it is served at, under the base URL, on protocol 1.0', () => {
    const agent = createA2aAgent(definition, 'http://localhost:41241/');

    expect(agent.card).toMatchObject({ name: 'Test Agent' });
    expect(agent.card.supportedInterfaces).toEqual([
      { url: 'http://localhost:41241/a2a/jsonrpc', protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it('mounts the card and the JSON-RPC endpoint at the A2A paths, the handler serving the same card', async () => {
    const agent = createA2aAgent(definition, 'http://localhost:41241');

    expect(agent.paths).toEqual({ card: '/.well-known/agent-card.json', jsonRpc: '/a2a/jsonrpc' });
    expect(await agent.requestHandler.getAgentCard()).toBe(agent.card);
  });

  it('gives every agent its own request handler, so no two share tasks', () => {
    expect(createA2aAgent(definition, 'http://a').requestHandler).not.toBe(createA2aAgent(definition, 'http://a').requestHandler);
  });
});
