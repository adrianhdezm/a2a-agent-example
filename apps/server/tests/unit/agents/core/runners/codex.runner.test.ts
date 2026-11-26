import type { ThreadEvent } from '@openai/codex-sdk';
import { describe, expect, it } from 'vitest';
import {
  codexAnswerSchema,
  codexOptions,
  codexThreadOptions,
  runCodexTurn,
  translateCodexEvent
} from '../../../../../src/agents/core/runners/codex.runner.ts';
import type { CodexConsultant, CodexTurnSettings } from '../../../../../src/agents/core/runners/codex.runner.ts';
import type { TurnEvent } from '../../../../../src/agents/core/models/turn.model.ts';
import { command, completed, failed, message, reasoning, run, started, threadId } from '../../../../fixtures/codex-events.ts';
import { fakeCodex } from '../../../../utils/fake-codex.ts';

async function collect(events: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const collected: TurnEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

/** A consultant that streams `reply` for every question, and records the questions and the threads they came in. */
function consultant(reply: TurnEvent[]) {
  const asked: { question: string; threadId: string }[] = [];
  const value: CodexConsultant = {
    name: 'Weather Agent',
    // eslint-disable-next-line @typescript-eslint/require-await -- an async stream over a fixed list
    ask: async function* (question, conversation) {
      asked.push({ question, threadId: conversation.threadId });
      yield* reply;
    }
  };
  return { asked, value };
}

function settings(script: ThreadEvent[][], consultantValue?: CodexConsultant) {
  const fake = fakeCodex(script);
  const value: CodexTurnSettings = {
    instructions: () => 'You are a trip planner.',
    consultant: consultantValue,
    maxConsultations: 2,
    codex: fake.factory
  };
  return { runs: fake.runs, value };
}

const forecast: TurnEvent[] = [
  { type: 'progress', text: 'Calling find_city {"name":"Lisbon"}' },
  { type: 'result', ok: true, outcome: 'completed', text: 'Sunny, 18 to 24 °C.' }
];

describe('codex.runner', () => {
  describe('translateCodexEvent', () => {
    it('reports the thread the run starts as the session', () => {
      expect(translateCodexEvent(started, undefined)).toEqual({ type: 'session', sessionId: threadId });
    });

    it('reports reasoning and commands as progress, and the agent message as nothing until the run completes', () => {
      expect(translateCodexEvent(reasoning, undefined)).toEqual({ type: 'progress', text: '**Checking the forecast for Lisbon**' });
      expect(translateCodexEvent(command, undefined)).toEqual({ type: 'progress', text: 'Running date' });
      expect(translateCodexEvent(message({ outcome: 'completed', text: 'Pack light.' }), undefined)).toBeUndefined();
    });

    it('reads the last agent message as the answer when the run completes', () => {
      const last = JSON.stringify({ outcome: 'consult', text: 'Lisbon this weekend?' });

      expect(translateCodexEvent(completed, last)).toEqual({
        type: 'answer',
        answer: { outcome: 'consult', text: 'Lisbon this weekend?' }
      });
    });

    it.each([
      ['text that is not JSON', 'Pack light.'],
      ['JSON in another shape', '{"answer":"Pack light."}'],
      ['no message at all', undefined]
    ])('fails the turn on %s', (_case, last) => {
      expect(translateCodexEvent(completed, last)).toEqual({
        type: 'result',
        ok: false,
        error: 'the answer did not match its output format'
      });
    });

    it('fails the turn with the error of a failed run', () => {
      expect(translateCodexEvent(failed, undefined)).toEqual({ type: 'result', ok: false, error: 'stream disconnected before completion' });
    });

    it('reports a stream error as progress, since Codex retries after one and only turn.failed ends the run', () => {
      expect(translateCodexEvent({ type: 'error', message: 'Reconnecting... 2/5' }, undefined)).toEqual({
        type: 'progress',
        text: 'Codex: Reconnecting... 2/5'
      });
    });
  });

  describe('codexAnswerSchema', () => {
    it('asks for an outcome and a text, both required and nothing else, in strict JSON Schema without $schema', () => {
      const schema = codexAnswerSchema();

      expect(schema).toMatchObject({
        type: 'object',
        properties: { outcome: { enum: ['completed', 'input-required'] }, text: { type: 'string' } },
        required: ['outcome', 'text'],
        additionalProperties: false
      });
      expect(schema).not.toHaveProperty('$schema');
    });

    it('offers the consult outcome, naming the consultant, only when there is one', () => {
      const schema = codexAnswerSchema('Weather Agent');

      expect(schema).toMatchObject({ properties: { outcome: { enum: ['completed', 'input-required', 'consult'] } } });
      expect(JSON.stringify(schema)).toContain('ask the Weather Agent');
    });
  });

  describe('codexOptions and codexThreadOptions', () => {
    it('passes the instructions as developer instructions, and reads no project docs', () => {
      expect(codexOptions(settings([]).value)).toEqual({
        config: { developer_instructions: 'You are a trip planner.', project_doc_max_bytes: 0 }
      });
    });

    it('holds Codex to a read-only sandbox in an empty folder, with no network, web search or approvals', () => {
      expect(codexThreadOptions()).toMatchObject({
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
        skipGitRepoCheck: true,
        workingDirectory: expect.stringContaining('codex-agent-') as unknown
      });
    });
  });

  describe('runCodexTurn', () => {
    it('starts a thread, runs the prompt with the answer schema, and yields the session, the progress and the answer', async () => {
      const { runs, value } = settings([run({ outcome: 'completed', text: 'Pack light.' })]);
      const abortController = new AbortController();

      const events = await collect(runCodexTurn(value, { prompt: 'Lisbon this weekend?', abortController }));

      expect(events).toEqual([
        { type: 'session', sessionId: threadId },
        { type: 'progress', text: '**Checking the forecast for Lisbon**' },
        { type: 'result', ok: true, outcome: 'completed', text: 'Pack light.' }
      ]);
      expect(runs).toMatchObject([{ input: 'Lisbon this weekend?', resumed: undefined, turnOptions: { signal: abortController.signal } }]);
      expect(runs[0]?.turnOptions?.outputSchema).toEqual(codexAnswerSchema());
    });

    it("resumes the session's thread", async () => {
      const { runs, value } = settings([run({ outcome: 'input-required', text: 'When do you go?' }, false)]);

      const events = await collect(runCodexTurn(value, { prompt: 'Lisbon', sessionId: threadId, abortController: new AbortController() }));

      expect(runs[0]?.resumed).toBe(threadId);
      expect(events.at(-1)).toEqual({ type: 'result', ok: true, outcome: 'input-required', text: 'When do you go?' });
    });

    it('asks the consultant in the thread, streams its progress, and runs the thread again with its reply', async () => {
      const weather = consultant(forecast);
      const { runs, value } = settings(
        [run({ outcome: 'consult', text: 'Lisbon this weekend?' }), run({ outcome: 'completed', text: 'Pack sunscreen.' }, false)],
        weather.value
      );

      const events = await collect(runCodexTurn(value, { prompt: 'Packing for Lisbon?', abortController: new AbortController() }));

      expect(weather.asked).toEqual([{ question: 'Lisbon this weekend?', threadId }]);
      expect(runs.map(({ input }) => input)).toEqual(['Packing for Lisbon?', 'The Weather Agent answered:\nSunny, 18 to 24 °C.']);
      expect(runs[0]?.turnOptions?.outputSchema).toEqual(codexAnswerSchema('Weather Agent'));
      expect(events.filter(({ type }) => type === 'progress')).toEqual([
        { type: 'progress', text: '**Checking the forecast for Lisbon**' },
        { type: 'progress', text: 'Asking the Weather Agent: Lisbon this weekend?' },
        { type: 'progress', text: 'Weather Agent: Calling find_city {"name":"Lisbon"}' },
        { type: 'progress', text: '**Checking the forecast for Lisbon**' }
      ]);
      expect(events.at(-1)).toEqual({ type: 'result', ok: true, outcome: 'completed', text: 'Pack sunscreen.' });
    });

    it.each([
      [
        "the consultant's question",
        { type: 'result', ok: true, outcome: 'input-required', text: 'Which Springfield?' },
        'The Weather Agent asks you:\nWhich Springfield?'
      ],
      [
        "the consultant's failure",
        { type: 'result', ok: false, error: 'Open-Meteo refused' },
        'The Weather Agent could not answer: Open-Meteo refused'
      ]
    ] satisfies [string, TurnEvent, string][])('hands %s back to Codex to decide', async (_case, reply, input) => {
      const { runs, value } = settings(
        [run({ outcome: 'consult', text: 'Springfield?' }), run({ outcome: 'input-required', text: 'Which one?' }, false)],
        consultant([reply]).value
      );

      await collect(runCodexTurn(value, { prompt: 'Springfield on Monday', abortController: new AbortController() }));

      expect(runs[1]?.input).toBe(input);
    });

    it('fails the turn when Codex consults more often than allowed', async () => {
      const { runs, value } = settings(
        [run({ outcome: 'consult', text: 'Lisbon?' }), run({ outcome: 'consult', text: 'Lisbon?' }, false)],
        consultant(forecast).value
      );

      const events = await collect(runCodexTurn(value, { prompt: 'Lisbon', abortController: new AbortController() }));

      expect(runs).toHaveLength(3);
      expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'Codex asked the Weather Agent more than 2 times' });
    });

    it('fails the turn when Codex consults with no one to consult', async () => {
      const { value } = settings([run({ outcome: 'consult', text: 'Lisbon?' })]);

      const events = await collect(runCodexTurn(value, { prompt: 'Lisbon', abortController: new AbortController() }));

      expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'Codex asked to consult, with no one to consult' });
    });

    it('ends with the failed run, without asking anyone', async () => {
      const weather = consultant(forecast);
      const { value } = settings([[started, failed]], weather.value);

      const events = await collect(runCodexTurn(value, { prompt: 'Lisbon', abortController: new AbortController() }));

      expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'stream disconnected before completion' });
      expect(weather.asked).toEqual([]);
    });

    it('stops after the consultant when the turn is aborted, without running Codex again', async () => {
      const abortController = new AbortController();
      const weather: CodexConsultant = {
        name: 'Weather Agent',
        // eslint-disable-next-line @typescript-eslint/require-await, require-yield -- aborts as it is asked
        ask: async function* () {
          abortController.abort();
        }
      };
      const { runs, value } = settings([run({ outcome: 'consult', text: 'Lisbon?' })], weather);

      await expect(collect(runCodexTurn(value, { prompt: 'Lisbon', abortController }))).rejects.toThrow();
      expect(runs).toHaveLength(1);
    });
  });
});
