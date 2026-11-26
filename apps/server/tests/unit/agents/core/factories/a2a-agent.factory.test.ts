import type { AgentCard } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';
import { createA2aAgent } from '../../../../../src/agents/core/factories/a2a-agent.factory.ts';
import type { TurnEvent } from '../../../../../src/agents/core/models/turn.model.ts';

const card = { name: 'Test Agent' } as AgentCard;

// eslint-disable-next-line @typescript-eslint/require-await -- a turn that is never run
async function* runTurn(): AsyncIterable<TurnEvent> {
  yield* [];
}

describe('createA2aAgent', () => {
  it("serves the definition's card through a request handler of its own, at the A2A paths", async () => {
    const agent = createA2aAgent({ card, runTurn, answerArtifact: { name: 'answer', description: 'The answer' } });

    expect(agent.card).toBe(card);
    expect(await agent.requestHandler.getAgentCard()).toBe(card);
    expect(agent.paths).toEqual({ card: '/.well-known/agent-card.json', jsonRpc: '/a2a/jsonrpc' });
  });

  it('gives every agent its own request handler, so no two share tasks', () => {
    const definition = { card, runTurn, answerArtifact: { name: 'answer', description: 'The answer' } };

    expect(createA2aAgent(definition).requestHandler).not.toBe(createA2aAgent(definition).requestHandler);
  });
});
