import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool } from '../../../../../src/agents/core/helpers/tool.helper.ts';
import type { Runner, TurnAgent } from '../../../../../src/agents/core/models/runner.model.ts';
import type { TurnEvent, TurnOutcome, TurnRequest } from '../../../../../src/agents/core/models/turn.model.ts';

/**
 * One turn as the model plays it, in no SDK's terms: it answers, or calls the `lookup` tool first and then answers, or
 * ends without an answer in the format.
 */
export type ScriptedTurn =
  | { kind: 'answer'; outcome: TurnOutcome; text: string }
  | { kind: 'tool-then-answer'; input: { place: string }; text: string }
  | { kind: 'malformed' };

/** What the SDK saw of one turn: the prompt, and the earlier prompts of the session it continued. */
export interface SeenTurn {
  prompt: string;
  earlier: string[];
}

/**
 * How one runner's test plays scripted turns on a fake of its SDK. The fake keeps sessions as the SDK does, so a turn
 * that resumes a session sees that session's earlier prompts.
 */
export interface RunnerHarness {
  play: (turns: ScriptedTurn[]) => { runner: Runner; seen: () => SeenTurn[] };
}

/** The agent every runner runs in the contract: one `lookup` tool. */
export const contractAgent: TurnAgent = {
  instructions: () => 'You look things up.',
  tools: [
    defineTool({
      name: 'lookup',
      description: 'Looks a place up.',
      input: z.object({ place: z.string() }),
      run: ({ place }) => Promise.resolve(`${place}: sunny`)
    })
  ],
  maxSteps: 4,
  toolsUrl: (contextId) => `http://127.0.0.1:41241/agents/test/mcp/${contextId}`
};

export function request(prompt: string, sessionId?: string, abortController = new AbortController()): TurnRequest {
  return { prompt, contextId: 'context-1', sessionId, abortController };
}

export async function collect(events: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const collected: TurnEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

function sessionOf(events: TurnEvent[]): string | undefined {
  const session = events.find((event) => event.type === 'session');
  return session?.type === 'session' ? session.sessionId : undefined;
}

/**
 * The contract every runner keeps, whatever its SDK: the same turn, played on any runner, reports the same events.
 * This is what makes the runners strategies an agent can be given in place of one another.
 */
export function describeRunnerContract(name: string, harness: RunnerHarness): void {
  describe(`the ${name} runner keeps the runner contract`, () => {
    it('reports its session first, then the answer', async () => {
      const { runner } = harness.play([{ kind: 'answer', outcome: 'completed', text: 'Sunny all week.' }]);

      const events = await collect(runner.runTurn(contractAgent, request('Lisbon?')));

      expect(events[0]?.type).toBe('session');
      expect(events.slice(1)).toEqual([{ type: 'result', ok: true, outcome: 'completed', text: 'Sunny all week.' }]);
    });

    it('ends with a question when it needs the user to tell it more', async () => {
      const { runner } = harness.play([{ kind: 'answer', outcome: 'input-required', text: 'Which Springfield?' }]);

      const events = await collect(runner.runTurn(contractAgent, request('Springfield?')));

      expect(events.at(-1)).toEqual({ type: 'result', ok: true, outcome: 'input-required', text: 'Which Springfield?' });
    });

    it("reports a call to one of the agent's tools as progress, by the tool's own name", async () => {
      const { runner } = harness.play([{ kind: 'tool-then-answer', input: { place: 'Lisbon' }, text: 'Sunny.' }]);

      const events = await collect(runner.runTurn(contractAgent, request('Lisbon?')));

      expect(events.slice(1)).toEqual([
        { type: 'progress', text: 'Calling lookup {"place":"Lisbon"}' },
        { type: 'result', ok: true, outcome: 'completed', text: 'Sunny.' }
      ]);
    });

    it('fails the turn when the answer is not in the format, in the same words', async () => {
      const { runner } = harness.play([{ kind: 'malformed' }]);

      const events = await collect(runner.runTurn(contractAgent, request('Lisbon?')));

      expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'the answer did not match its output format' });
    });

    it('continues the session it is given, and starts a new one without', async () => {
      const answer: ScriptedTurn = { kind: 'answer', outcome: 'completed', text: 'Done.' };
      const { runner, seen } = harness.play([answer, answer, answer]);

      const first = await collect(runner.runTurn(contractAgent, request('Lisbon?')));
      const second = await collect(runner.runTurn(contractAgent, request('And Rome?', sessionOf(first))));
      await collect(runner.runTurn(contractAgent, request('Madrid?')));

      expect(sessionOf(second)).toBe(sessionOf(first));
      expect(seen().map(({ earlier }) => earlier)).toEqual([[], ['Lisbon?'], []]);
    });

    it('gives no answer once the turn is aborted', async () => {
      const { runner } = harness.play([{ kind: 'answer', outcome: 'completed', text: 'Too late.' }]);
      const abortController = new AbortController();
      abortController.abort();

      const events = await collect(runner.runTurn(contractAgent, request('Lisbon?', undefined, abortController))).catch(() => []);

      expect(events.some(({ type }) => type === 'result')).toBe(false);
    });
  });
}
