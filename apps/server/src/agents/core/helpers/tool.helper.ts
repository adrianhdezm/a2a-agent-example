import type { z } from 'zod';
import { ToolError } from '../models/runner.model.ts';
import type { AgentTool, ToolContext } from '../models/runner.model.ts';

/** What a tool call gives back to the model, in every runner's terms: its text, and whether the call failed. */
export interface ToolResult {
  text: string;
  isError: boolean;
}

/**
 * Runs one call of a tool for any runner: the input checked against the tool's schema first, a `ToolError` or a bad
 * input reported back as a failed call, and any other error left to end the turn.
 */
export async function runTool(tool: AgentTool, input: unknown, context: ToolContext): Promise<ToolResult> {
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) {
    return { text: `Invalid input for ${tool.name}: ${parsed.error.message}`, isError: true };
  }
  try {
    const text = await tool.run(parsed.data, context);
    return { text, isError: false };
  } catch (error) {
    if (error instanceof ToolError) {
      return { text: error.message, isError: true };
    }
    throw error;
  }
}

/** A tool, typed by its own input so `run` reads it, kept in a list of tools of any input. */
export function defineTool<Input extends z.ZodObject>(tool: AgentTool<Input>): AgentTool {
  return tool;
}
