import type { McpServerConfig, Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { claudeOptions, runClaudeTurn, translateClaudeMessage } from '../src/claude-turn.ts';
import type { ClaudeTurnSettings, TurnEvent } from '../src/claude-turn.ts';
import { answer, init, maxTurns, sessionId, success, toolCall } from './fixtures/claude-messages.ts';

function settings(messages: SDKMessage[] = []) {
  const calls: { prompt: string; options: Options }[] = [];
  const value: ClaudeTurnSettings = {
    apiKey: 'test-key',
    systemPrompt: () => 'You are a weather assistant.',
    mcpServers: { weather: { type: 'stdio', command: 'unused' } satisfies McpServerConfig },
    allowedTools: ['mcp__weather__find_city'],
    maxTurns: 8,
    // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
    query: async function* (params) {
      calls.push(params);
      yield* messages;
    }
  };
  return { calls, value };
}

async function collect(events: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const collected: TurnEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

describe('claude-turn', () => {
  describe('translateClaudeMessage', () => {
    it('reports the session the init message announces', () => {
      expect(translateClaudeMessage(init)).toEqual([{ type: 'session', sessionId }]);
    });

    it('reports the text and the tool calls of a message that calls tools as progress', () => {
      expect(translateClaudeMessage(toolCall)).toEqual([
        { type: 'progress', text: "I'll look up Lisbon first." },
        { type: 'progress', text: 'Calling find_city {"name":"Lisbon"}' }
      ]);
    });

    it('reports nothing for the answer message, which the result carries', () => {
      expect(translateClaudeMessage(answer)).toEqual([]);
    });

    it.each([
      ['a success', success, { type: 'result', ok: true, text: 'Take an umbrella tomorrow: 85% chance of rain.\nCOMPLETED' }],
      ['any other result', maxTurns, { type: 'result', ok: false, error: 'error_max_turns' }]
    ])('ends the turn on %s', (_case, message, event) => {
      expect(translateClaudeMessage(message)).toEqual([event]);
    });
  });

  describe('claudeOptions', () => {
    it("gives Claude only the agent's tools, none of the machine's settings, and the session to resume", () => {
      const abortController = new AbortController();

      const options = claudeOptions(settings().value, { prompt: 'Lisbon tomorrow?', sessionId, abortController });

      expect(options).toMatchObject({
        systemPrompt: 'You are a weather assistant.',
        resume: sessionId,
        abortController,
        tools: [],
        allowedTools: ['mcp__weather__find_city'],
        settingSources: [],
        maxTurns: 8,
        env: { ANTHROPIC_API_KEY: 'test-key' }
      });
    });
  });

  describe('runClaudeTurn', () => {
    it('runs one query with the prompt and yields what its messages report', async () => {
      const { calls, value } = settings([init, toolCall, answer, success]);

      const events = await collect(runClaudeTurn(value, { prompt: 'Lisbon tomorrow?', abortController: new AbortController() }));

      expect(calls.map(({ prompt }) => prompt)).toEqual(['Lisbon tomorrow?']);
      expect(events.map(({ type }) => type)).toEqual(['session', 'progress', 'progress', 'result']);
    });
  });
});
