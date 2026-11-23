import { describe, expect, it } from 'vitest';
import { findAgent } from '../src/discovery.ts';
import { AgentNotFoundError } from '../src/errors/agent-not-found-error.ts';
import { UnexpectedResponseError } from '../src/errors/unexpected-response-error.ts';

const claudeCoder = {
  id: 'claude-coder',
  name: 'Claude Coder',
  description: 'Writes code.',
  harness: 'claude',
  cardUrl: 'http://localhost:4000/agents/claude-coder/.well-known/agent-card.json'
};

function answering(body: unknown, status = 200) {
  const requested: string[] = [];
  const fetchUrl = (url: string) => {
    requested.push(url);
    return Promise.resolve(Response.json(body, { status }));
  };
  return { requested, fetchUrl };
}

describe('findAgent', () => {
  it("returns the agent with the id from the server's list", async () => {
    const { requested, fetchUrl } = answering([claudeCoder]);

    const agent = await findAgent('http://localhost:4000/', 'claude-coder', fetchUrl);

    expect(agent).toEqual(claudeCoder);
    expect(requested).toEqual(['http://localhost:4000/agents']);
  });

  it('throws an AgentNotFoundError naming the agents the server has', async () => {
    const { fetchUrl } = answering([claudeCoder]);

    await expect(findAgent('http://localhost:4000', 'codex-coder', fetchUrl)).rejects.toThrow(AgentNotFoundError);
    await expect(findAgent('http://localhost:4000', 'codex-coder', fetchUrl)).rejects.toThrow('it has: claude-coder');
  });

  it.each([
    ['an error status', answering([], 500)],
    ['a body that is not a list of agents', answering({ agents: [claudeCoder] })]
  ])('throws an UnexpectedResponseError for %s', async (_case, { fetchUrl }) => {
    await expect(findAgent('http://localhost:4000', 'claude-coder', fetchUrl)).rejects.toThrow(UnexpectedResponseError);
  });
});
