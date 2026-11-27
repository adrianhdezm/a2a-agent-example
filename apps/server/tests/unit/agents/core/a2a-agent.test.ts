import { describe, expect, it } from 'vitest';
import { createA2aAgent } from '../../../../src/agents/core/a2a-agent.ts';
import type { AgentCardBase } from '../../../../src/agents/core/models/a2a-agent.model.ts';
import type { Runner } from '../../../../src/agents/core/models/runner.model.ts';

// eslint-disable-next-line @typescript-eslint/require-await -- a turn that is never run
async function* runTurn(): AsyncIterable<never> {
  yield* [];
}

const runner: Runner = { name: 'fake', runTurn };

const card = { name: 'Test Agent' } as AgentCardBase;
const spec = { instructions: () => 'You answer.', tools: [], maxSteps: 4 };
const definition = { id: 'test', card, spec, runner, answerArtifact: { name: 'answer', description: 'The answer' } };

describe('createA2aAgent', () => {
  it("adds to the card the JSON-RPC endpoint it is served at, under the base URL and the agent's id, on protocol 1.0", () => {
    const agent = createA2aAgent(definition, 'http://localhost:41241/');

    expect(agent.card).toMatchObject({ name: 'Test Agent' });
    expect(agent.card.supportedInterfaces).toEqual([
      { url: 'http://localhost:41241/agents/test/a2a/jsonrpc', protocolBinding: 'JSONRPC', tenant: '', protocolVersion: '1.0' }
    ]);
  });

  it("mounts the card, the JSON-RPC endpoint and the tools under the agent's id, the handler serving the same card", async () => {
    const agent = createA2aAgent(definition, 'http://localhost:41241');

    expect(agent.paths).toEqual({
      card: '/agents/test/.well-known/agent-card.json',
      jsonRpc: '/agents/test/a2a/jsonrpc',
      mcp: '/agents/test/mcp'
    });
    expect(await agent.requestHandler.getAgentCard()).toBe(agent.card);
  });

  it('gives the URL a client is given, ending in a slash so the default card path resolves beneath it', () => {
    expect(createA2aAgent(definition, 'http://localhost:41241/').url).toBe('http://localhost:41241/agents/test/');
  });

  it('gives every agent its own request handler, so no two share tasks', () => {
    expect(createA2aAgent(definition, 'http://a').requestHandler).not.toBe(createA2aAgent(definition, 'http://a').requestHandler);
  });
});
