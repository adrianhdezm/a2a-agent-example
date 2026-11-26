import type { McpServerConfig, Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { claudeOptions, runClaudeTurn, translateClaudeMessage } from '../../../../../src/agents/core/runners/claude.runner.ts';
import type { ClaudeTurnSettings } from '../../../../../src/agents/core/runners/claude.runner.ts';
import type { TurnEvent } from '../../../../../src/agents/core/models/turn.model.ts';
import { answer, init, maxTurns, question, sessionId, success, toolCall, unreadable } from '../../../../fixtures/claude-messages.ts';

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

describe('claude.runner', () => {
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

    it('reports nothing for the StructuredOutput call that delivers the answer, which the result carries', () => {
      expect(translateClaudeMessage(answer)).toEqual([]);
    });

    it.each([
      ['an answer', success, { type: 'result', ok: true, outcome: 'completed', text: 'Take an umbrella tomorrow: 85% chance of rain.' }],
      [
        'a question',
        question,
        { type: 'result', ok: true, outcome: 'input-required', text: 'Springfield, Illinois or Springfield, Missouri?' }
      ],
      ['an answer in another shape', unreadable, { type: 'result', ok: false, error: 'the answer did not match its output format' }],
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

    it('asks for the answer as an outcome and a text, both required, in the JSON Schema draft the CLI reads', () => {
      const { outputFormat } = claudeOptions(settings().value, { prompt: 'Lisbon tomorrow?', abortController: new AbortController() });

      expect(outputFormat).toMatchObject({
        type: 'json_schema',
        schema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { outcome: { enum: ['completed', 'input-required'] }, text: { type: 'string' } },
          required: ['outcome', 'text']
        }
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
