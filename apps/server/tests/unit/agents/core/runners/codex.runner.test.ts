import type { ThreadEvent } from '@openai/codex-sdk';
import { describe, expect, it } from 'vitest';
import { codexOptions, codexRunner, codexThreadOptions, translateCodexEvent } from '../../../../../src/agents/core/runners/codex.runner.ts';
import { fakeCodex } from '../../../../utils/fake-codex.ts';
import type { CodexRun } from '../../../../utils/fake-codex.ts';
import { collect, contractAgent, describeRunnerContract, request } from './runner-contract.ts';
import type { ScriptedTurn, SeenTurn } from './runner-contract.ts';

const completed: ThreadEvent = {
  type: 'turn.completed',
  usage: { input_tokens: 1200, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 80, reasoning_output_tokens: 40 }
};

function message(text: string): ThreadEvent {
  return { type: 'item.completed', item: { id: 'item_9', type: 'agent_message', text } };
}

function toolCall(input: unknown, id = 'item_1'): ThreadEvent {
  return {
    type: 'item.started',
    item: { id, type: 'mcp_tool_call', server: 'agent', tool: 'lookup', arguments: input, status: 'in_progress' }
  };
}

/** The events the Codex SDK streams for one scripted turn on the thread `thread`. */
function codexEvents(turn: ScriptedTurn, thread: string): ThreadEvent[] {
  const start: ThreadEvent[] = [{ type: 'thread.started', thread_id: thread }, { type: 'turn.started' }];
  if (turn.kind === 'malformed') {
    return [...start, message('Sunny, I think.'), completed];
  }
  if (turn.kind === 'answer') {
    return [...start, message(JSON.stringify({ outcome: turn.outcome, text: turn.text })), completed];
  }
  return [...start, toolCall(turn.input), message(JSON.stringify({ outcome: 'completed', text: turn.text })), completed];
}

/** A fake Codex that plays the turns and keeps the inputs of each thread, as the Codex CLI keeps its threads. */
function playCodex(turns: ScriptedTurn[]) {
  const seen: SeenTurn[] = [];
  const threads = new Map<string, string[]>();
  const fake = fakeCodex(({ input, resumed }: CodexRun) => {
    const thread = resumed ?? `thread-${String(threads.size + 1)}`;
    const earlier = threads.get(thread) ?? [];
    seen.push({ prompt: input, earlier });
    threads.set(thread, [...earlier, input]);
    return codexEvents(turns[seen.length - 1] ?? { kind: 'malformed' }, thread);
  });
  return { runner: codexRunner({ codex: fake.factory }), seen: () => seen };
}

describeRunnerContract('codex', { play: playCodex });

describe('codex.runner', () => {
  describe('translateCodexEvent', () => {
    it('reports a shell command as progress, and an agent message as nothing until the run completes', () => {
      const command: ThreadEvent = {
        type: 'item.started',
        item: { id: 'item_2', type: 'command_execution', command: 'date', aggregated_output: '', status: 'in_progress' }
      };

      expect(translateCodexEvent(command, undefined)).toEqual({ type: 'progress', text: 'Running date' });
      expect(translateCodexEvent(message('{}'), undefined)).toBeUndefined();
    });

    it('fails the turn with the error of a failed run', () => {
      const failed: ThreadEvent = { type: 'turn.failed', error: { message: 'stream disconnected before completion' } };

      expect(translateCodexEvent(failed, undefined)).toEqual({ type: 'result', ok: false, error: 'stream disconnected before completion' });
    });

    it('reports a stream error as progress, since Codex retries after one and only turn.failed ends the run', () => {
      expect(translateCodexEvent({ type: 'error', message: 'Reconnecting... 2/5' }, undefined)).toEqual({
        type: 'progress',
        text: 'Codex: Reconnecting... 2/5'
      });
    });
  });

  describe('codexOptions and codexThreadOptions', () => {
    it("passes the instructions as developer instructions, and the agent's tools as its one MCP server for the context", () => {
      expect(codexOptions(contractAgent, 'context-1')).toEqual({
        config: {
          developer_instructions: 'You look things up.',
          project_doc_max_bytes: 0,
          mcp_servers: { agent: { url: 'http://127.0.0.1:41241/agents/test/mcp/context-1', enabled_tools: ['lookup'] } }
        }
      });
    });

    it('configures no MCP server for an agent with no tools', () => {
      expect(codexOptions({ ...contractAgent, tools: [] }, 'context-1').config).not.toHaveProperty('mcp_servers');
    });

    it('holds Codex to a read-only sandbox in an empty folder, with no network, web search or approvals', () => {
      expect(codexThreadOptions('gpt-5.5')).toMatchObject({
        model: 'gpt-5.5',
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
        skipGitRepoCheck: true,
        workingDirectory: expect.stringContaining('codex-agent-') as unknown
      });
    });
  });

  it('asks for the answer in the strict JSON Schema the OpenAI API reads, without the draft keyword', async () => {
    const fake = fakeCodex([[message('{"outcome":"completed","text":"Done."}'), completed]]);

    await collect(codexRunner({ codex: fake.factory }).runTurn(contractAgent, request('Lisbon?')));

    expect(fake.runs[0]?.turnOptions?.outputSchema).toMatchObject({ additionalProperties: false, required: ['outcome', 'text'] });
    expect(fake.runs[0]?.turnOptions?.outputSchema).not.toHaveProperty('$schema');
  });

  it('fails the turn, and stops the run, once Codex calls tools more often than the step limit', async () => {
    const calls = [1, 2, 3, 4, 5].map((n) => toolCall({ place: 'Lisbon' }, `item_${String(n)}`));
    const fake = fakeCodex([[{ type: 'thread.started', thread_id: 'thread-1' }, ...calls, message('{}'), completed]]);

    const events = await collect(codexRunner({ codex: fake.factory }).runTurn(contractAgent, request('Lisbon?')));

    expect(events.at(-1)).toEqual({ type: 'result', ok: false, error: 'the turn took more than 4 steps' });
    expect(fake.runs[0]?.turnOptions?.signal?.aborted).toBe(true);
  });
});
