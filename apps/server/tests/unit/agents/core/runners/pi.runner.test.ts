import { fauxAssistantMessage, fauxToolCall, registerFauxProvider } from '@mariozechner/pi-ai';
import type { AssistantMessage, Context, FauxResponseStep } from '@mariozechner/pi-ai';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool } from '../../../../../src/agents/core/helpers/tool.helper.ts';
import { ToolError } from '../../../../../src/agents/core/models/runner.model.ts';
import { piModel, piRunner } from '../../../../../src/agents/core/runners/pi.runner.ts';
import { collect, contractAgent, describeRunnerContract, request } from './runner-contract.ts';
import type { ScriptedTurn, SeenTurn } from './runner-contract.ts';

const registrations: { unregister: () => void }[] = [];

afterEach(() => {
  for (const registration of registrations.splice(0)) {
    registration.unregister();
  }
});

/** The text of the user messages in a model call's context. */
function prompts(context: Context): string[] {
  return context.messages.flatMap((message) => (message.role === 'user' && typeof message.content === 'string' ? [message.content] : []));
}

function calling(name: string, input: Record<string, unknown>): AssistantMessage {
  return fauxAssistantMessage(fauxToolCall(name, input), { stopReason: 'toolUse' });
}

/** The model calls Pi's fake provider makes for one scripted turn: the answer, as a call to the `answer` tool. */
function piResponses(turn: ScriptedTurn): AssistantMessage[] {
  if (turn.kind === 'malformed') {
    return [fauxAssistantMessage('Sunny, I think.')];
  }
  if (turn.kind === 'answer') {
    return [calling('answer', { outcome: turn.outcome, text: turn.text })];
  }
  return [calling('lookup', turn.input), calling('answer', { outcome: 'completed', text: turn.text })];
}

/**
 * Pi's own agent loop on its fake provider, which plays the turns as model calls. The tools run for real, and the
 * context of each turn's first call shows the session's earlier prompts.
 */
function playPi(turns: ScriptedTurn[]) {
  const seen: SeenTurn[] = [];
  const faux = registerFauxProvider({ provider: `faux-${String(registrations.length)}` });
  registrations.push(faux);
  faux.setResponses(
    turns.flatMap((turn) =>
      piResponses(turn).map((response, index): FauxResponseStep => (context) => {
        if (index === 0) {
          const all = prompts(context);
          seen.push({ prompt: all.at(-1) ?? '', earlier: all.slice(0, -1) });
        }
        return response;
      })
    )
  );
  return { runner: piRunner({ model: faux.getModel() }), seen: () => seen };
}

describeRunnerContract('pi', { play: playPi });

describe('pi.runner', () => {
  it("runs the agent's tool, told the turn's context, and hands its text back to the model", async () => {
    const faux = registerFauxProvider({ provider: 'faux-tools' });
    registrations.push(faux);
    const calls: { place: string; contextId: string }[] = [];
    let toolResult = '';
    faux.setResponses([
      calling('lookup', { place: 'Lisbon' }),
      (context) => {
        const last = context.messages.at(-1);
        toolResult = last?.role === 'toolResult' && last.content[0]?.type === 'text' ? last.content[0].text : '';
        return calling('answer', { outcome: 'completed', text: 'Sunny.' });
      }
    ]);
    const agent = {
      ...contractAgent,
      tools: [
        defineTool({
          name: 'lookup',
          description: 'Looks a place up.',
          input: z.object({ place: z.string() }),
          run: ({ place }, { contextId }) => {
            calls.push({ place, contextId });
            return Promise.resolve(`${place}: sunny`);
          }
        })
      ]
    };

    await collect(piRunner({ model: faux.getModel() }).runTurn(agent, request('Lisbon?')));

    expect(calls).toEqual([{ place: 'Lisbon', contextId: 'context-1' }]);
    expect(toolResult).toBe('Lisbon: sunny');
  });

  it("hands a tool's ToolError back to the model as a failed call it can explain", async () => {
    const faux = registerFauxProvider({ provider: 'faux-tool-error' });
    registrations.push(faux);
    let failed: boolean | undefined;
    faux.setResponses([
      calling('lookup', { place: 'Atlantis' }),
      (context) => {
        const last = context.messages.at(-1);
        failed = last?.role === 'toolResult' ? last.isError : undefined;
        return calling('answer', { outcome: 'completed', text: 'No such place.' });
      }
    ]);
    const agent = {
      ...contractAgent,
      tools: [
        defineTool({
          name: 'lookup',
          description: 'Looks a place up.',
          input: z.object({ place: z.string() }),
          run: () => Promise.reject(new ToolError('Atlantis is not on the map'))
        })
      ]
    };

    const events = await collect(piRunner({ model: faux.getModel() }).runTurn(agent, request('Atlantis?')));

    expect(failed).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'result', ok: true, outcome: 'completed', text: 'No such place.' });
  });

  it('fails the turn past the step limit', async () => {
    const faux = registerFauxProvider({ provider: 'faux-steps' });
    registrations.push(faux);
    faux.setResponses([1, 2, 3, 4, 5].map(() => calling('lookup', { place: 'Lisbon' })));

    const events = await collect(piRunner({ model: faux.getModel() }).runTurn(contractAgent, request('Lisbon?')));

    expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'the turn took more than 4 steps' });
  });

  describe('piModel', () => {
    it("finds a model in pi-ai's catalogue by provider/model", () => {
      expect(piModel('anthropic/claude-sonnet-4-6')).toMatchObject({ provider: 'anthropic', id: 'claude-sonnet-4-6' });
    });

    it.each(['anthropic/no-such-model', 'nowhere/claude-sonnet-4-6', 'claude-sonnet-4-6'])('refuses %s', (name) => {
      expect(() => piModel(name)).toThrow(/Pi knows no model/);
    });
  });
});
