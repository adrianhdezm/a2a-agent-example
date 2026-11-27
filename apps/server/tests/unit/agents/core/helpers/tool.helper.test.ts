import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool, runTool } from '../../../../../src/agents/core/helpers/tool.helper.ts';
import { ToolError } from '../../../../../src/agents/core/models/runner.model.ts';

const context = { contextId: 'context-1', signal: new AbortController().signal };

function lookup(run: (place: string) => Promise<string>) {
  return defineTool({
    name: 'lookup',
    description: 'Looks a place up.',
    input: z.object({ place: z.string().min(1) }),
    run: ({ place }) => run(place)
  });
}

describe('tool.helper', () => {
  it("runs the tool with its checked input and answers with the tool's text", async () => {
    expect(
      await runTool(
        lookup((place) => Promise.resolve(`${place}: sunny`)),
        { place: 'Lisbon' },
        context
      )
    ).toEqual({
      text: 'Lisbon: sunny',
      isError: false
    });
  });

  it('reports an input that does not fit the schema as a failed call, without running the tool', async () => {
    const result = await runTool(
      lookup(() => Promise.reject(new Error('should not run'))),
      { place: '' },
      context
    );

    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/^Invalid input for lookup/);
  });

  it('reports a ToolError as a failed call the model can explain', async () => {
    expect(
      await runTool(
        lookup(() => Promise.reject(new ToolError('the service refused'))),
        { place: 'Lisbon' },
        context
      )
    ).toEqual({
      text: 'the service refused',
      isError: true
    });
  });

  it('lets any other error through, since it is a bug', async () => {
    await expect(
      runTool(
        lookup(() => Promise.reject(new TypeError('boom'))),
        { place: 'Lisbon' },
        context
      )
    ).rejects.toThrow('boom');
  });
});
