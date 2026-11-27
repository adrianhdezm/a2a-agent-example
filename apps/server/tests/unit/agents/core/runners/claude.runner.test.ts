import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { claudeOptions, claudeRunner, translateClaudeMessage } from '../../../../../src/agents/core/runners/claude.runner.ts';
import type { ClaudeQuery } from '../../../../../src/agents/core/runners/claude.runner.ts';
import {
  answer,
  init,
  maxTurns,
  question,
  sessionId,
  structuredResult,
  success,
  toolCall,
  unreadable
} from '../../../../fixtures/claude-messages.ts';
import { collect, contractAgent, describeRunnerContract, request } from './runner-contract.ts';
import type { ScriptedTurn, SeenTurn } from './runner-contract.ts';

/** The messages the Claude Agent SDK streams for one scripted turn in the session `session`. */
function claudeMessages(turn: ScriptedTurn, session: string): SDKMessage[] {
  const start = { type: 'system', subtype: 'init', session_id: session } as unknown as SDKMessage;
  if (turn.kind === 'malformed') {
    return [start, structuredResult({ answer: 'no format' })];
  }
  if (turn.kind === 'answer') {
    return [start, structuredResult({ outcome: turn.outcome, text: turn.text })];
  }
  const call = {
    type: 'assistant',
    session_id: session,
    message: { content: [{ type: 'tool_use', id: 'toolu_01', name: 'mcp__agent__lookup', input: turn.input }] }
  } as unknown as SDKMessage;
  return [start, call, structuredResult({ outcome: 'completed', text: turn.text })];
}

/** A fake `query()` that plays the turns, keeps the prompts of each session, and fails once aborted, as the SDK does. */
function playClaude(turns: ScriptedTurn[]) {
  const seen: SeenTurn[] = [];
  const sessions = new Map<string, string[]>();
  // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
  const query: ClaudeQuery = async function* ({ prompt, options }) {
    options.abortController?.signal.throwIfAborted();
    const session = options.resume ?? `session-${String(sessions.size + 1)}`;
    const earlier = sessions.get(session) ?? [];
    seen.push({ prompt, earlier });
    sessions.set(session, [...earlier, prompt]);
    yield* claudeMessages(turns[seen.length - 1] ?? { kind: 'malformed' }, session);
  };
  return { runner: claudeRunner({ query }), seen: () => seen };
}

describeRunnerContract('claude', { play: playClaude });

describe('claude.runner', () => {
  describe('translateClaudeMessage', () => {
    it('reports the session the init message announces', () => {
      expect(translateClaudeMessage(init)).toEqual([{ type: 'session', sessionId }]);
    });

    it('reports the text and the tool calls of a message that calls tools as progress, by the tool name', () => {
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
    it("gives Claude only the agent's tools, none of the machine's settings, the session to resume, and the step limit", () => {
      const turn = request('Lisbon tomorrow?', sessionId);

      const options: Options = claudeOptions(contractAgent, turn);

      expect(options).toMatchObject({
        systemPrompt: 'You look things up.',
        resume: sessionId,
        abortController: turn.abortController,
        tools: [],
        allowedTools: ['mcp__agent__lookup'],
        settingSources: [],
        maxTurns: 4
      });
      expect(Object.keys(options.mcpServers ?? {})).toEqual(['agent']);
      expect(options.env).toBeUndefined();
      expect(options.model).toBeUndefined();
    });

    it('asks for the answer as an outcome and a text, both required, in the JSON Schema draft the CLI reads', () => {
      const { outputFormat } = claudeOptions(contractAgent, request('Lisbon tomorrow?'));

      expect(outputFormat).toMatchObject({
        type: 'json_schema',
        schema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          properties: { outcome: { enum: ['completed', 'input-required'] }, text: { type: 'string' } },
          required: ['outcome', 'text']
        }
      });
    });

    it('runs the model it is given', () => {
      expect(claudeOptions(contractAgent, request('Lisbon?'), 'claude-sonnet-4-6').model).toBe('claude-sonnet-4-6');
    });
  });

  it('fails the turn past the step limit, as the SDK reports it', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
    const query: ClaudeQuery = async function* () {
      yield* [init, maxTurns];
    };

    const events = await collect(claudeRunner({ query }).runTurn(contractAgent, request('Lisbon?')));

    expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'error_max_turns' });
  });
});
